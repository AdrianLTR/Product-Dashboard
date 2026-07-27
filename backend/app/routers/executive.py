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


# Predicado por indicador, para poder responder "cuales entraron/salieron"
_INDICATOR_PREDICATES = {
    "visibles": _visible,
    "drafts": _draft,
    "completos": is_complete,
    "prioridad": is_priority,
    "con_precio": lambda r: has_price(r.precio_regular),
    "sin_foto": lambda r: is_empty(r.foto_descriptiva_sl),
    "sin_familia": lambda r: is_empty(r.familia),
    "sin_categoria": lambda r: is_empty(r.categoria_ecommerce),
    "sin_nombre": lambda r: is_empty(r.nombre),
    "total": lambda r: True,
}


def _as_dict(rows: list[Product]) -> dict[str, Product]:
    return {r.sku: r for r in rows if r.sku}


@router.get("/{report_id}/executive-delta")
def executive_delta(
    report_id: int,
    indicator: str = Query(..., description="visibles|drafts|completos|prioridad|con_precio|sin_foto|sin_familia|sin_categoria|sin_nombre|total"),
    compare_id: int | None = Query(None),
    website: str | None = Query(None, description="Acotar a un website; si se omite, es global"),
    limit: int = Query(1000, ge=1, le=5000),
):
    """Detalle del delta de un indicador: que SKUs ENTRARON al indicador y
    cuales SALIERON entre el reporte de comparacion y el actual. Es lo que
    hay detras del '+15' que muestra el Resumen Ejecutivo."""
    pred = _INDICATOR_PREDICATES.get(indicator)
    if not pred:
        raise HTTPException(400, f"Indicador desconocido: {indicator}")
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

    if website:
        cur_rows = [r for r in cur_rows if website in stores_of(r.website)]
        prev_rows = [r for r in prev_rows if website in stores_of(r.website)]

    cur_idx = _as_dict(cur_rows)
    prev_idx = _as_dict(prev_rows)

    cur_in = {sku for sku, r in cur_idx.items() if pred(r)}
    prev_in = {sku for sku, r in prev_idx.items() if pred(r)}

    def _row(sku: str, source: dict[str, Product]) -> dict:
        r = source[sku]
        return {
            "sku": r.sku,
            "nombre": r.nombre,
            "departamento": r.departamento,
            "familia": r.familia,
            "categoria_ecommerce": r.categoria_ecommerce,
            "marca": r.marca,
            "estado_sl": r.estado_sl,
            "etiquetas_sl": r.etiquetas_sl,
            "foto_descriptiva_sl": r.foto_descriptiva_sl,
            "precio_regular": r.precio_regular,
            "website": r.website,
            # Un SKU que no existia en el reporte anterior es nuevo del catalogo,
            # no solo "entro al indicador" — util para distinguirlos en la tabla.
            "es_sku_nuevo": sku not in prev_idx,
        }

    entraron = sorted(cur_in - prev_in)
    salieron = sorted(prev_in - cur_in)

    return {
        "indicator": indicator,
        "website": website,
        "current": meta,
        "previous": prev_meta,
        "count_before": len(prev_in),
        "count_after": len(cur_in),
        "delta": len(cur_in) - len(prev_in),
        "entraron_count": len(entraron),
        "salieron_count": len(salieron),
        "entraron": [_row(s, cur_idx) for s in entraron[:limit]],
        "salieron": [_row(s, prev_idx) for s in salieron[:limit]],
    }
