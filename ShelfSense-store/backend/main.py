"""Synqora ShelfSense backend.

Lean hackathon MVP:
- FastAPI + SQLite
- Atomic checkout with idempotency
- Transactional outbox + background worker
- StepFun shopping assistant with safe fallback
- Low-stock restock drafts
"""
from __future__ import annotations

import asyncio
import base64
import io
import json
import logging
import os
import re
import sqlite3
import time
import uuid
import wave
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request, File, UploadFile, Form, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
_db_env = os.getenv("DATABASE_PATH", "").strip()
if _db_env:
    DB_PATH = Path(_db_env)
    if not DB_PATH.is_absolute():
        DB_PATH = (BASE_DIR / DB_PATH).resolve()
else:
    DB_PATH = (BASE_DIR / "store.db").resolve()
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
LOW_STOCK_THRESHOLD = int(os.getenv("LOW_STOCK_THRESHOLD", "10"))
STEPFUN_API_KEY = os.getenv("STEPFUN_API_KEY", "").strip()
STEPFUN_BASE_URL = os.getenv("STEPFUN_BASE_URL", "https://api.stepfun.ai/v1").rstrip("/")
STEPFUN_MODEL = os.getenv("STEPFUN_MODEL", "step-3.7-flash")
AI_TIMEOUT_SECONDS = float(os.getenv("AI_TIMEOUT_SECONDS", "25"))


def load_env_file() -> None:
    """Tiny .env loader so the MVP does not need python-dotenv."""
    for path in (PROJECT_DIR / ".env", BASE_DIR / ".env"):
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key:
                os.environ[key] = value


def get_ai_config() -> tuple[str | None, str, str, str]:
    """Dynamically resolves active AI provider, api key, base url, and model."""
    load_env_file()
    gemini_key = os.getenv("GOOGLE_API_KEY", "").strip() or os.getenv("GEMINI_API_KEY", "").strip()
    stepfun_key = os.getenv("STEPFUN_API_KEY", "").strip()
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip() or os.getenv("OPENAI_API_KEY", "").strip()

    if gemini_key:
        base_url = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai").rstrip("/")
        model = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")
        return "gemini", gemini_key, base_url, model
    elif stepfun_key:
        base_url = os.getenv("STEPFUN_BASE_URL", "https://api.stepfun.ai/v1").rstrip("/")
        model = os.getenv("STEPFUN_MODEL", "step-3.7-flash")
        return "stepfun", stepfun_key, base_url, model
    elif openrouter_key:
        base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
        model = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-001")
        return "openrouter", openrouter_key, base_url, model

    return None, "", "", ""


load_env_file()
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
DB_PATH = Path(os.getenv("DATABASE_PATH", BASE_DIR / "store.db"))
LOW_STOCK_THRESHOLD = int(os.getenv("LOW_STOCK_THRESHOLD", "10"))


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


class PgCursorWrapper:
    def __init__(self, cursor: Any) -> None:
        self._cur = cursor

    def fetchone(self) -> Any:
        return self._cur.fetchone()

    def fetchall(self) -> list[Any]:
        return self._cur.fetchall()

    @property
    def rowcount(self) -> int:
        return self._cur.rowcount


class PgConnectionWrapper:
    def __init__(self, conn: Any) -> None:
        self._conn = conn

    def execute(self, sql: str, params: Any = None) -> Any:
        cleaned = sql.strip().upper()
        if cleaned in ("BEGIN IMMEDIATE", "BEGIN"):
            return PgCursorWrapper(self._conn.cursor())
        cur = self._conn.cursor()
        pg_sql = sql.replace("?", "%s")
        cur.execute(pg_sql, params or ())
        return PgCursorWrapper(cur)

    def executescript(self, script: str) -> None:
        cur = self._conn.cursor()
        cur.execute(script)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()


def get_db_connection():
    if DATABASE_URL and (DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgres://")) and PSYCOPG2_AVAILABLE:
        try:
            db_url = DATABASE_URL
            if db_url.startswith("postgres://"):
                db_url = "postgresql://" + db_url[len("postgres://"):]
            if "127.0.0.1" not in db_url and "localhost" not in db_url and "sslmode" not in db_url:
                separator = "&" if "?" in db_url else "?"
                db_url = f"{db_url}{separator}sslmode=require"

            pg_conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor, connect_timeout=8)
            return PgConnectionWrapper(pg_conn), "postgresql"
        except Exception as e:
            logging.warning(f"PostgreSQL connection failed ({e}), falling back to SQLite WAL")
    
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=30000")
    return conn, "sqlite"


def db():
    conn, _ = get_db_connection()
    return conn


class DbSession:
    """Context manager that commits/rolls back and always closes the connection."""

    def __enter__(self):
        self.conn = db()
        return self.conn

    def __exit__(self, exc_type, exc, tb) -> None:
        try:
            if exc_type is None:
                self.conn.commit()
            else:
                self.conn.rollback()
        finally:
            self.conn.close()


def row_to_product(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "sku": row["sku"],
        "title": row["title"],
        "category": row["category"],
        "description": row["description"],
        "price_paise": row["price_paise"],
        "stock": row["stock"],
        "emoji": row["emoji"],
        "tags": json.loads(row["tags"] or "[]"),
        "attributes": json.loads(row["attributes_json"] or "{}"),
        "updated_at": row["updated_at"],
    }


