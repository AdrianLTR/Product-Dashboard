import re
from collections import defaultdict

from fastapi import APIRouter, HTTPException, Query

from .. import storage
from ..filters import get_report_products
from ..utils import stores_of

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


@router.get("/{report_id}/category-website")
def category_website(report_id: int, sample_limit: int = Query(500, ge=1, le=5000)):
    if not storage.get_report_meta(report_id):
        raise HTTPException(404, "Reporte no encontrado")

    rows = get_report_products(report_id)

    summary = {
        "total": 0,
        "in_managed": 0,       # productos en al menos un website gestionado
        "ok": 0,               # todos sus websites gestionados tienen su categoria
        "missing_category": 0, # >=1 website sin su categoria (EL problema)
        "no_managed_website": 0,  # sin website gestionado (no se valida; no es error)
    }
    # Por website: cuantos productos lo tienen y cuantos cumplen/fallan la categoria
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
                if len(issues) < sample_limit:
                    issues.append({
                        "sku": r.sku,
                        "nombre": r.nombre,
                        "website": w,
                        "expected_prefix": expected,
                        "categoria": cat,
                        "category_prefixes": sorted(prefixes),
                    })

        if product_ok:
            summary["ok"] += 1
        else:
            summary["missing_category"] += 1

    per_website_out = []
    total_issue_rows = 0
    for name in sorted(_MANAGED_WEBSITES, key=lambda w: -per_website[w]["in_website"]):
        e = per_website[name]
        total_issue_rows += e["missing_category"]
        missing_pct = round(e["missing_category"] / e["in_website"] * 100) if e["in_website"] else 0
        per_website_out.append({"website": name, **e, "missing_pct": missing_pct})

    return {
        "mapping": [{"website": w, "prefix": p} for w, p in WEBSITE_PREFIX_MAP.items()],
        "summary": summary,
        "per_website": per_website_out,
        "issues": issues,
        "total_issue_rows": total_issue_rows,
        "issues_truncated": total_issue_rows > len(issues),
        "sample_limit": sample_limit,
    }
