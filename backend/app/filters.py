import re

from . import storage
from .product import Product
from .utils import COMPLETENESS_FIELDS, has_price, is_complete, is_empty, stores_of

# Separadores admitidos al pegar un listado de SKUs: coma, punto y coma,
# espacios, tabs y saltos de linea. Asi el usuario puede pegar de Excel.
_SKU_SPLIT_RE = re.compile(r"[,;\s]+")


def csv_list(value: str | None) -> list[str]:
    if not value:
        return []
    return [v.strip() for v in value.split(",") if v.strip()]


def parse_sku_list(value: str | None) -> list[str]:
    if not value:
        return []
    return [s.strip() for s in _SKU_SPLIT_RE.split(value) if s.strip()]


def get_report_products(report_id: int) -> list[Product]:
    return storage.get_report_products(report_id)


def apply_dashboard_filters(
    rows: list[Product],
    website: str | None = None,
    marca: str | None = None,
    categoria: str | None = None,
    estado: str | None = None,
    formato: str | None = None,
    sku: str | None = None,
    nombre: str | None = None,
    familia: str | None = None,
    skus: str | None = None,
    departamento: str | None = None,
) -> list[Product]:
    web_f = csv_list(website)
    cat_f = csv_list(categoria)
    dep_f = csv_list(departamento)
    estado_f = [e.lower() for e in csv_list(estado)]
    formato_q = (formato or "").strip().lower()
    sku_q = (sku or "").strip().lower()
    nombre_q = (nombre or "").strip().lower()
    # marca y familia son busqueda por texto (contiene), no seleccion exacta
    marca_q = (marca or "").strip().lower()
    familia_q = (familia or "").strip().lower()
    # skus: listado exacto pegado por el usuario (comparar un listado contra el reporte)
    sku_set = {s.lower() for s in parse_sku_list(skus)}

    out = []
    for r in rows:
        if sku_set and (r.sku or "").strip().lower() not in sku_set:
            continue
        if formato_q and formato_q not in (r.formato or "").lower():
            continue
        if sku_q and sku_q not in (r.sku or "").lower():
            continue
        if nombre_q and nombre_q not in (r.nombre or "").lower():
            continue
        if marca_q and marca_q not in (r.marca or "").lower():
            continue
        if familia_q and familia_q not in (r.familia or "").lower():
            continue
        if web_f:
            ws = stores_of(r.website)
            if not any(w in ws for w in web_f):
                continue
        if cat_f and (r.categoria_ecommerce or "").strip() not in cat_f:
            continue
        if dep_f and r.departamento not in dep_f:
            continue
        if estado_f and (r.estado_sl or "").strip().lower() not in estado_f:
            continue
        out.append(r)
    return out


# Cada tipo KPI es un predicado sobre una fila. Se combinan con AND: si el
# usuario selecciona "sin-foto" y "sin-familia", la tabla muestra solo los
# productos que estan en ambas listas — util para priorizar los peores casos.
_KPI_PREDICATES = {
    "completos": lambda r: is_complete(r),
    "no-nombre": lambda r: is_empty(r.nombre),
    "no-familia": lambda r: is_empty(r.familia),
    "no-cat": lambda r: is_empty(r.categoria_ecommerce),
    "no-foto": lambda r: is_empty(r.foto_descriptiva_sl),
    "no-precio": lambda r: not has_price(r.precio_regular),
    "con-precio": lambda r: has_price(r.precio_regular),
}


def apply_kpi_type_filter(
    rows: list[Product],
    kpi_types: list[str] | str | None,
    search: str | None,
) -> list[Product]:
    # Acepta lista, CSV (de la query), o el string suelto de la version vieja
    if kpi_types is None:
        selected = []
    elif isinstance(kpi_types, str):
        selected = [t.strip() for t in kpi_types.split(",") if t.strip() and t.strip() != "all"]
    else:
        selected = [t for t in kpi_types if t and t != "all"]

    predicates = [_KPI_PREDICATES[t] for t in selected if t in _KPI_PREDICATES]
    search_q = (search or "").strip().lower()

    def keep(r: Product) -> bool:
        for pred in predicates:
            if not pred(r):
                return False
        if search_q:
            if search_q not in (r.sku or "").lower() and search_q not in (r.nombre or "").lower():
                return False
        return True

    return [r for r in rows if keep(r)]