SEED_PRODUCTS: list[dict[str, Any]] = [
    {"id": "prod_001", "sku": "BAG-001", "title": "Water-resistant 14-inch laptop backpack", "category": "bags", "description": "Padded laptop sleeve, rain flap, and organizer pockets for campus commutes.", "price_paise": 249900, "stock": 8, "emoji": "🎒", "tags": ["backpack", "laptop", "water resistant", "college"], "attributes": {"water_resistant": True, "laptop_size_inches": 14, "color": "black"}},
    {"id": "prod_002", "sku": "BAG-002", "title": "Minimal 15.6-inch commuter backpack", "category": "bags", "description": "Lightweight everyday backpack with a dedicated laptop compartment.", "price_paise": 189900, "stock": 14, "emoji": "🎒", "tags": ["backpack", "laptop", "commuter"], "attributes": {"water_resistant": False, "laptop_size_inches": 15.6, "color": "grey"}},
    {"id": "prod_003", "sku": "BAG-003", "title": "Premium rain-proof laptop bag 14-inch", "category": "bags", "description": "Sealed seams and waterproof zip for heavy monsoon use.", "price_paise": 329900, "stock": 5, "emoji": "🧳", "tags": ["laptop", "rain", "waterproof", "premium"], "attributes": {"water_resistant": True, "laptop_size_inches": 14, "color": "navy"}},
    {"id": "prod_004", "sku": "SLV-001", "title": "Neoprene laptop sleeve 13-inch", "category": "accessories", "description": "Slim scratch-resistant sleeve for tablets and small laptops.", "price_paise": 79900, "stock": 22, "emoji": "💼", "tags": ["sleeve", "laptop", "13 inch"], "attributes": {"water_resistant": False, "laptop_size_inches": 13, "color": "charcoal"}},
    {"id": "prod_005", "sku": "SLV-002", "title": "Water-resistant laptop sleeve 14-inch", "category": "accessories", "description": "Soft inner lining with splash-resistant outer shell.", "price_paise": 109900, "stock": 9, "emoji": "💼", "tags": ["sleeve", "laptop", "water resistant"], "attributes": {"water_resistant": True, "laptop_size_inches": 14, "color": "olive"}},
    {"id": "prod_006", "sku": "SHO-001", "title": "All-weather running shoes", "category": "shoes", "description": "Grippy outsole and quick-dry mesh for rainy-day runs.", "price_paise": 279900, "stock": 11, "emoji": "👟", "tags": ["running", "shoes", "rain", "sports"], "attributes": {"water_resistant": True, "use": "running", "color": "black"}},
    {"id": "prod_007", "sku": "SHO-002", "title": "Budget campus sneakers", "category": "shoes", "description": "Comfortable everyday sneakers for college and casual wear.", "price_paise": 159900, "stock": 18, "emoji": "👟", "tags": ["sneakers", "college", "casual"], "attributes": {"water_resistant": False, "use": "casual", "color": "white"}},
    {"id": "prod_008", "sku": "SHO-003", "title": "Trail grip shoes", "category": "shoes", "description": "Aggressive lugs and reinforced toe for uneven paths.", "price_paise": 349900, "stock": 6, "emoji": "🥾", "tags": ["trail", "shoes", "grip"], "attributes": {"water_resistant": True, "use": "trail", "color": "brown"}},
    {"id": "prod_009", "sku": "JKT-001", "title": "Lightweight rain jacket", "category": "apparel", "description": "Packable hooded jacket with taped seams for sudden showers.", "price_paise": 219900, "stock": 12, "emoji": "🧥", "tags": ["rain", "jacket", "monsoon"], "attributes": {"water_resistant": True, "color": "yellow"}},
    {"id": "prod_010", "sku": "JKT-002", "title": "Windbreaker for commute", "category": "apparel", "description": "Breathable wind-resistant layer for bike and metro commutes.", "price_paise": 179900, "stock": 10, "emoji": "🧥", "tags": ["windbreaker", "commute"], "attributes": {"water_resistant": False, "color": "blue"}},
    {"id": "prod_011", "sku": "BTL-001", "title": "Insulated steel bottle 750ml", "category": "accessories", "description": "Keeps drinks cold for 18 hours; leak-proof lid.", "price_paise": 99900, "stock": 30, "emoji": "🍶", "tags": ["bottle", "steel", "college"], "attributes": {"capacity_ml": 750, "insulated": True, "color": "silver"}},
    {"id": "prod_012", "sku": "BTL-002", "title": "Sports sipper bottle 1L", "category": "accessories", "description": "BPA-free lightweight bottle with one-hand sipper.", "price_paise": 49900, "stock": 40, "emoji": "🥤", "tags": ["bottle", "sports", "sipper"], "attributes": {"capacity_ml": 1000, "insulated": False, "color": "green"}},
    {"id": "prod_013", "sku": "ELE-001", "title": "65W GaN fast charger", "category": "electronics", "description": "Compact dual-port charger for laptop and phone.", "price_paise": 229900, "stock": 15, "emoji": "🔌", "tags": ["charger", "gan", "usb-c", "laptop"], "attributes": {"watts": 65, "ports": 2, "color": "white"}},
    {"id": "prod_014", "sku": "ELE-002", "title": "USB-C hub 6-in-1", "category": "electronics", "description": "HDMI, USB-A, SD card, and PD passthrough for laptops.", "price_paise": 189900, "stock": 7, "emoji": "🔗", "tags": ["hub", "usb-c", "hdmi"], "attributes": {"ports": 6, "hdmi": True, "color": "grey"}},
    {"id": "prod_015", "sku": "ELE-003", "title": "Wireless mouse silent click", "category": "electronics", "description": "Ergonomic 2.4GHz mouse with quiet switches.", "price_paise": 89900, "stock": 25, "emoji": "🖱️", "tags": ["mouse", "wireless", "silent"], "attributes": {"wireless": True, "color": "black"}},
    {"id": "prod_016", "sku": "ELE-004", "title": "Bluetooth speaker mini", "category": "electronics", "description": "Pocket speaker with 10-hour battery and IPX5 splash resistance.", "price_paise": 149900, "stock": 13, "emoji": "🔊", "tags": ["speaker", "bluetooth", "ipx5"], "attributes": {"water_resistant": True, "battery_hours": 10, "color": "teal"}},
    {"id": "prod_017", "sku": "ELE-005", "title": "Noise-canceling earbuds", "category": "electronics", "description": "ANC earbuds with transparency mode and 24-hour case battery.", "price_paise": 399900, "stock": 4, "emoji": "🎧", "tags": ["earbuds", "anc", "audio"], "attributes": {"anc": True, "battery_hours": 24, "color": "white"}},
    {"id": "prod_018", "sku": "STN-001", "title": "Desk organizer bamboo", "category": "stationery", "description": "Phone stand, pen slots, and cable tray for study desks.", "price_paise": 69900, "stock": 19, "emoji": "🗂️", "tags": ["desk", "organizer", "bamboo"], "attributes": {"material": "bamboo", "color": "natural"}},
    {"id": "prod_019", "sku": "STN-002", "title": "Notebook pack of 3", "category": "stationery", "description": "A5 ruled notebooks for lectures and quick notes.", "price_paise": 39900, "stock": 50, "emoji": "📓", "tags": ["notebook", "college", "pack"], "attributes": {"pages": 160, "size": "A5", "color": "assorted"}},
    {"id": "prod_020", "sku": "STN-003", "title": "Gel pen set 10-pack", "category": "stationery", "description": "Smooth 0.5mm gel pens in assorted colors.", "price_paise": 29900, "stock": 60, "emoji": "🖊️", "tags": ["pen", "gel", "pack"], "attributes": {"count": 10, "tip_mm": 0.5, "color": "assorted"}},
    {"id": "prod_021", "sku": "LGT-001", "title": "Rechargeable desk lamp", "category": "electronics", "description": "Dimmable LED lamp with three color temperatures.", "price_paise": 129900, "stock": 16, "emoji": "💡", "tags": ["lamp", "desk", "led", "rechargeable"], "attributes": {"rechargeable": True, "dimmable": True, "color": "white"}},
    {"id": "prod_022", "sku": "LGT-002", "title": "Clip-on reading light", "category": "electronics", "description": "Flexible neck light for beds and desks.", "price_paise": 59900, "stock": 21, "emoji": "🔦", "tags": ["light", "reading", "clip"], "attributes": {"rechargeable": True, "color": "black"}},
    {"id": "prod_023", "sku": "BAG-004", "title": "Canvas tote bag", "category": "bags", "description": "Reusable everyday tote for books and groceries.", "price_paise": 34900, "stock": 35, "emoji": "👜", "tags": ["tote", "canvas", "eco"], "attributes": {"water_resistant": False, "material": "canvas", "color": "beige"}},
    {"id": "prod_024", "sku": "ACC-001", "title": "Compact travel umbrella", "category": "accessories", "description": "Wind-resistant folding umbrella with auto open/close.", "price_paise": 89900, "stock": 2, "emoji": "☂️", "tags": ["umbrella", "rain", "travel"], "attributes": {"water_resistant": True, "foldable": True, "color": "black"}},
    {"id": "prod_025", "sku": "ACC-002", "title": "Laptop stand aluminum", "category": "accessories", "description": "Adjustable aluminum stand for better posture.", "price_paise": 159900, "stock": 12, "emoji": "🧑‍💻", "tags": ["laptop", "stand", "aluminum"], "attributes": {"adjustable": True, "material": "aluminum", "color": "silver"}},
]


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with DbSession() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                sku TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                price_paise INTEGER NOT NULL,
                stock INTEGER NOT NULL CHECK (stock >= 0),
                emoji TEXT NOT NULL DEFAULT '📦',
                tags TEXT NOT NULL DEFAULT '[]',
                attributes_json TEXT NOT NULL DEFAULT '{}',
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                idempotency_key TEXT UNIQUE,
                customer_name TEXT,
                total_paise INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'placed',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS order_items (
                order_id TEXT NOT NULL REFERENCES orders(id),
                product_id TEXT NOT NULL REFERENCES products(id),
                quantity INTEGER NOT NULL CHECK (quantity > 0),
                unit_price_paise INTEGER NOT NULL,
                PRIMARY KEY (order_id, product_id)
            );
            CREATE TABLE IF NOT EXISTS outbox (
                id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                aggregate_id TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                processed_at TEXT
            );
            CREATE TABLE IF NOT EXISTS alerts (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                product_id TEXT NOT NULL REFERENCES products(id),
                evidence_json TEXT NOT NULL,
                draft_text TEXT NOT NULL,
                draft_source TEXT NOT NULL DEFAULT 'template',
                status TEXT NOT NULL DEFAULT 'open',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS demand_signals (
                id TEXT PRIMARY KEY,
                query TEXT NOT NULL,
                category TEXT,
                attributes_json TEXT NOT NULL DEFAULT '{}',
                max_budget_paise INTEGER,
                source TEXT NOT NULL DEFAULT 'customer',
                created_at TEXT NOT NULL
            );
            """
        )
        count = conn.execute("SELECT COUNT(*) AS c FROM products").fetchone()["c"]
        if count == 0:
            now = utcnow()
            for p in SEED_PRODUCTS:
                conn.execute(
                    """INSERT INTO products
                    (id, sku, title, category, description, price_paise, stock, emoji, tags, attributes_json, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (p["id"], p["sku"], p["title"], p["category"], p["description"], p["price_paise"], p["stock"], p["emoji"], json.dumps(p["tags"]), json.dumps(p["attributes"]), now),
                )


def search_products(
    query: str = "",
    category: str | None = None,
    max_price_paise: int | None = None,
    required_attributes: dict[str, Any] | None = None,
    in_stock_only: bool = True,
    limit: int = 6,
) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit or 6), 100))
    sql = "SELECT * FROM products WHERE 1=1"
    params: list[Any] = []
    if in_stock_only:
        sql += " AND stock > 0"
    if category:
        sql += " AND category = ?"
        params.append(category)
    if max_price_paise is not None:
        sql += " AND price_paise <= ?"
        params.append(int(max_price_paise))
    stopwords = {"under", "below", "less", "than", "upto", "up", "to", "within", "budget", "max", "for", "need", "want", "i", "a", "an", "the", "with", "and", "inr", "rs", "please", "find", "me", "looking", "search"}
    tokens = [t for t in re.split(r"\W+", (query or "").lower()) if len(t) > 1 and t not in stopwords and not t.isdigit()]
    for token in tokens[:8]:
        sql += " AND (lower(title) LIKE ? OR lower(description) LIKE ? OR lower(category) LIKE ? OR lower(tags) LIKE ?)"
        like = f"%{token}%"
        params.extend([like, like, like, like])
    with DbSession() as conn:
        rows = conn.execute(sql, params).fetchall()
        if not rows and len(tokens) > 1:
            relaxed_sql = "SELECT * FROM products WHERE 1=1"
            relaxed_params: list[Any] = []
            if in_stock_only:
                relaxed_sql += " AND stock > 0"
            if category:
                relaxed_sql += " AND category = ?"
                relaxed_params.append(category)
            if max_price_paise is not None:
                relaxed_sql += " AND price_paise <= ?"
                relaxed_params.append(int(max_price_paise))
            or_clauses = ["(lower(title) LIKE ? OR lower(description) LIKE ? OR lower(category) LIKE ? OR lower(tags) LIKE ?)"] * len(tokens[:8])
            relaxed_sql += f" AND ({' OR '.join(or_clauses)})"
            for token in tokens[:8]:
                like = f"%{token}%"
                relaxed_params.extend([like, like, like, like])
            rows = conn.execute(relaxed_sql, relaxed_params).fetchall()
    products = [row_to_product(r) for r in rows]
    
    # Primary Field Relevance Gate: A genuine product match must match on title, tags, or category.
    # Incidental mentions in description alone (e.g. "layer for bike commute" on a jacket) are discarded.
    if tokens and products:
        def has_primary_match(p: dict[str, Any]) -> bool:
            primary_text = f"{p['title']} {p['category']} {' '.join(p['tags'])}".lower()
            return any(t in primary_text for t in tokens)
        
        primary_products = [p for p in products if has_primary_match(p)]
        # If no product matches title, tags, or category, this is an out-of-catalog item (e.g. 'bike')
        products = primary_products

    required_attributes = required_attributes or {}
    if required_attributes and products:
        # Prefer products matching required attributes, but keep candidates if strict filter is empty
        strict_attr_matches = [p for p in products if all(p["attributes"].get(k) == v for k, v in required_attributes.items())]
        if strict_attr_matches:
            products = strict_attr_matches
    def score(p: dict[str, Any]) -> tuple:
        primary_text = f"{p['title']} {p['category']} {' '.join(p['tags'])}".lower()
        primary_hits = sum(1 for t in tokens if t in primary_text)
        desc_hits = sum(1 for t in tokens if t in p['description'].lower())
        matched_attrs = sum(1 for k, v in required_attributes.items() if p["attributes"].get(k) == v)
        # Heavily weight primary hits over description hits
        return (-(primary_hits * 5 + desc_hits), -matched_attrs, -p["stock"], p["price_paise"])
    products.sort(key=score)
    return products[:limit]


