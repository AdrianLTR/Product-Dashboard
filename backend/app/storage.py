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

# Cache en memoria de productos por reporte. Un reporte es inmutable (solo se
# crea o se borra completo), asi que cachear es seguro. Con reportes de 25 MB
# releer y reparsear el JSON en cada request satura el proceso, sobre todo si
# el frontend dispara una peticion por tecla. El cache reduce respuesta de
# ~decenas de ms a menos de 1 ms por request tras la primera carga.
_products_cache: dict[int, list[Product]] = {}


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
    _products_cache[report_id] = products  # ya los tenemos parseados, aprovechamos
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
    cached = _products_cache.get(report_id)
    if cached is not None:
        return cached
    p = _report_path(report_id)
    if not p.exists():
        return []
    data = json.loads(p.read_text(encoding="utf-8"))
    products = [Product.from_dict(row) for row in data["products"]]
    _products_cache[report_id] = products
    return products


def delete_report(report_id: int) -> bool:
    p = _report_path(report_id)
    if not p.exists():
        return False
    p.unlink()
    _products_cache.pop(report_id, None)
    return True
