"""Exercise a deployment with temporary records; secrets stay in backend/.env."""

import json
import os
import sys
import uuid
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from dotenv import dotenv_values
from sqlalchemy import create_engine, text

config = dotenv_values(ROOT / "backend/.env")
base = sys.argv[1].rstrip("/")
regional_password = os.environ.get("REGIONAL_DEFAULT_PASSWORD") or config.get(
    "REGIONAL_DEFAULT_PASSWORD"
)
if not regional_password:
    raise RuntimeError("Set REGIONAL_DEFAULT_PASSWORD for regional smoke tests")
token = None
r13_region_id = None
category_id = None
item_id = None
transaction_ids = []
references = []


def call(path, method="GET", body=None, form=False, expected=200):
    path = path.rstrip("/")
    headers = {}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = None
    if body is not None:
        data = (urlencode(body) if form else json.dumps(body)).encode()
        headers["Content-Type"] = (
            "application/x-www-form-urlencoded" if form else "application/json"
        )
    try:
        response = urlopen(Request(base + path, data=data, headers=headers, method=method), timeout=60)
    except HTTPError as exc:
        response = exc
    raw = response.read()
    assert response.status == expected, f"{method} {path}: expected {expected}, got {response.status}"
    if "application/json" in response.headers.get("Content-Type", ""):
        return json.loads(raw)
    return raw


try:
    health = call("/api/health")
    assert health["database"] == "connected"
    call("/api/items/", expected=401)
    login = call("/api/auth/login", "POST", {
        "username": "admin_r13",
        "password": regional_password,
    }, form=True)
    token = login["access_token"]
    r13_token = token
    assert login["user"]["region_name"] == "Regional Office XIII"
    r13_region_id = login["user"]["region_id"]
    r1_login = call("/api/auth/login", "POST", {
        "username": "admin_r1",
        "password": regional_password,
    }, form=True)
    token = r1_login["access_token"]
    assert call("/api/categories/") == []
    token = r13_token
    print("PASS health, database connectivity, regional authentication/isolation")
    category = call("/api/categories/", "POST", {"name": "Deployment verification " + uuid.uuid4().hex}, expected=201)
    category_id = category["id"]
    item = call("/api/items/", "POST", {"name": "Temporary deployment verification", "category_id": category_id, "quantity": 0, "unit": "piece"}, expected=201)
    item_id = item["id"]
    for path, quantity in [("in", 20), ("out", 5)]:
        txn = call("/api/transactions/" + path, "POST", {"item_id": item_id, "quantity": quantity}, expected=201)
        transaction_ids.append(txn["id"])
        references.append(txn["reference_number"])
    assert call("/api/items/" + item_id)["quantity"] == 15
    call("/api/transactions/out", "POST", {"item_id": item_id, "quantity": 100}, expected=400)
    print("PASS item creation, stock-in/out, insufficient-stock rejection")
    call("/api/analytics/summary")
    reports = call("/api/reports/files")
    for reference in references:
        name = reference + ".pdf"
        assert any(r["name"] == name for r in reports), "Missing generated PDF"
        assert call("/api/reports/files/" + name).startswith(b"%PDF")
    backup = call("/api/backup/download")
    assert backup["format"] == "philfida-inventory-json"
    print("PASS analytics, persisted PDFs, PDF download, backup")
finally:
    if category_id:
        engine = create_engine(config["DATABASE_URL"], connect_args={"prepare_threshold": None})
        with engine.begin() as connection:
            # The runtime role is protected by region-scoped RLS, including
            # direct cleanup statements. Scope this verification cleanup to
            # the temporary Regional Office XIII records only.
            connection.execute(
                text("select set_config('app.region_id', :region_id, false)"),
                {"region_id": r13_region_id},
            )
            for reference in references:
                connection.execute(text("DELETE FROM report_documents WHERE name=:name"), {"name": reference + ".pdf"})
            for entity_id in transaction_ids + ([item_id] if item_id else []) + [category_id]:
                connection.execute(text("DELETE FROM audit_logs WHERE entity_id=:id"), {"id": entity_id})
            if item_id:
                connection.execute(text("DELETE FROM transactions WHERE item_id=:id"), {"id": item_id})
                connection.execute(text("DELETE FROM items WHERE id=:id"), {"id": item_id})
            connection.execute(text("DELETE FROM categories WHERE id=:id"), {"id": category_id})
        engine.dispose()
        print("Removed only temporary verification records; login audit and allocated numbers retained.")