def local_intent(message: str) -> dict[str, Any]:
    text = message.lower()
    max_price = None
    m = re.search(r"(?:under|below|less than|upto|up to|within|budget|max)\s*(?:₹|rs\.?|inr)?\s*([\d,]+)", text)
    if not m:
        m = re.search(r"(?:₹|rs\.?|inr)\s*([\d,]+)", text)
    if m:
        max_price = int(m.group(1).replace(",", "")) * 100
    category = None
    if any(w in text for w in ["bag", "backpack", "tote"]):
        category = "bags"
    elif any(w in text for w in ["shoe", "sneaker", "trail"]):
        category = "shoes"
    elif any(w in text for w in ["jacket", "windbreaker", "apparel"]):
        category = "apparel"
    elif any(w in text for w in ["bottle", "sipper"]):
        category = "accessories"
    elif any(w in text for w in ["charger", "hub", "mouse", "speaker", "earbuds", "lamp", "electronics"]):
        category = "electronics"
    elif any(w in text for w in ["notebook", "pen", "stationery"]):
        category = "stationery"
    attrs: dict[str, Any] = {}
    if any(w in text for w in ["water", "rain", "monsoon", "waterproof", "splash"]):
        attrs["water_resistant"] = True
    laptop = re.search(r"(\d{2}(?:\.\d)?)\s*(?:-?inch|inches|”|\")", text)
    if laptop:
        attrs["laptop_size_inches"] = float(laptop.group(1))
    for color in ["black", "white", "grey", "gray", "blue", "navy", "green", "olive", "yellow", "brown", "silver", "teal", "beige"]:
        if color in text:
            attrs["color"] = "grey" if color == "gray" else color
            break
    return {"query": message, "category": category, "max_price_paise": max_price, "required_attributes": attrs, "in_stock_only": True, "limit": 6}


SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "search_products",
        "description": "Search the live Synqora catalog. Use this for any product recommendation request. Never invent products, prices, or stock.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Short keyword query derived from the shopper request."},
                "category": {"type": ["string", "null"], "enum": ["bags", "shoes", "apparel", "accessories", "electronics", "stationery", None]},
                "max_price_paise": {"type": ["integer", "null"], "description": "Maximum price in Indian paise. ₹2500 = 250000."},
                "required_attributes": {"type": "object", "description": "Required product attributes, e.g. {\"water_resistant\": true, \"laptop_size_inches\": 14}."},
                "in_stock_only": {"type": "boolean"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 6},
            },
            "required": ["query", "in_stock_only"],
        },
    },
}


