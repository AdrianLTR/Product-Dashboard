from fastapi import APIRouter, HTTPException, Query

from .. import storage
from ..filters import get_report_products, parse_sku_list
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


def _as_dict(rows: list[Product]) -> dict[str, Product]:
    return {r.sku: r for r in rows if r.sku}


def _filter_by_skus(rows: list[Product], skus: str | None) -> list[Product]:
    parsed = parse_sku_list(skus)
    if not parsed:
        return rows
    sku_set = {s.lower() for s in parsed}
    return [r for r in rows if (r.sku or "").strip().lower() in sku_set]


def _cross_report_counts(cur_idx: dict, prev_idx: dict) -> dict:
    """Computa entrantes, salientes y foto_nueva comparando dos indices de SKU."""
    cur_skus = set(cur_idx)
    prev_skus = set(prev_idx)
    common = cur_skus & prev_skus
    foto_nueva = sum(
        1 for sku in common
        if is_empty(prev_idx[sku].foto_descriptiva_sl)
        and not is_empty(cur_idx[sku].foto_descriptiva_sl)
    )
    return {
        "entrantes": len(cur_skus - prev_skus),
        "salientes": len(prev_skus - cur_skus),
        "foto_nueva": foto_nueva,
    }


def _resolve_previous(report_id: int, compare_id: int | None):
    if compare_id is not None:
        prev_meta = storage.get_report_meta(compare_id)
        if not prev_meta:
            raise HTTPException(404, "Reporte de comparación no encontrado")
        return prev_meta
    all_reports = sorted(storage.list_reports(), key=storage.report_sort_key)
    idx = next((i for i, m in enumerate(all_reports) if m["id"] == report_id), None)
    return all_reports[idx - 1] if idx and idx > 0 else None


@router.get("/{report_id}/executive")
def executive(
    report_id: int,
    compare_id: int | None = Query(None, description="Reporte contra el que comparar. Si se omite, usa el inmediatamente anterior."),
    skus: str | None = Query(None, description="Lista de SKUs para filtrar (separados por coma, espacio o salto de linea)"),
):
    meta = storage.get_report_meta(report_id)
    if not meta:
        raise HTTPException(404, "Reporte no encontrado")

    prev_meta = _resolve_previous(report_id, compare_id)

    cur_rows = _filter_by_skus(get_report_products(report_id), skus)
    prev_rows = _filter_by_skus(get_report_products(prev_meta["id"]), skus) if prev_meta else []

    # SKUs que el usuario pego pero no aparecen en ninguno de los dos reportes
    parsed_skus = parse_sku_list(skus)
    if parsed_skus:
        found = {(r.sku or "").strip().lower() for r in cur_rows} | {(r.sku or "").strip().lower() for r in prev_rows}
        skus_no_encontrados = [s for s in parsed_skus if s.lower() not in found]
    else:
        skus_no_encontrados = []

    cur_global = _metrics(cur_rows)
    prev_global = _metrics(prev_rows) if prev_meta else None

    # Entrantes/salientes/foto_nueva globales
    cur_idx = _as_dict(cur_rows)
    prev_idx = _as_dict(prev_rows) if prev_meta else {}
    cross = _cross_report_counts(cur_idx, prev_idx) if prev_meta else {"entrantes": 0, "salientes": 0, "foto_nueva": 0}

    cur_stores = _group_by_store(cur_rows)
    prev_stores = _group_by_store(prev_rows) if prev_meta else {}
    all_store_names = sorted(set(cur_stores.keys()) | set(prev_stores.keys()))

    stores_out = []
    for name in all_store_names:
        cur_m = _metrics(cur_stores.get(name, []))
        prev_m = _metrics(prev_stores.get(name, [])) if prev_meta else None
        store_cross = (
            _cross_report_counts(
                _as_dict(cur_stores.get(name, [])),
                _as_dict(prev_stores.get(name, [])),
            )
            if prev_meta
            else {"entrantes": 0, "salientes": 0, "foto_nueva": 0}
        )
        stores_out.append({"name": name, **cur_m, **store_cross, "delta": _deltas(cur_m, prev_m)})
    stores_out.sort(key=lambda s: -s["total"])

    return {
        "current": meta,
        "previous": prev_meta,
        "global": {**cur_global, **cross, "delta": _deltas(cur_global, prev_global)},
        "stores": stores_out,
        "skus_no_encontrados": skus_no_encontrados,
    }


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

# Indicadores especiales que dependen de comparar dos reportes
_CROSS_INDICATORS = {"entrantes", "salientes", "foto_nueva"}


