from fastapi import APIRouter, HTTPException

from .. import storage
from ..filters import get_report_products
from ..product import Product
from ..utils import has_price, is_empty, stores_of

router = APIRouter(prefix="/api/reports/{report_id}/stores", tags=["stores"])

COMPLETENESS_FIELDS = [
    "nombre",
    "familia",
    "categoria_ecommerce",
    "descripcion_detallada",
    "foto_descriptiva_sl",
    "website",
    "estado_sl",
]


def _is_complete(r: Product) -> bool:
    return all(not is_empty(getattr(r, f)) for f in COMPLETENESS_FIELDS)


def _metrics(rows: list[Product]) -> dict:
    total = len(rows)
    comp = sum(1 for r in rows if _is_complete(r))
    no_fam = sum(1 for r in rows if is_empty(r.familia))
    no_cat = sum(1 for r in rows if is_empty(r.categoria_ecommerce))
    no_foto = sum(1 for r in rows if is_empty(r.foto_descriptiva_sl))
    con_precio = sum(1 for r in rows if has_price(r.precio_regular))
    return {
        "total": total,
        "completos": comp,
        "sin_familia": no_fam,
        "sin_categoria": no_cat,
        "sin_foto": no_foto,
        "con_precio": con_precio,
        "sin_precio": total - con_precio,
        "completos_pct": round(comp / total * 100) if total else 0,
    }


@router.get("")
def store_metrics(report_id: int):
    if not storage.get_report_meta(report_id):
        raise HTTPException(404, "Reporte no encontrado")

    rows = get_report_products(report_id)
    by_store: dict[str, list[Product]] = {}
    for r in rows:
        for store in stores_of(r.website):
            by_store.setdefault(store, []).append(r)

    return {
        "stores": [
            {"name": name, **_metrics(products)}
            for name, products in sorted(by_store.items(), key=lambda kv: -len(kv[1]))
        ]
    }