async def ai_chat(payload: dict[str, Any]) -> tuple[dict[str, Any], str]:
    provider, api_key, base_url, default_model = get_ai_config()
    if not api_key:
        raise RuntimeError("No AI API key is configured")

    payload = dict(payload)
    if "model" not in payload or not payload["model"]:
        payload["model"] = default_model
    if provider == "gemini" and not str(payload["model"]).startswith("gemini-"):
        payload["model"] = default_model

    async with httpx.AsyncClient(timeout=AI_TIMEOUT_SECONDS) as client:
        resp = await client.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )
        resp.raise_for_status()
        return resp.json(), provider


def template_restock_draft(product: dict[str, Any], recent_units: int, threshold: int) -> str:
    suggested = max(10, recent_units * 2 or 10)
    return (
        f"Subject: Restock request for {product['title']} ({product['sku']})\n\n"
        f"Hi supplier,\n\nCurrent stock for {product['title']} is {product['stock']} units, "
        f"below our threshold of {threshold}. Recent recorded sales: {recent_units} units. "
        f"Please quote availability and lead time for {suggested} units.\n\n"
        f"Regards,\nSynqora Inventory Ops"
    )


async def outbox_worker() -> None:
    while True:
        try:
            with DbSession() as conn:
                rows = conn.execute("SELECT * FROM outbox WHERE processed_at IS NULL ORDER BY created_at LIMIT 20").fetchall()
                for row in rows:
                    payload = json.loads(row["payload_json"])
                    if row["event_type"] == "order_placed":
                        for item in payload.get("items", []):
                            p = conn.execute("SELECT * FROM products WHERE id = ?", (item["product_id"],)).fetchone()
                            if p and p["stock"] <= LOW_STOCK_THRESHOLD:
                                existing = conn.execute("SELECT id FROM alerts WHERE product_id = ? AND status = 'open' AND type = 'low_stock'", (p["id"],)).fetchone()
                                if not existing:
                                    product = row_to_product(p)
                                    recent = conn.execute(
                                        """SELECT COALESCE(SUM(oi.quantity), 0) AS units FROM order_items oi
                                        JOIN orders o ON o.id = oi.order_id
                                        WHERE oi.product_id = ? AND o.created_at >= ?""",
                                        (p["id"], (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()),
                                    ).fetchone()["units"]
                                    draft = template_restock_draft(product, recent, LOW_STOCK_THRESHOLD)
                                    now = utcnow()
                                    conn.execute(
                                        """INSERT INTO alerts (id, type, product_id, evidence_json, draft_text, draft_source, status, created_at, updated_at)
                                        VALUES (?, 'low_stock', ?, ?, ?, 'template', 'open', ?, ?)""",
                                        (f"alert_{uuid.uuid4().hex[:10]}", p["id"], json.dumps({"current_stock": p["stock"], "recent_units_sold": recent, "threshold": LOW_STOCK_THRESHOLD}), draft, now, now),
                                    )
                    conn.execute("UPDATE outbox SET processed_at = ? WHERE id = ?", (utcnow(), row["id"]))
        except Exception:
            # Keep demo alive; errors are visible in server logs if needed.
            pass
        await asyncio.sleep(0.5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    task = asyncio.create_task(outbox_worker())
    yield
    task.cancel()


app = FastAPI(title="Synqora ShelfSense API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class CheckoutItem(BaseModel):
    product_id: str
    quantity: int = Field(gt=0, le=20)


class CheckoutRequest(BaseModel):
    items: list[CheckoutItem]
    idempotency_key: str | None = None
    customer_name: str | None = None


class ShopRequest(BaseModel):
    message: str = Field(min_length=1, max_length=600)
    image_base64: str | None = None
    image_media_type: str | None = "image/jpeg"


class StockUpdate(BaseModel):
    stock: int = Field(ge=0, le=10000)


class RestockRequest(BaseModel):
    product_id: str
    alert_id: str | None = None


class DemandRequest(BaseModel):
    query: str = Field(min_length=2, max_length=400)
    category: str | None = None
    max_budget_paise: int | None = None
    attributes: dict[str, Any] = {}


class SourcingRfpRequest(BaseModel):
    query: str
    category: str | None = None
    signal_count: int = 1
    estimated_lost_paise: int = 0


class FulfillDemandRequest(BaseModel):
    query: str
    category: str | None = None
    title: str | None = None
    price_paise: int | None = None
    stock: int = 15


def _log_demand_signal(query: str, filters: dict[str, Any]) -> None:
    """Silently capture an unmet demand signal. Never raises."""
    try:
        with DbSession() as conn:
            conn.execute(
                "INSERT INTO demand_signals (id, query, category, attributes_json, max_budget_paise, source, created_at) VALUES (?, ?, ?, ?, ?, 'auto', ?)",
                (
                    f"ds_{uuid.uuid4().hex[:12]}",
                    query[:400],
                    filters.get("category"),
                    json.dumps(filters.get("required_attributes") or {}),
                    filters.get("max_price_paise"),
                    utcnow(),
                ),
            )
    except Exception:
        pass


@app.get("/api/health")
def health():
    _, engine = get_db_connection()
    provider, key, _, model = get_ai_config()
    return {
        "ok": True,
        "database": engine,
        "ai_configured": bool(key),
        "ai_provider": provider,
        "model": model if key else None,
        "low_stock_threshold": LOW_STOCK_THRESHOLD,
    }


@app.get("/api/products")
def list_products(query: str = "", category: str | None = None, max_price: int | None = None, in_stock: bool = False):
    return {"products": search_products(query=query, category=category, max_price_paise=max_price, in_stock_only=in_stock, limit=100)}


@app.get("/api/products/{product_id}")
def get_product(product_id: str):
    with DbSession() as conn:
        row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Product not found")
    return row_to_product(row)


@app.post("/api/checkout")
def checkout(req: CheckoutRequest):
    if not req.items:
        raise HTTPException(400, "Cart is empty")
    idem = req.idempotency_key or uuid.uuid4().hex
    conn = db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        existing = conn.execute("SELECT * FROM orders WHERE idempotency_key = ?", (idem,)).fetchone()
        if existing:
            items = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (existing["id"],)).fetchall()
            conn.commit()
            return {"order": {"id": existing["id"], "total_paise": existing["total_paise"], "status": existing["status"], "created_at": existing["created_at"], "items": [dict(i) for i in items]}, "duplicate": True}
        total = 0
        order_items = []
        for item in req.items:
            row = conn.execute("SELECT * FROM products WHERE id = ?", (item.product_id,)).fetchone()
            if not row:
                raise HTTPException(404, f"Product not found: {item.product_id}")
            if row["stock"] < item.quantity:
                raise HTTPException(409, f"Insufficient stock for {row['title']}. Available: {row['stock']}")
            total += row["price_paise"] * item.quantity
            order_items.append({"product_id": item.product_id, "quantity": item.quantity, "unit_price_paise": row["price_paise"], "title": row["title"]})
        order_id = f"ord_{uuid.uuid4().hex[:12]}"
        now = utcnow()
        for item in req.items:
            cur = conn.execute("UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock >= ?", (item.quantity, now, item.product_id, item.quantity))
            if cur.rowcount != 1:
                raise HTTPException(409, "Stock changed during checkout")
        conn.execute("INSERT INTO orders (id, idempotency_key, customer_name, total_paise, status, created_at) VALUES (?, ?, ?, ?, 'placed', ?)", (order_id, idem, req.customer_name, total, now))
        for item in order_items:
            conn.execute("INSERT INTO order_items (order_id, product_id, quantity, unit_price_paise) VALUES (?, ?, ?, ?)", (order_id, item["product_id"], item["quantity"], item["unit_price_paise"]))
        conn.execute("INSERT INTO outbox (id, event_type, aggregate_id, payload_json, created_at) VALUES (?, 'order_placed', ?, ?, ?)", (f"evt_{uuid.uuid4().hex[:12]}", order_id, json.dumps({"order_id": order_id, "items": order_items, "total_paise": total}), now))
        conn.commit()
        return {"order": {"id": order_id, "total_paise": total, "status": "placed", "created_at": now, "items": order_items}, "duplicate": False}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, f"Checkout failed: {e}")
    finally:
        conn.close()


@app.get("/api/admin/overview")
def admin_overview():
    LOW_STOCK_LEAD_DAYS = 3   # assumed supplier lead time
    SAFETY_STOCK_DAYS = 2
    with DbSession() as conn:
        products = [row_to_product(r) for r in conn.execute("SELECT * FROM products ORDER BY category, title").fetchall()]
        # Enrich each product with 7-day velocity and reorder point
        for p in products:
            recent_units = conn.execute(
                """SELECT COALESCE(SUM(oi.quantity), 0) AS units
                   FROM order_items oi
                   JOIN orders o ON o.id = oi.order_id
                   WHERE oi.product_id = ? AND o.created_at >= ?""",
                (p["id"], (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()),
            ).fetchone()["units"]
            daily_velocity = round(recent_units / 7, 2)
            p["daily_velocity"] = daily_velocity
            p["reorder_point"] = round(daily_velocity * LOW_STOCK_LEAD_DAYS + daily_velocity * SAFETY_STOCK_DAYS)
        orders = [dict(r) for r in conn.execute("SELECT * FROM orders ORDER BY created_at DESC LIMIT 20").fetchall()]
        for o in orders:
            o["items"] = [dict(r) for r in conn.execute("SELECT * FROM order_items WHERE order_id = ?", (o["id"],)).fetchall()]
        alerts = [dict(r) for r in conn.execute("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 20").fetchall()]
        for a in alerts:
            a["evidence"] = json.loads(a["evidence_json"])
        events = [dict(r) for r in conn.execute("SELECT * FROM outbox ORDER BY created_at DESC LIMIT 20").fetchall()]
        demand_signal_count = conn.execute("SELECT COUNT(*) AS c FROM demand_signals").fetchone()["c"]
    return {
        "products": products,
        "orders": orders,
        "alerts": alerts,
        "events": events,
        "low_stock_threshold": LOW_STOCK_THRESHOLD,
        "demand_signal_count": demand_signal_count,
    }


@app.post("/api/admin/products/{product_id}/stock")
def update_stock(product_id: str, req: StockUpdate):
    with DbSession() as conn:
        cur = conn.execute("UPDATE products SET stock = ?, updated_at = ? WHERE id = ?", (req.stock, utcnow(), product_id))
        if cur.rowcount != 1:
            raise HTTPException(404, "Product not found")
    return {"ok": True}


@app.post("/api/admin/restock-draft")
async def restock_draft(req: RestockRequest):
    with DbSession() as conn:
        row = conn.execute("SELECT * FROM products WHERE id = ?", (req.product_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Product not found")
        product = row_to_product(row)
        recent = conn.execute(
            """SELECT COALESCE(SUM(oi.quantity), 0) AS units FROM order_items oi
            JOIN orders o ON o.id = oi.order_id WHERE oi.product_id = ? AND o.created_at >= ?""",
            (req.product_id, (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()),
        ).fetchone()["units"]
    draft = template_restock_draft(product, recent, LOW_STOCK_THRESHOLD)
    source = "template"
    provider, key, _, model = get_ai_config()
    if key:
        try:
            data, source = await ai_chat({
                "model": model,
                "messages": [
                    {"role": "system", "content": "You are an inventory operations assistant. Write a concise supplier restock email draft. Use only the supplied numbers. Do not claim the email was sent."},
                    {"role": "user", "content": f"Product: {product['title']} SKU: {product['sku']}. Current stock: {product['stock']}. Threshold: {LOW_STOCK_THRESHOLD}. Recent units sold: {recent}. Draft a restock request."},
                ],
                "max_tokens": 350,
                "temperature": 0.3,
            })
            content = data["choices"][0]["message"].get("content")
            if content:
                draft = content.strip()
        except Exception:
            pass
    now = utcnow()
    with DbSession() as conn:
        if req.alert_id:
            conn.execute("UPDATE alerts SET draft_text = ?, draft_source = ?, updated_at = ? WHERE id = ?", (draft, source, now, req.alert_id))
        else:
            existing = conn.execute("SELECT id FROM alerts WHERE product_id = ? AND status = 'open' AND type = 'low_stock'", (req.product_id,)).fetchone()
            if existing:
                conn.execute("UPDATE alerts SET draft_text = ?, draft_source = ?, updated_at = ? WHERE id = ?", (draft, source, now, existing["id"]))
            else:
                conn.execute("INSERT INTO alerts (id, type, product_id, evidence_json, draft_text, draft_source, status, created_at, updated_at) VALUES (?, 'low_stock', ?, ?, ?, ?, 'open', ?, ?)", (f"alert_{uuid.uuid4().hex[:10]}", req.product_id, json.dumps({"current_stock": product["stock"], "recent_units_sold": recent, "threshold": LOW_STOCK_THRESHOLD}), draft, source, now, now))
    return {"draft": draft, "source": source, "recent_units_sold": recent}


def clean_text_reply(text: str) -> str:
    if not text:
        return ""
    # Strip markdown bold/italic asterisks
    text = re.sub(r"\*{1,3}", "", text)
    # Strip emojis (unicode emoji & symbol blocks)
    text = re.sub(r"[\U00010000-\U0010ffff]", "", text)
    text = re.sub(r"[\u2600-\u27bf\u2300-\u23ff\u2b50\u200d\ufe0f]", "", text)
    # Collapse multiple spaces
    text = re.sub(r"\s+", " ", text).strip()
    return text


@app.post("/api/ai/shop")
async def ai_shop(req: ShopRequest, request: Request):
    filters = local_intent(req.message)
    products: list[dict[str, Any]] = []
    reply = ""
    source = "fallback"
    provider, key, _, model = get_ai_config()
    if key:
        try:
            user_content: Any = req.message
            if req.image_base64:
                user_content = [
                    {"type": "text", "text": req.message},
                    {"type": "image_url", "image_url": {"url": f"data:{req.image_media_type or 'image/jpeg'};base64,{req.image_base64}"}},
                ]
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are ShelfSense, an ultra-clean, minimalist shopping assistant. "
                        "Use the search_products tool for all product requests. Prices are in INR paise. "
                        "Recommend ONLY products returned by the tool. "
                        "STRICT FORMAT RULES: "
                        "1. Output clean, plain text only. NEVER use markdown symbols, asterisks, or bold tags (**). "
                        "2. NEVER use emojis. No exceptions. "
                        "3. If products match, write a single concise sentence under 15 words stating the recommendation and price in rupees (₹). "
                        "4. If no products match or the item is not available, reply in ONE simple, direct sentence under 12 words "
                        "(e.g., 'We do not currently stock bikes in our catalog.'). "
                        "5. Never list store categories and never write long explanations."
                    ),
                },
                {"role": "user", "content": user_content},
            ]
            data, source = await ai_chat({"model": model, "messages": messages, "tools": [SEARCH_TOOL], "tool_choice": "auto", "max_tokens": 700, "temperature": 0.2})
            msg = data["choices"][0]["message"]
            tool_calls = msg.get("tool_calls") or []
            if tool_calls:
                call = tool_calls[0]
                args = json.loads(call["function"]["arguments"] or "{}")
                filters = {
                    "query": str(args.get("query") or req.message)[:200],
                    "category": args.get("category"),
                    "max_price_paise": args.get("max_price_paise"),
                    "required_attributes": args.get("required_attributes") or {},
                    "in_stock_only": bool(args.get("in_stock_only", True)),
                    "limit": int(args.get("limit") or 6),
                }
                products = search_products(**filters)
                messages.append(msg)
                messages.append({
                    "role": "tool",
                    "tool_call_id": call["id"],
                    "content": json.dumps({
                        "products": products,
                        "no_results_reason": None if products else "No catalog product matched. In ONE plain sentence under 12 words with NO emojis and NO markdown asterisks, state that we do not currently stock this item.",
                    }),
                })
                follow, _ = await ai_chat({"model": model, "messages": messages, "max_tokens": 300, "temperature": 0.2})
                reply = (follow["choices"][0]["message"].get("content") or "").strip()
                # If Gemini explicitly concludes that the boutique does not stock the requested item, clear products
                no_stock_indicators = [
                    "do not currently stock", "don't currently stock", "don't carry",
                    "do not carry", "could not find", "no in-stock", "no catalog product",
                    "not in our inventory", "not part of our collection", "don't have"
                ]
                if any(ind in reply.lower() for ind in no_stock_indicators):
                    products = []
            else:
                # Gemini answered without calling tools: it intentionally treated the request as non-catalog or conversational
                products = []
                reply = (msg.get("content") or "").strip()
                source = f"{source}_no_tool"
        except Exception:
            products = []
            reply = ""
            source = "fallback"
    # ONLY fall back to deterministic database query if the AI API is offline or encountered an exception
    if not products and source == "fallback":
        products = search_products(**filters)
    # Auto-log demand signal when no products matched after all attempts
    if not products:
        _log_demand_signal(filters.get("query", req.message), filters)
    if not reply:
        if products:
            reply = f"I found {len(products)} in-stock option(s) that match your request. The closest match is {products[0]['title']} at ₹{products[0]['price_paise'] / 100:,.0f}."
        else:
            reply = f"We do not currently stock '{req.message}' in our catalog."
    reply = clean_text_reply(reply)
    return {"reply": reply, "products": products, "filters": filters, "source": source}


@app.post("/api/admin/dismiss-alert/{alert_id}")
def dismiss_alert(alert_id: str):
    with DbSession() as conn:
        conn.execute("UPDATE alerts SET status = 'dismissed', updated_at = ? WHERE id = ?", (utcnow(), alert_id))
    return {"ok": True}


# ── Demand Gap Engine ─────────────────────────────────────────────────────────

@app.post("/api/demand/request")
def submit_demand(req: DemandRequest):
    """Customer explicitly reports a product they could not find."""
    with DbSession() as conn:
        conn.execute(
            "INSERT INTO demand_signals (id, query, category, attributes_json, max_budget_paise, source, created_at) VALUES (?, ?, ?, ?, ?, 'customer', ?)",
            (
                f"ds_{uuid.uuid4().hex[:12]}",
                req.query,
                req.category,
                json.dumps(req.attributes),
                req.max_budget_paise,
                utcnow(),
            ),
        )
    return {"ok": True, "message": "Your request has been captured in our Demand Radar."}


@app.get("/api/admin/demand-radar")
def demand_radar():
    """Aggregated unmet demand grouped by query + category for the merchant."""
    with DbSession() as conn:
        rows = conn.execute(
            """SELECT query, category, MIN(attributes_json) AS attributes_json, max_budget_paise,
                      COUNT(*) AS signal_count,
                      MIN(created_at) AS first_seen,
                      MAX(created_at) AS last_seen
               FROM demand_signals
               GROUP BY query, category, max_budget_paise
               ORDER BY signal_count DESC
               LIMIT 20"""
        ).fetchall()
        recent_rows = conn.execute(
            """SELECT id, query, category, max_budget_paise, source, created_at
               FROM demand_signals
               ORDER BY created_at DESC
               LIMIT 20"""
        ).fetchall()
    signals = []
    for r in rows:
        avg_budget = r["max_budget_paise"] or 0
        signals.append({
            "query": r["query"],
            "category": r["category"],
            "attributes": json.loads(r["attributes_json"] or "{}"),
            "max_budget_paise": r["max_budget_paise"],
            "signal_count": r["signal_count"],
            "estimated_lost_paise": avg_budget * r["signal_count"],
            "first_seen": r["first_seen"],
            "last_seen": r["last_seen"],
        })
    recent_signals = [dict(r) for r in recent_rows]
    return {"signals": signals, "total": len(signals), "recent_signals": recent_signals}


@app.post("/api/admin/demand/fulfill")
def fulfill_demand(req: FulfillDemandRequest):
    """Marks a demand request as fulfilled and ensures a matching product exists or is stocked in the store catalog."""
    with DbSession() as conn:
        sku = f"FUL-{uuid.uuid4().hex[:6].upper()}"
        prod_id = f"prod_{uuid.uuid4().hex[:8]}"
        title = req.title or req.query.strip().title()
        category = req.category or "accessories"
        price_paise = req.price_paise or 199900

        # Intelligent image selection for fulfilled items
        t_lower = (title + " " + (req.query or "")).lower()
        if any(w in t_lower for w in ("backpack", "rolltop", "aeroshield", "featherweight", "commuter pack")):
            image_url = "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80"
        elif any(w in t_lower for w in ("sling", "crossbody", "courier")):
            image_url = "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=800&q=80"
        elif any(w in t_lower for w in ("walnut", "organizer", "station", "bamboo")):
            image_url = "/products/prod_018.jpg"
        elif any(w in t_lower for w in ("sleeve", "neoprene")):
            image_url = "/products/prod_004.jpg"
        elif any(w in t_lower for w in ("jacket", "rain")):
            image_url = "/products/prod_009.jpg"
        elif any(w in t_lower for w in ("stand", "aluminum")):
            image_url = "/products/prod_025.jpg"
        elif any(w in t_lower for w in ("hub", "usb")):
            image_url = "/products/prod_014.jpg"
        elif any(w in t_lower for w in ("bottle", "sipper")):
            image_url = "/products/prod_012.jpg"
        elif "umbrella" in t_lower:
            image_url = "/products/prod_024.jpg"
        elif "tote" in t_lower:
            image_url = "/products/prod_023.jpg"
        elif category == "bags":
            image_url = "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80"
        elif category == "stationery":
            image_url = "/products/prod_018.jpg"
        else:
            image_url = "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80"

        # Check if product with this title already exists
        existing = conn.execute("SELECT * FROM products WHERE title LIKE ?", (f"%{title}%",)).fetchone()
        if existing:
            conn.execute("UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?", (req.stock, utcnow(), existing["id"]))
            product_id = existing["id"]
            product_title = existing["title"]
        else:
            conn.execute(
                """INSERT INTO products (id, sku, title, category, description, price_paise, stock, emoji, tags, attributes_json, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, '✨', '[]', ?, ?)""",
                (prod_id, sku, title, category, f"Customer demand fulfilled: {req.query}", price_paise, req.stock, json.dumps({"image_url": image_url}), utcnow())
            )
            product_id = prod_id
            product_title = title

        # Clear unmet demand signal for this query
        conn.execute("DELETE FROM demand_signals WHERE query = ?", (req.query,))

    return {"ok": True, "product_id": product_id, "product_title": product_title, "stock_added": req.stock}


@app.post("/api/admin/sourcing-rfp")
async def sourcing_rfp(req: SourcingRfpRequest):
    """Generate a supplier sourcing RFP for a high-demand gap item."""
    unit_budget = req.estimated_lost_paise // (req.signal_count * 100) if req.signal_count else 0
    draft = (
        f"Subject: Sourcing Enquiry — {req.query}\n\n"
        f"Hi Supplier,\n\n"
        f"We have received {req.signal_count} customer request(s) for a product not currently in our catalog:\n\n"
        f"Description: {req.query}\n"
        f"Category: {req.category or 'Unspecified'}\n"
        f"Target Budget: ₹{unit_budget} per unit\n"
        f"Estimated Demand Value: ₹{req.estimated_lost_paise // 100}\n\n"
        f"Please share availability, lead time, and minimum order quantity.\n\n"
        f"Regards,\nSynqora Sourcing Team"
    )
    source = "template"
    provider, key, _, model = get_ai_config()
    if key:
        try:
            data, source = await ai_chat({
                "model": model,
                "messages": [
                    {"role": "system", "content": "You are a professional procurement assistant. Write a formal supplier sourcing enquiry email. Be concise and professional. Do not add made-up numbers."},
                    {"role": "user", "content": (
                        f"Product needed: {req.query}. "
                        f"Category: {req.category or 'unspecified'}. "
                        f"Customer requests: {req.signal_count}. "
                        f"Estimated demand value: ₹{req.estimated_lost_paise // 100}. "
                        f"Write a supplier sourcing email."
                    )},
                ],
                "max_tokens": 400,
                "temperature": 0.3,
            })
            content = data["choices"][0]["message"].get("content")
            if content:
                draft = content.strip()
        except Exception:
            pass  # Fall back to template draft
    return {"draft": draft, "source": source}


# ── Gnani.ai Voice Commerce Engine (Phase 1: REST STT & Timbre v3.0 TTS) ─────

logger = logging.getLogger("shelfsense.voice")

# Timbre v3.0 verified voice catalogue by Indic language
GNANI_VOICES = {
    "kn-IN": "Shruthi",      # Kannada
    "hi-IN": "Shivani",      # Hindi
    "en-IN": "Priyasharm",   # Indian English
    "ta-IN": "Lakshmi",      # Tamil
    "te-IN": "Swathi",       # Telugu
    "mr-IN": "Sneha",        # Marathi
    "bn-IN": "Sohini",       # Bengali
    "gu-IN": "Vasudha",      # Gujarati
    "ml-IN": "Lakshmidevi",  # Malayalam
    "pa-IN": "Rajni",        # Punjabi
}

SUPPORTED_INDIC_LANGUAGES = [
    {"code": "indic-auto", "name": "Auto Detect (Indic)", "native": "Auto Detect"},
    {"code": "kn-IN", "name": "Kannada", "native": "ಕನ್ನಡ", "voice": "Shruthi"},
    {"code": "hi-IN", "name": "Hindi", "native": "हिन्दी", "voice": "Shivani"},
    {"code": "en-IN", "name": "English (India)", "native": "English", "voice": "Priyasharm"},
    {"code": "ta-IN", "name": "Tamil", "native": "தமிழ்", "voice": "Lakshmi"},
    {"code": "te-IN", "name": "Telugu", "native": "తెలుగు", "voice": "Swathi"},
    {"code": "mr-IN", "name": "Marathi", "native": "मराठी", "voice": "Sneha"},
    {"code": "bn-IN", "name": "Bengali", "native": "বাংলা", "voice": "Sohini"},
    {"code": "gu-IN", "name": "Gujarati", "native": "ગુજરાતી", "voice": "Vasudha"},
    {"code": "ml-IN", "name": "Malayalam", "native": "മലയാളം", "voice": "Lakshmidevi"},
    {"code": "pa-IN", "name": "Punjabi", "native": "ਪੰਜਾਬੀ", "voice": "Rajni"},
]

def pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 24000) -> bytes:
    """Wraps raw 16-bit linear PCM audio into a standard RIFF/WAV format."""
    if pcm_bytes.startswith(b"RIFF"):
        return pcm_bytes
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)
    return buf.getvalue()

