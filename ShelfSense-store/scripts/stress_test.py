#!/usr/bin/env python3
"""Concurrency demo: 50 checkout attempts against stock=5 must not oversell."""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import urllib.error
import urllib.request
import uuid

BASE = os.getenv("BASE_URL", "http://127.0.0.1:8000")


def request(method: str, path: str, payload: dict | None = None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode())
        except Exception:
            body = {}
        return e.code, body


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--product", default="prod_001")
    parser.add_argument("--stock", type=int, default=5)
    parser.add_argument("--attempts", type=int, default=50)
    args = parser.parse_args()

    status, _ = request("POST", f"/api/admin/products/{args.product}/stock", {"stock": args.stock})
    if status != 200:
        raise SystemExit(f"Could not reset stock: {status}")

    def attempt(i: int):
        return request("POST", "/api/checkout", {
            "items": [{"product_id": args.product, "quantity": 1}],
            "idempotency_key": f"stress-{uuid.uuid4().hex}",
            "customer_name": f"Stress {i}",
        })

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.attempts) as pool:
        results = list(pool.map(attempt, range(args.attempts)))

    success = sum(1 for status, _ in results if status == 200)
    rejected = sum(1 for status, _ in results if status == 409)
    other = len(results) - success - rejected
    status, product = request("GET", f"/api/products/{args.product}")
    final_stock = product.get("stock") if status == 200 else "unknown"

    print(f"Attempts: {args.attempts}")
    print(f"Successful orders: {success}")
    print(f"Rejected (insufficient stock): {rejected}")
    print(f"Other responses: {other}")
    print(f"Final stock: {final_stock}")
    ok = success == args.stock and rejected == args.attempts - args.stock and other == 0 and final_stock == 0
    print("PASS ✅" if ok else "FAIL ❌")
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
