from fastapi import APIRouter, HTTPException, Query

from .. import storage
from ..filters import get_report_products
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
):
    base_report = storage.get_report_meta(base_id)
    target_report = storage.get_report_meta(target_id)
    if not base_report or not target_report:
        raise HTTPException(404, "Reporte no encontrado")

    base_rows = get_report_products(base_id)
    target_rows = get_report_products(target_id)
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
        },
        "new_skus": new_skus[:changes_limit],
        "removed_skus": removed_skus[:changes_limit],
        "changed": changed[:changes_limit],
    }