# Catalogue domain keywords for Gnani Prisma keyword boosting (up to 200 terms supported)
VOICE_CATALOG_KEYPHRASES = (
    "ShelfSense, backpack, AeroShield, cordura, waterproof, windbreaker, jacket, commute, "
    "earbuds, charger, USB-C, GaN, bottle, sipper, shoes, runners, trail, stationery, "
    "organizer, laptop sleeve, rupee, paise, budget, discount, dispatch"
)


def get_gnani_config() -> dict[str, Any]:
    load_env_file()
    api_key = os.getenv("GNANI_API_KEY", "").strip()
    base_url = os.getenv("GNANI_BASE_URL", "https://api.vachana.ai").rstrip("/")
    stt_model = os.getenv("GNANI_STT_MODEL", "prisma-v3.0")
    stt_lang = os.getenv("GNANI_STT_LANGUAGE", "indic-auto")
    tts_model = os.getenv("GNANI_TTS_MODEL", "timbre-v3.0")
    voices = dict(GNANI_VOICES)
    if os.getenv("GNANI_TTS_VOICE_KN"):
        voices["kn-IN"] = os.getenv("GNANI_TTS_VOICE_KN").strip()
    if os.getenv("GNANI_TTS_VOICE_HI"):
        voices["hi-IN"] = os.getenv("GNANI_TTS_VOICE_HI").strip()
    if os.getenv("GNANI_TTS_VOICE_EN"):
        voices["en-IN"] = os.getenv("GNANI_TTS_VOICE_EN").strip()
    return {
        "api_key": api_key,
        "base_url": base_url,
        "stt_model": stt_model,
        "stt_lang": stt_lang,
        "tts_model": tts_model,
        "voices": voices,
        "configured": bool(api_key),
    }


