from fastapi import APIRouter, HTTPException, Query

from .. import storage
from ..filters import apply_dashboard_filters, apply_kpi_type_filter, get_report_products
from ..schemas import ProductPage

router = APIRouter(prefix="/api/reports/{report_id}/products", tags=["products"])


@router.get("", response_model=ProductPage)
def list_products(
    report_id: int,
    kpi_types: str | None = Query(None, description="CSV: completos,no-nombre,no-familia,no-cat,no-foto,con-precio,no-precio"),
    kpi_type: str | None = Query(None, description="Compat: se ignora si viene kpi_types"),
    search: str | None = Query(None),
    website: str | None = Query(None),
    marca: str | None = Query(None),
    categoria: str | None = Query(None),
    estado: str | None = Query(None),
    formato: str | None = Query(None),
    familia: str | None = Query(None),
    sku: str | None = Query(None),
    nombre: str | None = Query(None),
    skus: str | None = Query(None),
    departamento: str | None = Query(None),
    etiqueta: str | None = Query(None),
    etiqueta_combos: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(300, ge=1, le=2000),
):
    if not storage.get_report_meta(report_id):
        raise HTTPException(404, "Reporte no encontrado")

    rows = get_report_products(report_id)
    rows = apply_dashboard_filters(
        rows, website=website, marca=marca, categoria=categoria, estado=estado,
        formato=formato, familia=familia, sku=sku, nombre=nombre, skus=skus,
        departamento=departamento, etiqueta=etiqueta, etiqueta_combos=etiqueta_combos,
    )
    rows = apply_kpi_type_filter(rows, kpi_types or kpi_type, search)

    return {"total": len(rows), "items": rows[offset: offset + limit]}
