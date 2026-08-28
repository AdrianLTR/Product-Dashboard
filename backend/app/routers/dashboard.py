from collections import Counter

from fastapi import APIRouter, HTTPException, Query

from .. import storage
from ..brands import is_private_brand
from ..filters import apply_dashboard_filters, apply_kpi_type_filter, get_report_products
from ..product import Product
from ..utils import etiquetas_of, has_price, is_empty, is_priority, stores_of

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
    skus: str | None = Query(None),
    departamento: str | None = Query(None),
    etiqueta: str | None = Query(None),
    kpi_types: str | None = Query(None),
    search: str | None = Query(None),
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
        skus=skus,
        departamento=departamento,
        etiqueta=etiqueta,
    )
    # Aplicar tambien los toggles de KPI (Sin Foto, Sin Familia, etc) y la
    # busqueda de la tabla, para que el score, tarjetas y charts reflejen la
    # misma seleccion que la tabla embebida — no solo los filtros base.
    rows = apply_kpi_type_filter(rows, kpi_types, search)
    total = len(rows)

    # Si se pego un listado de SKUs, reportar cobertura: cuantos del listado
    # existen en el reporte y cuales no aparecen (para comparar listado vs reporte).
    sku_list_report = None
    if skus:
        from ..filters import parse_sku_list

        requested = parse_sku_list(skus)
        present = {(r.sku or "").strip().lower() for r in all_rows}
        seen = set()
        missing = []
        for s in requested:
            key = s.lower()
            if key in seen:
                continue
            seen.add(key)
            if key not in present:
                missing.append(s)
        sku_list_report = {
            "requested": len(seen),
            "found": len(seen) - len(missing),
            "missing": missing[:1000],
            "missing_count": len(missing),
        }

    # Filtros disponibles (chips), calculados sobre el dataset completo del reporte
    store_set: set[str] = set()
    for r in all_rows:
        store_set.update(stores_of(r.website))
    marcas_all = sorted({(r.marca or "").strip() for r in all_rows if (r.marca or "").strip()})
    cats_all = sorted({(r.categoria_ecommerce or "").strip() for r in all_rows if (r.categoria_ecommerce or "").strip()})
    estados_all = sorted({(r.estado_sl or "").strip() for r in all_rows if (r.estado_sl or "").strip()})
    etiquetas_all: set[str] = set()
    for r in all_rows:
        etiquetas_all.update(etiquetas_of(r.etiquetas_sl))

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
    # Prioridad: ya tienen foto pero la ficha no esta completa
    prioridad = sum(1 for r in rows if is_priority(r))
    marcas_propias = sum(1 for r in rows if is_private_brand(r.marca))
    con_precio = sum(1 for r in rows if has_price(r.precio_regular))
    sin_precio = total - con_precio
    con_precio_merca = sum(1 for r in rows if has_price(r.precio_merca))
    sin_precio_merca = total - con_precio_merca

    marca_counter = Counter((r.marca or "").strip() or "(sin marca)" for r in rows)
    cat_counter = Counter((r.categoria_ecommerce or "").strip() for r in rows if (r.categoria_ecommerce or "").strip())

    # Etiquetas SL: un producto puede tener varias, separadas por coma/;/|
    etiqueta_counter: Counter = Counter()
    # Combinaciones exactas de etiquetas: un producto con ["A","B"] y otro
    # con ["A","B","C"] son 2 combinaciones distintas. Se guardan ordenadas
    # (tuple sorted) para que "A,B" == "B,A".
    combo_counter: Counter = Counter()
    sin_etiquetas = 0
    for r in rows:
        tags = etiquetas_of(r.etiquetas_sl)
        if not tags:
            sin_etiquetas += 1
            continue
        etiqueta_counter.update(tags)  # etiquetas_of ya deduplica por producto
        combo_counter[tuple(sorted(tags))] += 1

    # Agrupacion por Departamento (derivado del grupo via Hoja Madre). Reemplaza
    # el agrupado por grupo de articulo, para entender las categorias por depto.
    deps_sin_fam = Counter(r.departamento for r in rows if is_empty(r.familia))
    deps_sin_cat = Counter(r.departamento for r in rows if is_empty(r.categoria_ecommerce))

    # Desglose completo por departamento
    dep_stats: dict[str, dict] = {}
    for r in rows:
        d = dep_stats.setdefault(
            r.departamento,
            {"departamento": r.departamento, "total": 0, "sin_familia": 0, "sin_categoria": 0,
             "sin_foto": 0, "con_precio": 0, "completos": 0, "prioridad": 0},
        )
        d["total"] += 1
        if is_priority(r):
            d["prioridad"] += 1
        if is_empty(r.familia):
            d["sin_familia"] += 1
        if is_empty(r.categoria_ecommerce):
            d["sin_categoria"] += 1
        if is_empty(r.foto_descriptiva_sl):
            d["sin_foto"] += 1
        if has_price(r.precio_regular):
            d["con_precio"] += 1
        if _is_complete(r):
            d["completos"] += 1
    departamentos = sorted(dep_stats.values(), key=lambda x: -x["total"])
    for d in departamentos:
        d["completos_pct"] = round(d["completos"] / d["total"] * 100) if d["total"] else 0

    return {
        "total": total,
        "sku_list_report": sku_list_report,
        "filters": {
            "stores": sorted(store_set),
            "marcas": marcas_all,
            "categorias": cats_all,
            "estados": estados_all,
            "etiquetas": sorted(etiquetas_all),
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
            "prioridad": prioridad,
            "marcas_propias": marcas_propias,
        },
        "estado_pie": [{"label": k or "(vacío)", "count": v} for k, v in estado_counts.most_common()],
        "top_marcas": _top(marca_counter, 10),
        "top_categorias": _top(cat_counter, 10),
        "top_etiquetas": _top(etiqueta_counter, 12),
        "etiqueta_combinaciones": [
            {"tags": list(combo), "count": n}
            for combo, n in combo_counter.most_common()
        ],
        "sin_etiquetas": sin_etiquetas,
        "precio": {
            "con_precio": con_precio,
            "sin_precio": sin_precio,
            "con_precio_merca": con_precio_merca,
            "sin_precio_merca": sin_precio_merca,
        },
        "deptos_sin_familia": _top(deps_sin_fam, 7),
        "deptos_sin_categoria": _top(deps_sin_cat, 7),
        "departamentos": departamentos,
    }