def log_voice_demand_signal(query: str, filters: dict[str, Any], language: str = "en-IN") -> None:
    """Logs a voice-originated customer requirement to existing demand_signals schema."""
    try:
        with DbSession() as conn:
            attrs = dict(filters.get("required_attributes") or {})
            attrs["channel"] = "voice"
            attrs["provider"] = "gnani_prisma"
            attrs["language"] = language
            conn.execute(
                "INSERT INTO demand_signals (id, query, category, attributes_json, max_budget_paise, source, created_at) VALUES (?, ?, ?, ?, ?, 'voice', ?)",
                (
                    f"ds_{uuid.uuid4().hex[:12]}",
                    query[:400],
                    filters.get("category"),
                    json.dumps(attrs),
                    filters.get("max_price_paise"),
                    utcnow(),
                ),
            )
    except Exception as e:
        logger.warning(f"Failed to record voice demand signal: {e}")


class VoiceTranscribeRequest(BaseModel):
    audio_base64: str = Field(..., description="Base64 encoded audio string")
    content_type: str = Field("audio/wav", description="Audio MIME type")
    language_code: str = Field("indic-auto", description="Spoken language code or indic-auto")


class VoiceTtsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500, description="Clean text to synthesize to speech")
    language_code: str = Field("en-IN", description="Language code e.g. kn-IN, hi-IN, en-IN")
    voice: str | None = Field(None, description="Optional Timbre v3.0 voice override")


