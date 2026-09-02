import datetime
import io

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from .. import storage
from ..filters import apply_dashboard_filters, apply_kpi_type_filter, get_report_products, resolve_skus
from .compare import compare_reports
from .stores import store_metrics

router = APIRouter(prefix="/api/export", tags=["export"])

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

PRODUCT_COLUMNS = [
    ("sku", "SKU"),
    ("nombre", "Nombre"),
    ("descripcion_sap", "Descripcion SAP"),
    ("familia", "Familia"),
    ("categoria_ecommerce", "Categoria eCommerce"),
    ("marca", "Marca"),
    ("estado_sl", "Estado SL"),
    ("precio_regular", "Precio Regular"),
    ("precio_merca", "Precio Merca"),
    ("website", "Website"),
    ("grupo_articulo", "Grupo de Articulo"),
    ("departamento", "Departamento"),
    ("etiquetas_sl", "Etiquetas SL"),
    ("formato", "Formato"),
    ("descripcion_detallada", "Descripción detallada"),
    ("foto_descriptiva_sl", "Foto descriptiva SL"),
]


def _stamp() -> str:
    return datetime.date.today().isoformat()


def _xlsx_response(sheets: dict[str, pd.DataFrame], filename: str) -> StreamingResponse:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        for name, df in sheets.items():
            df.to_excel(writer, sheet_name=name[:31], index=False)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _products_df(rows) -> pd.DataFrame:
    return pd.DataFrame(
        [{label: getattr(r, key) for key, label in PRODUCT_COLUMNS} for r in rows]
    )


@router.get("/products/{report_id}")
def export_products(
    report_id: int,
    kpi_types: str | None = Query(None),
    kpi_type: str | None = Query(None),
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
    sku_list_id: str | None = Query(None),
    departamento: str | None = Query(None),
    etiqueta: str | None = Query(None),
    etiqueta_combos: str | None = Query(None),
):
    """Exporta la vista de productos filtrada (misma logica del Dashboard) a xlsx."""
    if not storage.get_report_meta(report_id):
        raise HTTPException(404, "Reporte no encontrado")
    skus = resolve_skus(skus, sku_list_id)
    rows = get_report_products(report_id)
    rows = apply_dashboard_filters(
        rows, website=website, marca=marca, categoria=categoria, estado=estado,
        formato=formato, familia=familia, sku=sku, nombre=nombre, skus=skus,
        departamento=departamento, etiqueta=etiqueta, etiqueta_combos=etiqueta_combos,
    )
    rows = apply_kpi_type_filter(rows, kpi_types or kpi_type, search)
    view = (kpi_types or kpi_type or "todos").replace(",", "_")
    return _xlsx_response(
        {"Productos": _products_df(rows)},
        f"Productos_{view}_{_stamp()}.xlsx",
    )


@router.get("/stores/{report_id}")
def export_stores(report_id: int):
    """Exporta las metricas por website a xlsx."""
    data = store_metrics(report_id)  # valida el 404 internamente
    df = pd.DataFrame(data["stores"]).rename(
        columns={
            "name": "Website",
            "total": "Total",
            "completos": "Completos",
            "completos_pct": "% Completo",
            "sin_familia": "Sin Familia",
            "sin_categoria": "Sin Categoria",
            "sin_foto": "Sin Foto",
            "con_precio": "Con Precio",
            "sin_precio": "Sin Precio",
        }
    )
    return _xlsx_response({"Websites": df}, f"Websites_{_stamp()}.xlsx")


@router.get("/compare")
def export_compare(
    base_id: int = Query(...),
    target_id: int = Query(...),
):
    """Exporta la comparacion entre dos reportes a xlsx (4 hojas)."""
    data = compare_reports(base_id=base_id, target_id=target_id, changes_limit=2000)

    s = data["summary"]
    resumen = pd.DataFrame(
        [
            {"Métrica": "Total antes", "Valor": s["total_before"]},
            {"Métrica": "Total ahora", "Valor": s["total_after"]},
            {"Métrica": "Delta SKUs", "Valor": s["delta"]},
            {"Métrica": "Nuevos", "Valor": s["new_count"]},
            {"Métrica": "Eliminados", "Valor": s["removed_count"]},
            {"Métrica": "Modificados", "Valor": s["changed_count"]},
            {"Métrica": "KPI antes", "Valor": s["kpi_score_before"]},
            {"Métrica": "KPI ahora", "Valor": s["kpi_score_after"]},
            {"Métrica": "Delta KPI", "Valor": s["kpi_score_delta"]},
            {"Métrica": "Visibles antes", "Valor": s["visibles_antes"]},
            {"Métrica": "Visibles ahora", "Valor": s["visibles_ahora"]},
            {"Métrica": "Se volvieron Visibles", "Valor": s["became_visible_count"]},
            {"Métrica": "Perdieron visibilidad", "Valor": s["became_invisible_count"]},
        ]
    )
    nuevos = pd.DataFrame({"SKU": data["new_skus"]})
    eliminados = pd.DataFrame({"SKU": data["removed_skus"]})
    ganaron_visible = pd.DataFrame(data["became_visible"])
    perdieron_visible = pd.DataFrame(data["became_invisible"])
    cambios = pd.DataFrame(
        [
            {
                "SKU": c["sku"],
                "Nombre": c["nombre"],
                "Campo": f["label"],
                "Antes": f["before"],
                "Ahora": f["after"],
            }
            for c in data["changed"]
            for f in c["fields"].values()
        ]
    )
    return _xlsx_response(
        {
            "Resumen": resumen,
            "Nuevos": nuevos,
            "Eliminados": eliminados,
            "Cambios": cambios,
            "Se volvieron Visibles": ganaron_visible,
            "Perdieron visibilidad": perdieron_visible,
        },
        f"Comparacion_{base_id}_vs_{target_id}_{_stamp()}.xlsx",
    )
