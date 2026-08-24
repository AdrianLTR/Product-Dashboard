import re

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from .. import storage
from ..filters import get_report_products
from ..utils import stores_of
from .exports import _stamp, _xlsx_response

router = APIRouter(prefix="/api/reports", tags=["category-website"])

# Cada website exige que sus productos tengan una categoria eCommerce con el
# prefijo correspondiente. REGLA (confirmada por el usuario):
#   Si un producto TIENE el website, DEBE tener la categoria con ese prefijo.
#   Un producto en BASE sin categoria SMN se apaga en Magento.
#   El caso inverso (tener la categoria SMN sin el website BASE) es VALIDO.
# Por eso validamos por website: recorremos los websites del producto y
# verificamos que exista la categoria con el prefijo de cada uno.
WEBSITE_PREFIX_MAP: dict[str, str] = {
    "JUMBO": "JMB",
    "MERCA JUMBO": "MJ",
    "BASE": "SMN",
    "BEBEMUNDO": "BBM",
    "JUGUETON": "JUG",
    "CASA CUESTA": "CC",
}
_MANAGED_WEBSITES = set(WEBSITE_PREFIX_MAP.keys())

# Separadores posibles entre varias categorias en un mismo campo
_CAT_SPLIT_RE = re.compile(r"[,;|/\n]+")
_PREFIX_RE = re.compile(r"^([A-Za-z]{2,6})[\d_\-]")


def _category_prefixes(categoria: str) -> set[str]:
    """Conjunto de prefijos presentes en el campo Categoria eCommerce.
    Soporta varias categorias separadas por coma/;/|/salto de linea."""
    out: set[str] = set()
    for piece in _CAT_SPLIT_RE.split(categoria or ""):
        m = _PREFIX_RE.match(piece.strip())
        if m:
            out.add(m.group(1).upper())
    return out


def _filter_by_estado(rows, estado: str | None):
    estado_norm = (estado or "").strip().lower()
    if not estado_norm:
        return rows
    return [r for r in rows if (r.estado_sl or "").strip().lower() == estado_norm]


def _analyze(rows):
    """Recorre los productos y devuelve summary, per_website (lista) e issues
    SIN truncar. Compartido entre el endpoint JSON (que si trunca para no
    mandar miles de filas al navegador) y el export a Excel (que no trunca,
    el punto de exportar es tener la lista completa para corregir)."""
    summary = {
        "total": 0,
        "in_managed": 0,       # productos en al menos un website gestionado
        "ok": 0,               # todos sus websites gestionados tienen su categoria
        "missing_category": 0, # >=1 website sin su categoria (EL problema)
        "no_managed_website": 0,  # sin website gestionado (no se valida; no es error)
    }
    per_website: dict[str, dict] = {
        w: {"prefix": WEBSITE_PREFIX_MAP[w], "in_website": 0, "with_category": 0, "missing_category": 0}
        for w in _MANAGED_WEBSITES
    }
    # Cada issue es un par (producto, website) donde tiene el website pero le
    # falta la categoria con el prefijo de ese website.
    issues: list[dict] = []

    for r in rows:
        summary["total"] += 1
        cat = (r.categoria_ecommerce or "").strip()
        prefixes = _category_prefixes(cat)
        websites = [w for w in stores_of(r.website) if w in _MANAGED_WEBSITES]

        if not websites:
            summary["no_managed_website"] += 1
            continue

        summary["in_managed"] += 1
        product_ok = True
        for w in websites:
            expected = WEBSITE_PREFIX_MAP[w]
            per_website[w]["in_website"] += 1
            if expected in prefixes:
                per_website[w]["with_category"] += 1
            else:
                per_website[w]["missing_category"] += 1
                product_ok = False
                issues.append({
                    "sku": r.sku,
                    "nombre": r.nombre,
                    "website": w,
                    "expected_prefix": expected,
                    "categoria": cat,
                    "category_prefixes": sorted(prefixes),
                    "estado_sl": r.estado_sl,
                })

        if product_ok:
            summary["ok"] += 1
        else:
            summary["missing_category"] += 1

    per_website_out = []
    for name in sorted(_MANAGED_WEBSITES, key=lambda w: -per_website[w]["in_website"]):
        e = per_website[name]
        missing_pct = round(e["missing_category"] / e["in_website"] * 100) if e["in_website"] else 0
        per_website_out.append({"website": name, **e, "missing_pct": missing_pct})

    return summary, per_website_out, issues


@router.get("/{report_id}/category-website")
def category_website(
    report_id: int,
    estado: str | None = Query(
        None,
        description="Filtrar por Estado SL (Visible|Draft|Invisible). Vacio = todos. "
        "Visible es el foco principal: son los productos que Magento ya publica y a los "
        "que si les falta la categoria, se apagan.",
    ),
    sample_limit: int = Query(500, ge=1, le=5000),
):
    if not storage.get_report_meta(report_id):
        raise HTTPException(404, "Reporte no encontrado")

    rows = _filter_by_estado(get_report_products(report_id), estado)
    summary, per_website_out, issues = _analyze(rows)

    return {
        "mapping": [{"website": w, "prefix": p} for w, p in WEBSITE_PREFIX_MAP.items()],
        "estado_filter": estado or "",
        "summary": summary,
        "per_website": per_website_out,
        "issues": issues[:sample_limit],
        "total_issue_rows": len(issues),
        "issues_truncated": len(issues) > sample_limit,
        "sample_limit": sample_limit,
    }


@router.get("/{report_id}/category-website/export")
def export_category_website(
    report_id: int,
    estado: str | None = Query(None),
):
    """Excel con la lista COMPLETA de productos a corregir (sin el limite de
    muestra del JSON) mas el resumen por website."""
    if not storage.get_report_meta(report_id):
        raise HTTPException(404, "Reporte no encontrado")

    rows = _filter_by_estado(get_report_products(report_id), estado)
    summary, per_website_out, issues = _analyze(rows)

    per_website_df = pd.DataFrame(per_website_out).rename(columns={
        "website": "Website", "prefix": "Prefijo requerido", "in_website": "Productos en el website",
        "with_category": "Con categoria OK", "missing_category": "Falta categoria",
        "missing_pct": "% que se apaga",
    })
    issues_df = pd.DataFrame([
        {
            "SKU": i["sku"],
            "Nombre": i["nombre"],
            "Estado SL": i["estado_sl"],
            "Website": i["website"],
            "Categoria que falta": i["expected_prefix"],
            "Categoria actual": i["categoria"],
        }
        for i in issues
    ])

    suffix = f"_{estado}" if estado else ""
    return _xlsx_response(
        {"Por Website": per_website_df, "Productos a corregir": issues_df},
        f"Categorias_x_Website{suffix}_{_stamp()}.xlsx",
    )
