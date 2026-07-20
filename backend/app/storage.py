import datetime
import json
import os
from pathlib import Path
from threading import Lock

from .product import Product

# Sin motor de base de datos: cada reporte es un archivo JSON plano en disco.
# Fuera de OneDrive por la misma razon que se evitaba con SQLite (escritura
# constante bajo un directorio sincronizado). Configurable con
# PRODUCT_HUB_DATA_DIR si hace falta otra ubicacion (ej. el servidor de LAN).
DEFAULT_DATA_DIR = Path.home() / ".local" / "product_hub_data"
DATA_DIR = Path(os.environ.get("PRODUCT_HUB_DATA_DIR", DEFAULT_DATA_DIR))
REPORTS_DIR = DATA_DIR / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
COUNTER_FILE = DATA_DIR / "_next_id.txt"

_lock = Lock()  # evita choques si dos cargas llegan al mismo tiempo


def _report_path(report_id: int) -> Path:
    return REPORTS_DIR / f"{report_id}.json"


def _next_id() -> int:
    with _lock:
        current = int(COUNTER_FILE.read_text().strip()) if COUNTER_FILE.exists() else 0
        nxt = current + 1
        COUNTER_FILE.write_text(str(nxt))
        return nxt


def save_report(filename: str, products: list[Product]) -> dict:
    report_id = _next_id()
    meta = {
        "id": report_id,
        "filename": filename,
        "uploaded_at": datetime.datetime.utcnow().isoformat(),
        "row_count": len(products),
    }
    payload = {"meta": meta, "products": [p.to_dict() for p in products]}
    _report_path(report_id).write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return meta


def list_reports() -> list[dict]:
    metas = []
    for f in REPORTS_DIR.glob("*.json"):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        metas.append(data["meta"])
    metas.sort(key=lambda m: m["uploaded_at"], reverse=True)
    return metas


def get_report_meta(report_id: int) -> dict | None:
    p = _report_path(report_id)
    if not p.exists():
        return None
    data = json.loads(p.read_text(encoding="utf-8"))
    return data["meta"]


def get_report_products(report_id: int) -> list[Product]:
    p = _report_path(report_id)
    if not p.exists():
        return []
    data = json.loads(p.read_text(encoding="utf-8"))
    return [Product.from_dict(row) for row in data["products"]]


def delete_report(report_id: int) -> bool:
    p = _report_path(report_id)
    if not p.exists():
        return False
    p.unlink()
    return True
