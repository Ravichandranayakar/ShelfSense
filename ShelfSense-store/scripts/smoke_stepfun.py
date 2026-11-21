#!/usr/bin/env python3
"""Smoke-test StepFun/OpenRouter access without exposing the key."""
from __future__ import annotations

import json
import os
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
for env_path in (ROOT / ".env", ROOT / "backend" / ".env"):
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

KEY = os.getenv("STEPFUN_API_KEY", "")
BASE = os.getenv("STEPFUN_BASE_URL", "https://api.stepfun.ai/v1").rstrip("/")
MODEL = os.getenv("STEPFUN_MODEL", "step-3.7-flash")

if not KEY:
    raise SystemExit("Set STEPFUN_API_KEY in synqora-store/.env first.")

headers = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

with httpx.Client(timeout=30) as client:
    print(f"Base URL: {BASE}")
    print(f"Model: {MODEL}")
    try:
        r = client.get(f"{BASE}/models", headers=headers)
        print(f"GET /models -> {r.status_code}")
        if r.status_code == 200:
            ids = [m.get("id") for m in r.json().get("data", [])][:20]
            print("Sample model IDs:", json.dumps(ids, indent=2))
    except Exception as e:
        print("Model list check failed:", e)

    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": "Reply with exactly: SYNQORA_OK"}],
        "max_tokens": 20,
        "temperature": 0,
    }
    r = client.post(f"{BASE}/chat/completions", headers=headers, json=payload)
    print(f"POST /chat/completions -> {r.status_code}")
    if r.status_code != 200:
        print(r.text[:500])
        raise SystemExit(1)
    content = r.json()["choices"][0]["message"].get("content", "")
    print("Response:", content)
    print("PASS ✅" if "SYNQORA_OK" in content else "CHECK RESPONSE ⚠️")