class VoiceShopRequest(BaseModel):
    audio_base64: str | None = None
    content_type: str = "audio/wav"
    transcript: str | None = None
    language_code: str = "indic-auto"


@app.get("/api/voice/status")
def voice_status():
    """Returns voice engine configuration status without exposing private API credentials."""
    cfg = get_gnani_config()
    return {
        "configured": cfg["configured"],
        "provider": "gnani" if cfg["configured"] else "browser_speech_fallback",
        "stt_model": cfg["stt_model"],
        "tts_model": cfg["tts_model"],
        "default_stt_language": cfg["stt_lang"],
        "supported_languages": SUPPORTED_INDIC_LANGUAGES,
    }


@app.post("/api/voice/stt")
async def voice_stt(
    request: Request,
    audio_file: UploadFile | None = File(None),
    language_code: str = Form("indic-auto"),
    req: VoiceTranscribeRequest | None = None,
):
    """
    Speech-to-Text via Gnani Prisma v3.0 (REST endpoint).
    Accepts either multipart audio_file OR JSON audio_base64.
    """
    cfg = get_gnani_config()
    if not cfg["configured"]:
        raise HTTPException(
            503,
            detail="Gnani AI voice service is not configured. Add GNANI_API_KEY to your .env file."
        )

    audio_bytes: bytes = b""
    content_type: str = "audio/wav"
    lang: str = language_code or cfg["stt_lang"]

    if audio_file is not None:
        audio_bytes = await audio_file.read()
        content_type = audio_file.content_type or "audio/wav"
    else:
        # Check if JSON payload was supplied directly
        b64_str = None
        if req is not None and req.audio_base64:
            b64_str = req.audio_base64
            content_type = req.content_type or "audio/wav"
            lang = req.language_code or lang
        elif request.headers.get("content-type", "").startswith("application/json"):
            try:
                body = await request.json()
                b64_str = body.get("audio_base64")
                content_type = body.get("content_type", "audio/wav")
                lang = body.get("language_code", lang)
            except Exception:
                pass

        if b64_str:
            try:
                if "," in b64_str:
                    b64_str = b64_str.split(",", 1)[1]
                audio_bytes = base64.b64decode(b64_str)
            except Exception as e:
                raise HTTPException(400, f"Malformed base64 audio data: {e}")
        else:
            raise HTTPException(400, "No audio payload provided. Send audio_file or audio_base64.")

    if len(audio_bytes) > 10 * 1024 * 1024:
        raise HTTPException(413, "Audio file exceeds maximum size limit of 10MB.")
    if len(audio_bytes) < 100:
        raise HTTPException(400, "Audio payload too small or empty.")

    headers = {
        "X-API-Key-ID": cfg["api_key"],
    }
    files = {
        "audio_file": ("audio.wav", audio_bytes, content_type),
    }
    data = {
        "model": cfg["stt_model"],
        "language_code": lang,
        "format": "transcribe",
        "keyphrase": VOICE_CATALOG_KEYPHRASES,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{cfg['base_url']}/stt/v3",
                headers=headers,
                files=files,
                data=data,
            )
            if resp.status_code == 401:
                raise HTTPException(502, "Gnani API key authentication failed. Check GNANI_API_KEY in .env.")
            elif resp.status_code == 402:
                raise HTTPException(502, "Gnani API account credits exhausted.")
            elif resp.status_code == 429:
                raise HTTPException(429, "Gnani API rate limit reached. Please wait a moment.")
            elif resp.status_code >= 400:
                raise HTTPException(502, f"Gnani Prisma STT failed with status {resp.status_code}: {resp.text}")

            result = resp.json()
            transcript = (
                result.get("transcript")
                or result.get("text")
                or (result.get("result", {}).get("transcript") if isinstance(result.get("result"), dict) else "")
                or ""
            ).strip()
            detected_lang = result.get("detected_language") or result.get("language_code") or lang
            confidence = float(result.get("confidence") or 0.95)

            return {
                "transcript": transcript,
                "detected_language": detected_lang,
                "confidence": confidence,
                "provider": "gnani_prisma",
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Gnani STT connection error: {e}")
        raise HTTPException(502, f"Voice recognition service unavailable: {e}")


@app.post("/api/voice/tts")
async def voice_tts(req: VoiceTtsRequest):
    """
    Text-to-Speech via Gnani Timbre v3.0 (REST endpoint).
    Returns synthesized audio bytes.
    """
    cfg = get_gnani_config()
    if not cfg["configured"]:
        raise HTTPException(
            503,
            detail="Gnani AI voice service is not configured. Add GNANI_API_KEY to your .env file."
        )

    clean_text = clean_text_reply(req.text)
    if not clean_text:
        raise HTTPException(400, "Empty text provided for speech synthesis.")

    target_lang = req.language_code or "en-IN"
    selected_voice = req.voice or cfg["voices"].get(target_lang) or "Priyasharm"

    headers = {
        "X-API-Key-ID": cfg["api_key"],
        "Content-Type": "application/json",
    }
    payload = {
        "text": clean_text,
        "model": cfg["tts_model"],
        "voice": selected_voice,
        "language": target_lang,
        "audio_format": "wav",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{cfg['base_url']}/api/v1/tts/inference",
                headers=headers,
                json=payload,
            )
            if resp.status_code == 401:
                raise HTTPException(502, "Gnani API authentication failed.")
            elif resp.status_code == 402:
                raise HTTPException(502, "Gnani account credits exhausted.")
            elif resp.status_code == 429:
                raise HTTPException(429, "Gnani TTS rate limit reached.")
            elif resp.status_code >= 400:
                raise HTTPException(502, f"Gnani Timbre TTS failed with status {resp.status_code}: {resp.text}")

            audio_bytes = pcm_to_wav(resp.content)

            return Response(
                content=audio_bytes,
                media_type="audio/wav",
                headers={"X-Gnani-Voice": selected_voice, "X-Gnani-Lang": target_lang},
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Gnani TTS error: {e}")
        raise HTTPException(502, f"Speech synthesis service error: {e}")


@app.post("/api/voice/shop")
async def voice_shop(req: VoiceShopRequest):
    """
    Unified Multilingual Voice Shopping Pipeline:
    1. Transcribes audio via Gnani Prisma v3.0 (or uses confirmed transcript).
    2. Runs Gemini Flash-Lite intent search against live catalog inventory.
    3. If unstocked, logs demand signal into demand_signals table.
    4. Generates spoken AI recommendation via Gnani Timbre v3.0 if configured.
    """
    cfg = get_gnani_config()
    transcript = (req.transcript or "").strip()
    detected_lang = req.language_code or "indic-auto"

    # Step 1: Speech-to-Text if audio payload was provided
    if not transcript and req.audio_base64:
        stt_res = await voice_stt(
            request=Request(scope={"type": "http"}),
            audio_file=None,
            language_code=req.language_code,
            req=VoiceTranscribeRequest(
                audio_base64=req.audio_base64,
                content_type=req.content_type,
                language_code=req.language_code,
            ),
        )
        transcript = stt_res.get("transcript", "")
        detected_lang = stt_res.get("detected_language", detected_lang)

    if not transcript:
        raise HTTPException(400, "Could not extract or transcribe speech input.")

    # Step 2: Pass transcript to existing AI Intent Shopping engine
    ai_res = await ai_shop(ShopRequest(message=transcript), request=Request(scope={"type": "http"}))

    products = ai_res.get("products", [])
    reply = ai_res.get("reply", "")
    filters = ai_res.get("filters", {})

    # Step 3: Record Voice Demand Signal if catalog gap detected
    demand_logged = False
    if not products:
        log_voice_demand_signal(transcript, filters, language=detected_lang)
        demand_logged = True

    # Step 4: Optional TTS audio synthesis if Gnani is active
    tts_audio_base64 = None
    if cfg["configured"] and reply:
        try:
            target_voice = cfg["voices"].get(detected_lang) or "Priyasharm"
            tts_headers = {"X-API-Key-ID": cfg["api_key"], "Content-Type": "application/json"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                t_resp = await client.post(
                    f"{cfg['base_url']}/api/v1/tts/inference",
                    headers=tts_headers,
                    json={
                        "text": reply,
                        "model": cfg["tts_model"],
                        "voice": target_voice,
                        "language": detected_lang if detected_lang != "indic-auto" else "en-IN",
                        "audio_format": "wav",
                    },
                )
                if t_resp.status_code == 200:
                    wav_content = pcm_to_wav(t_resp.content)
                    tts_audio_base64 = base64.b64encode(wav_content).decode("ascii")
        except Exception as e:
            logger.warning(f"Voice shop TTS generation skipped: {e}")

    return {
        "transcript": transcript,
        "detected_language": detected_lang,
        "reply": reply,
        "products": products,
        "demand_logged": demand_logged,
        "filters": filters,
        "audio_base64": tts_audio_base64,
        "provider": "gnani_prisma" if cfg["configured"] else "fallback",
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
