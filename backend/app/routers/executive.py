from fastapi import APIRouter, HTTPException, Query

from .. import storage
from ..filters import get_report_products
from ..product import Product
from ..utils import has_price, is_complete, is_empty, is_priority, kpi_score, stores_of

router = APIRouter(prefix="/api/reports", tags=["executive"])


def _visible(r: Product) -> bool:
    return (r.estado_sl or "").strip().lower() == "visible"


def _draft(r: Product) -> bool:
    return (r.estado_sl or "").strip().lower() == "draft"


def _metrics(rows: list[Product]) -> dict:
    total = len(rows)
    return {
        "total": total,
        "kpi_score": kpi_score(rows),
        "visibles": sum(1 for r in rows if _visible(r)),
        "drafts": sum(1 for r in rows if _draft(r)),
        "completos": sum(1 for r in rows if is_complete(r)),
        # Prioridad: con foto pero ficha incompleta — lo mas rapido de cerrar
        "prioridad": sum(1 for r in rows if is_priority(r)),
        "con_precio": sum(1 for r in rows if has_price(r.precio_regular)),
        "sin_foto": sum(1 for r in rows if is_empty(r.foto_descriptiva_sl)),
        "sin_familia": sum(1 for r in rows if is_empty(r.familia)),
        "sin_categoria": sum(1 for r in rows if is_empty(r.categoria_ecommerce)),
        "sin_nombre": sum(1 for r in rows if is_empty(r.nombre)),
    }


def _deltas(cur: dict, prev: dict | None) -> dict | None:
    if prev is None:
        return None
    out = {}
    for k, v in cur.items():
        pv = prev.get(k, 0)
        d = round(v - pv, 2) if isinstance(v, float) else v - pv
        out[k] = d
    return out


def _group_by_store(rows: list[Product]) -> dict[str, list[Product]]:
    d: dict[str, list[Product]] = {}
    for r in rows:
        for s in stores_of(r.website):
            d.setdefault(s, []).append(r)
    return d


@router.get("/{report_id}/executive")
def executive(
    report_id: int,
    compare_id: int | None = Query(None, description="Reporte contra el que comparar. Si se omite, usa el inmediatamente anterior."),
):
    """Resumen ejecutivo: metricas globales y por website, cada una con su
    delta contra un reporte de comparacion. Por defecto es el inmediatamente
    anterior (por fecha del reporte), pero se puede elegir otro con compare_id."""
    meta = storage.get_report_meta(report_id)
    if not meta:
        raise HTTPException(404, "Reporte no encontrado")

    if compare_id is not None:
        prev_meta = storage.get_report_meta(compare_id)
        if not prev_meta:
            raise HTTPException(404, "Reporte de comparación no encontrado")
    else:
        all_reports = sorted(storage.list_reports(), key=storage.report_sort_key)
        idx = next((i for i, m in enumerate(all_reports) if m["id"] == report_id), None)
        prev_meta = all_reports[idx - 1] if idx and idx > 0 else None

    cur_rows = get_report_products(report_id)
    prev_rows = get_report_products(prev_meta["id"]) if prev_meta else []

    cur_global = _metrics(cur_rows)
    prev_global = _metrics(prev_rows) if prev_meta else None

    cur_stores = _group_by_store(cur_rows)
    prev_stores = _group_by_store(prev_rows) if prev_meta else {}
    all_store_names = sorted(set(cur_stores.keys()) | set(prev_stores.keys()))

    stores_out = []
    for name in all_store_names:
        cur_m = _metrics(cur_stores.get(name, []))
        prev_m = _metrics(prev_stores.get(name, [])) if prev_meta else None
        stores_out.append({"name": name, **cur_m, "delta": _deltas(cur_m, prev_m)})
    stores_out.sort(key=lambda s: -s["total"])

    return {
        "current": meta,
        "previous": prev_meta,
        "global": {**cur_global, "delta": _deltas(cur_global, prev_global)},
        "stores": stores_out,
    }
