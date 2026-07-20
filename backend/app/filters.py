from . import storage
from .product import Product
from .utils import has_price, is_empty, stores_of


def csv_list(value: str | None) -> list[str]:
    if not value:
        return []
    return [v.strip() for v in value.split(",") if v.strip()]


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
) -> list[Product]:
    web_f = csv_list(website)
    marca_f = csv_list(marca)
    cat_f = csv_list(categoria)
    estado_f = [e.lower() for e in csv_list(estado)]
    formato_q = (formato or "").strip().lower()
    sku_q = (sku or "").strip().lower()
    nombre_q = (nombre or "").strip().lower()

    out = []
    for r in rows:
        if formato_q and formato_q not in (r.formato or "").lower():
            continue
        if sku_q and sku_q not in (r.sku or "").lower():
            continue
        if nombre_q and nombre_q not in (r.nombre or "").lower():
            continue
        if web_f:
            ws = stores_of(r.website)
            if not any(w in ws for w in web_f):
                continue
        if marca_f and (r.marca or "").strip() not in marca_f:
            continue
        if cat_f and (r.categoria_ecommerce or "").strip() not in cat_f:
            continue
        if estado_f and (r.estado_sl or "").strip().lower() not in estado_f:
            continue
        out.append(r)
    return out


def apply_kpi_type_filter(rows: list[Product], kpi_type: str | None, search: str | None) -> list[Product]:
    kpi_type = kpi_type or "all"
    search_q = (search or "").strip().lower()

    def keep(r: Product) -> bool:
        if kpi_type == "no-nombre" and not is_empty(r.nombre):
            return False
        if kpi_type == "no-familia" and not is_empty(r.familia):
            return False
        if kpi_type == "no-cat" and not is_empty(r.categoria_ecommerce):
            return False
        if kpi_type == "no-foto" and not is_empty(r.foto_descriptiva_sl):
            return False
        if kpi_type == "no-precio" and has_price(r.precio_regular):
            return False
        if kpi_type == "con-precio" and not has_price(r.precio_regular):
            return False
        if search_q:
            if search_q not in (r.sku or "").lower() and search_q not in (r.nombre or "").lower():
                return False
        return True

    return [r for r in rows if keep(r)]