def _row(sku: str, source: dict[str, Product], prev_idx: dict[str, Product] | None = None) -> dict:
    r = source[sku]
    es_foto_nueva = False
    if prev_idx and sku in prev_idx:
        es_foto_nueva = is_empty(prev_idx[sku].foto_descriptiva_sl) and not is_empty(r.foto_descriptiva_sl)
    return {
        "sku": r.sku,
        "nombre": r.nombre,
        "departamento": getattr(r, "departamento", None),
        "descripcion_sap": getattr(r, "descripcion_sap", None),
        "familia": r.familia,
        "categoria_ecommerce": r.categoria_ecommerce,
        "marca": r.marca,
        "estado_sl": r.estado_sl,
        "etiquetas_sl": r.etiquetas_sl,
        "foto_descriptiva_sl": r.foto_descriptiva_sl,
        "precio_regular": r.precio_regular,
        "website": r.website,
        "es_sku_nuevo": prev_idx is not None and sku not in prev_idx,
        "es_foto_nueva": es_foto_nueva,
    }


@router.get("/{report_id}/executive-delta")
def executive_delta(
    report_id: int,
    indicator: str = Query(..., description="visibles|drafts|completos|prioridad|con_precio|sin_foto|sin_familia|sin_categoria|sin_nombre|total|entrantes|salientes|foto_nueva"),
    compare_id: int | None = Query(None),
    website: str | None = Query(None, description="Acotar a un website; si se omite, es global"),
    skus: str | None = Query(None, description="Lista de SKUs para filtrar"),
    limit: int = Query(1000, ge=1, le=5000),
):
    if indicator not in _INDICATOR_PREDICATES and indicator not in _CROSS_INDICATORS:
        raise HTTPException(400, f"Indicador desconocido: {indicator}")

    meta = storage.get_report_meta(report_id)
    if not meta:
        raise HTTPException(404, "Reporte no encontrado")

    prev_meta = _resolve_previous(report_id, compare_id)

    cur_rows = _filter_by_skus(get_report_products(report_id), skus)
    prev_rows = _filter_by_skus(get_report_products(prev_meta["id"]), skus) if prev_meta else []

    if website:
        cur_rows = [r for r in cur_rows if website in stores_of(r.website)]
        prev_rows = [r for r in prev_rows if website in stores_of(r.website)]

    cur_idx = _as_dict(cur_rows)
    prev_idx = _as_dict(prev_rows)

    base_response = {
        "indicator": indicator,
        "website": website,
        "current": meta,
        "previous": prev_meta,
    }

    # Indicadores especiales: diferencia de conjuntos entre reportes
    if indicator == "entrantes":
        entraron = sorted(set(cur_idx) - set(prev_idx))
        return {
            **base_response,
            "count_before": 0,
            "count_after": len(entraron),
            "delta": len(entraron),
            "entraron_count": len(entraron),
            "salieron_count": 0,
            "entraron": [_row(s, cur_idx, prev_idx) for s in entraron[:limit]],
            "salieron": [],
        }
    if indicator == "salientes":
        salieron = sorted(set(prev_idx) - set(cur_idx))
        return {
            **base_response,
            "count_before": len(salieron),
            "count_after": 0,
            "delta": -len(salieron),
            "entraron_count": 0,
            "salieron_count": len(salieron),
            "entraron": [],
            "salieron": [_row(s, prev_idx, None) for s in salieron[:limit]],
        }
    if indicator == "foto_nueva":
        common = set(cur_idx) & set(prev_idx)
        entraron = sorted(
            sku for sku in common
            if is_empty(prev_idx[sku].foto_descriptiva_sl)
            and not is_empty(cur_idx[sku].foto_descriptiva_sl)
        )
        return {
            **base_response,
            "count_before": 0,
            "count_after": len(entraron),
            "delta": len(entraron),
            "entraron_count": len(entraron),
            "salieron_count": 0,
            "entraron": [_row(s, cur_idx, prev_idx) for s in entraron[:limit]],
            "salieron": [],
        }

    # Indicadores basados en predicado sobre un solo reporte
    pred = _INDICATOR_PREDICATES[indicator]
    cur_in = {sku for sku, r in cur_idx.items() if pred(r)}
    prev_in = {sku for sku, r in prev_idx.items() if pred(r)}

    entraron = sorted(cur_in - prev_in)
    salieron = sorted(prev_in - cur_in)

    return {
        **base_response,
        "count_before": len(prev_in),
        "count_after": len(cur_in),
        "delta": len(cur_in) - len(prev_in),
        "entraron_count": len(entraron),
        "salieron_count": len(salieron),
        "entraron": [_row(s, cur_idx, prev_idx) for s in entraron[:limit]],
        "salieron": [_row(s, prev_idx, None) for s in salieron[:limit]],
    }
