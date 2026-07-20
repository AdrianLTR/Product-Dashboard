from collections import Counter

from fastapi import APIRouter, HTTPException, Query

from .. import storage
from ..filters import apply_dashboard_filters, get_report_products
from ..product import Product
from ..utils import has_price, is_empty, stores_of

router = APIRouter(prefix="/api/reports/{report_id}/dashboard", tags=["dashboard"])

# Campos que definen un producto "completo" (equivalente a KF en el HTML original)
COMPLETENESS_FIELDS = [
    "nombre",
    "familia",
    "categoria_ecommerce",
    "descripcion_detallada",
    "foto_descriptiva_sl",
    "website",
    "estado_sl",
]

# 4 atributos KPI, 25 pts cada uno (equivalente a KPIF en el HTML original)
KPI_ATTRS = [
    {"key": "nombre", "label": "Nombre", "color": "#4a9eff", "is_price": False},
    {"key": "descripcion_detallada", "label": "Descripción Detallada", "color": "#a78bfa", "is_price": False},
    {"key": "precio_regular", "label": "Precio Regular", "color": "#18c896", "is_price": True},
    {"key": "foto_descriptiva_sl", "label": "Foto Descriptiva SL", "color": "#f0a030", "is_price": False},
]


def _top(counter: Counter, n: int) -> list[dict]:
    return [{"label": k, "count": v} for k, v in counter.most_common(n)]


def _is_complete(r: Product) -> bool:
    for field in COMPLETENESS_FIELDS:
        if is_empty(getattr(r, field)):
            return False
    return True


def _field_filled(r: Product, attr: dict) -> bool:
    if attr["is_price"]:
        return has_price(getattr(r, attr["key"]))
    return not is_empty(getattr(r, attr["key"]))


@router.get("")
def dashboard(
    report_id: int,
    website: str | None = Query(None),
    marca: str | None = Query(None),
    categoria: str | None = Query(None),
    estado: str | None = Query(None),
    formato: str | None = Query(None),
    sku: str | None = Query(None),
    nombre: str | None = Query(None),
    familia: str | None = Query(None),
):
    if not storage.get_report_meta(report_id):
        raise HTTPException(404, "Reporte no encontrado")

    all_rows = get_report_products(report_id)
    rows = apply_dashboard_filters(
        all_rows,
        website=website,
        marca=marca,
        categoria=categoria,
        estado=estado,
        formato=formato,
        sku=sku,
        nombre=nombre,
        familia=familia,
    )
    total = len(rows)

    # Filtros disponibles (chips), calculados sobre el dataset completo del reporte
    store_set: set[str] = set()
    for r in all_rows:
        store_set.update(stores_of(r.website))
    marcas_all = sorted({(r.marca or "").strip() for r in all_rows if (r.marca or "").strip()})
    cats_all = sorted({(r.categoria_ecommerce or "").strip() for r in all_rows if (r.categoria_ecommerce or "").strip()})
    estados_all = sorted({(r.estado_sl or "").strip() for r in all_rows if (r.estado_sl or "").strip()})

    estado_counts = Counter((r.estado_sl or "").strip().lower() for r in rows)

    kpi_score = 0.0
    attrs_out = []
    for attr in KPI_ATTRS:
        cnt = sum(1 for r in rows if _field_filled(r, attr))
        p = round(cnt / total * 100) if total else 0
        kpi_score += p * 0.25
        attrs_out.append({**attr, "count": cnt, "pct": p, "total": total})

    no_fam = sum(1 for r in rows if is_empty(r.familia))
    no_cat = sum(1 for r in rows if is_empty(r.categoria_ecommerce))
    no_nm = sum(1 for r in rows if is_empty(r.nombre))
    no_foto = sum(1 for r in rows if is_empty(r.foto_descriptiva_sl))
    comp = sum(1 for r in rows if _is_complete(r))
    con_precio = sum(1 for r in rows if has_price(r.precio_regular))
    sin_precio = total - con_precio
    con_precio_merca = sum(1 for r in rows if has_price(r.precio_merca))
    sin_precio_merca = total - con_precio_merca

    marca_counter = Counter((r.marca or "").strip() or "(sin marca)" for r in rows)
    cat_counter = Counter((r.categoria_ecommerce or "").strip() for r in rows if (r.categoria_ecommerce or "").strip())

    grupos_sin_fam = Counter((r.grupo_articulo or "(sin grupo)") for r in rows if is_empty(r.familia))
    grupos_sin_cat = Counter((r.grupo_articulo or "(sin grupo)") for r in rows if is_empty(r.categoria_ecommerce))

    return {
        "total": total,
        "filters": {
            "stores": sorted(store_set),
            "marcas": marcas_all,
            "categorias": cats_all,
            "estados": estados_all,
        },
        "estado_counts": {
            "draft": estado_counts.get("draft", 0),
            "visible": estado_counts.get("visible", 0),
            "invisible": estado_counts.get("invisible", 0),
        },
        "kpi_score": round(kpi_score, 2),
        "kpi_attrs": attrs_out,
        "cards": {
            "total": total,
            "completos": comp,
            "sin_familia": no_fam,
            "sin_categoria": no_cat,
            "sin_nombre": no_nm,
            "sin_foto": no_foto,
            "con_precio": con_precio,
            "sin_precio": sin_precio,
        },
        "estado_pie": [{"label": k or "(vacío)", "count": v} for k, v in estado_counts.most_common()],
        "top_marcas": _top(marca_counter, 10),
        "top_categorias": _top(cat_counter, 10),
        "precio": {
            "con_precio": con_precio,
            "sin_precio": sin_precio,
            "con_precio_merca": con_precio_merca,
            "sin_precio_merca": sin_precio_merca,
        },
        "grupos_sin_familia": _top(grupos_sin_fam, 7),
        "grupos_sin_categoria": _top(grupos_sin_cat, 7),
    }
