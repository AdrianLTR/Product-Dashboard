from fastapi import APIRouter, HTTPException, Query

from .. import storage
from ..filters import get_report_products, parse_sku_list, resolve_skus
from ..product import Product
from ..utils import has_price, is_empty

router = APIRouter(prefix="/api/compare", tags=["compare"])

# Campos que se comparan producto a producto entre dos reportes
DIFF_FIELDS = [
    ("nombre", "Nombre"),
    ("familia", "Familia"),
    ("categoria_ecommerce", "Categoria eCommerce"),
    ("descripcion_detallada", "Descripción detallada"),
    ("foto_descriptiva_sl", "Foto descriptiva SL"),
    ("website", "Website"),
    ("estado_sl", "Estado SL"),
    ("marca", "Marca"),
    ("precio_regular", "Precio Regular"),
    ("precio_merca", "Precio Merca"),
]

KPI_ATTRS = [
    ("nombre", "Nombre", False),
    ("descripcion_detallada", "Descripción Detallada", False),
    ("precio_regular", "Precio Regular", True),
    ("foto_descriptiva_sl", "Foto Descriptiva SL", False),
]


def _score(rows: list[Product]) -> float:
    total = len(rows)
    if not total:
        return 0.0
    score = 0.0
    for key, _, is_price in KPI_ATTRS:
        cnt = sum(1 for r in rows if (has_price(getattr(r, key)) if is_price else not is_empty(getattr(r, key))))
        score += round(cnt / total * 100) * 0.25
    return round(score, 2)


def _index_by_sku(rows: list[Product]) -> dict[str, Product]:
    idx: dict[str, Product] = {}
    for r in rows:
        if r.sku:
            idx[r.sku] = r  # si hay SKU duplicado, se queda con el ultimo
    return idx


@router.get("")
def compare_reports(
    base_id: int = Query(..., description="Reporte anterior (baseline)"),
    target_id: int = Query(..., description="Reporte nuevo a comparar"),
    changes_limit: int = Query(200, ge=1, le=2000),
    skus: str | None = Query(None, description="Lista de SKUs para filtrar"),
    sku_list_id: str | None = Query(None, description="Id devuelto por POST /api/sku-lists para listas grandes"),
):
    base_report = storage.get_report_meta(base_id)
    target_report = storage.get_report_meta(target_id)
    if not base_report or not target_report:
        raise HTTPException(404, "Reporte no encontrado")

    skus = resolve_skus(skus, sku_list_id)
    base_rows = get_report_products(base_id)
    target_rows = get_report_products(target_id)
    parsed_skus = parse_sku_list(skus)
    sku_filter = {s.lower() for s in parsed_skus}
    skus_no_encontrados: list[str] = []
    if sku_filter:
        base_rows = [r for r in base_rows if (r.sku or "").strip().lower() in sku_filter]
        target_rows = [r for r in target_rows if (r.sku or "").strip().lower() in sku_filter]
        found = {(r.sku or "").strip().lower() for r in base_rows} | {(r.sku or "").strip().lower() for r in target_rows}
        skus_no_encontrados = [s for s in parsed_skus if s.lower() not in found]
    base_idx = _index_by_sku(base_rows)
    target_idx = _index_by_sku(target_rows)

    base_skus = set(base_idx)
    target_skus = set(target_idx)

    new_skus = sorted(target_skus - base_skus)
    removed_skus = sorted(base_skus - target_skus)
    common_skus = base_skus & target_skus

    changed = []
    for sku in sorted(common_skus):
        b, t = base_idx[sku], target_idx[sku]
        field_changes = {}
        for key, label in DIFF_FIELDS:
            bv, tv = getattr(b, key), getattr(t, key)
            if (bv or None) != (tv or None):
                field_changes[key] = {"label": label, "before": bv, "after": tv}
        if field_changes:
            changed.append({"sku": sku, "nombre": t.nombre, "fields": field_changes})

    kpi_before = _score(base_rows)
    kpi_after = _score(target_rows)

    # Ganancia de visibilidad: SKUs que pasaron de no-Visible a Visible.
    # 'became_visible' es lo que catalogaron/publicaron entre reportes.
    def _visible(r) -> bool:
        return (r.estado_sl or "").strip().lower() == "visible"

    became_visible = []
    became_invisible = []
    for sku in sorted(common_skus):
        b, t = base_idx[sku], target_idx[sku]
        if not _visible(b) and _visible(t):
            became_visible.append({"sku": sku, "nombre": t.nombre, "estado_antes": b.estado_sl, "estado_ahora": t.estado_sl})
        elif _visible(b) and not _visible(t):
            became_invisible.append({"sku": sku, "nombre": t.nombre, "estado_antes": b.estado_sl, "estado_ahora": t.estado_sl})
    # Los SKUs nuevos que ya vienen visibles tambien cuentan como ganados
    for sku in new_skus:
        t = target_idx[sku]
        if _visible(t):
            became_visible.append({"sku": sku, "nombre": t.nombre, "estado_antes": "(nuevo)", "estado_ahora": t.estado_sl})

    visibles_antes = sum(1 for r in base_rows if _visible(r))
    visibles_ahora = sum(1 for r in target_rows if _visible(r))

    return {
        "base": {**base_report, "total": len(base_rows)},
        "target": {**target_report, "total": len(target_rows)},
        "summary": {
            "total_before": len(base_rows),
            "total_after": len(target_rows),
            "delta": len(target_rows) - len(base_rows),
            "new_count": len(new_skus),
            "removed_count": len(removed_skus),
            "changed_count": len(changed),
            "kpi_score_before": kpi_before,
            "kpi_score_after": kpi_after,
            "kpi_score_delta": round(kpi_after - kpi_before, 2),
            "visibles_antes": visibles_antes,
            "visibles_ahora": visibles_ahora,
            "became_visible_count": len(became_visible),
            "became_invisible_count": len(became_invisible),
        },
        "new_skus": new_skus[:changes_limit],
        "removed_skus": removed_skus[:changes_limit],
        "changed": changed[:changes_limit],
        "became_visible": became_visible[:changes_limit],
        "became_invisible": became_invisible[:changes_limit],
        "skus_no_encontrados": skus_no_encontrados,
    }
