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
import json
import os
import re
import sqlite3
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
DB_PATH = Path(os.getenv("DATABASE_PATH", BASE_DIR / "store.db"))
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
            if key and key not in os.environ:
                os.environ[key] = value


load_env_file()
STEPFUN_API_KEY = os.getenv("STEPFUN_API_KEY", "").strip()
STEPFUN_BASE_URL = os.getenv("STEPFUN_BASE_URL", "https://api.stepfun.ai/v1").rstrip("/")
STEPFUN_MODEL = os.getenv("STEPFUN_MODEL", "step-3.7-flash")
DB_PATH = Path(os.getenv("DATABASE_PATH", BASE_DIR / "store.db"))
LOW_STOCK_THRESHOLD = int(os.getenv("LOW_STOCK_THRESHOLD", "10"))


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=30000")
    return conn


class DbSession:
    """Context manager that commits/rolls back and always closes the connection."""

    def __enter__(self) -> sqlite3.Connection:
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
    limit = max(1, min(int(limit or 6), 12))
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
    products = [row_to_product(r) for r in rows]
    required_attributes = required_attributes or {}
    if required_attributes:
        products = [p for p in products if all(p["attributes"].get(k) == v for k, v in required_attributes.items())]
    def score(p: dict[str, Any]) -> tuple:
        matched = sum(1 for k, v in required_attributes.items() if p["attributes"].get(k) == v)
        return (-matched, -p["stock"], p["price_paise"])
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


async def stepfun_chat(payload: dict[str, Any]) -> dict[str, Any]:
    if not STEPFUN_API_KEY:
        raise RuntimeError("STEPFUN_API_KEY is not configured")
    async with httpx.AsyncClient(timeout=AI_TIMEOUT_SECONDS) as client:
        resp = await client.post(
            f"{STEPFUN_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {STEPFUN_API_KEY}", "Content-Type": "application/json"},
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


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
    return {"ok": True, "ai_configured": bool(STEPFUN_API_KEY), "model": STEPFUN_MODEL if STEPFUN_API_KEY else None, "low_stock_threshold": LOW_STOCK_THRESHOLD}


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
    if STEPFUN_API_KEY:
        try:
            data = await stepfun_chat({
                "model": STEPFUN_MODEL,
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
                source = "stepfun"
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


@app.post("/api/ai/shop")
async def ai_shop(req: ShopRequest, request: Request):
    filters = local_intent(req.message)
    products: list[dict[str, Any]] = []
    reply = ""
    source = "fallback"
    if STEPFUN_API_KEY:
        try:
            user_content: Any = req.message
            if req.image_base64:
                user_content = [
                    {"type": "text", "text": req.message},
                    {"type": "image_url", "image_url": {"url": f"data:{req.image_media_type or 'image/jpeg'};base64,{req.image_base64}"}},
                ]
            messages = [
                {"role": "system", "content": "You are Synqora ShelfSense, a shopping assistant for an Indian online store. Use the search_products tool for product requests. Prices are in INR paise. Recommend only products returned by the tool. If none match, say so honestly and suggest relaxing one constraint. Keep replies under 120 words."},
                {"role": "user", "content": user_content},
            ]
            data = await stepfun_chat({"model": STEPFUN_MODEL, "messages": messages, "tools": [SEARCH_TOOL], "tool_choice": "auto", "max_tokens": 700, "temperature": 0.2})
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
                messages.append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps({"products": products, "no_results_reason": None if products else "No catalog product matched all constraints."})})
                follow = await stepfun_chat({"model": STEPFUN_MODEL, "messages": messages, "max_tokens": 300, "temperature": 0.2})
                reply = (follow["choices"][0]["message"].get("content") or "").strip()
                source = "stepfun"
            else:
                products = search_products(**filters)
                reply = (msg.get("content") or "").strip()
                source = "stepfun_no_tool"
        except Exception:
            products = []
            reply = ""
            source = "fallback"
    if not products and source in ("fallback", "stepfun_no_tool"):
        products = search_products(**filters)
    # Auto-log demand signal when no products matched after all attempts
    if not products:
        _log_demand_signal(filters.get("query", req.message), filters)
    if not reply:
        if products:
            reply = f"I found {len(products)} in-stock option(s) that match your request. The closest match is {products[0]['title']} at ₹{products[0]['price_paise'] / 100:,.0f}."
        else:
            reply = "I could not find an in-stock product matching all of those constraints. Try increasing the budget or removing one requirement."
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
            """SELECT query, category, attributes_json, max_budget_paise,
                      COUNT(*) AS signal_count,
                      MIN(created_at) AS first_seen,
                      MAX(created_at) AS last_seen
               FROM demand_signals
               GROUP BY lower(query), category, max_budget_paise
               ORDER BY signal_count DESC
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
    return {"signals": signals, "total": len(signals)}


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
    if STEPFUN_API_KEY:
        try:
            data = await stepfun_chat({
                "model": STEPFUN_MODEL,
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
                source = "stepfun"
        except Exception:
            pass  # Fall back to template draft
    return {"draft": draft, "source": source}
