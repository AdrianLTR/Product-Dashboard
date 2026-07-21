import re
from collections import defaultdict

from fastapi import APIRouter, HTTPException, Query

from .. import storage
from ..filters import get_report_products
from ..utils import stores_of

router = APIRouter(prefix="/api/reports", tags=["category-website"])

# Cada categoria eCommerce empieza con un prefijo de letras que identifica
# a que website pertenece. Si el producto esta en un website distinto al que
# indica su prefijo, Magento apaga el producto (le falta uno de los dos).
# Este mapeo lo confirmo el usuario.
CATEGORY_WEBSITE_MAP: dict[str, str] = {
    "JMB": "JUMBO",
    "MJ": "MERCA JUMBO",
    "SMN": "BASE",
    "BBM": "BEBEMUNDO",
    "JUG": "JUGUETON",
    "CC": "CASA CUESTA",
}
# Websites que participan en la validacion (los que estan en el mapeo)
_MANAGED_WEBSITES = set(CATEGORY_WEBSITE_MAP.values())
# Prefijo → website; el inverso es simetrico porque el mapeo es 1:1
_WEBSITE_TO_PREFIX = {v: k for k, v in CATEGORY_WEBSITE_MAP.items()}

_PREFIX_RE = re.compile(r"^([A-Za-z]{2,6})[\d_\-]")


def _prefix_of(categoria: str) -> str | None:
    """Extrae el prefijo de letras de un nombre de categoria (ej. 'JMB03_Bano' → 'JMB')."""
    m = _PREFIX_RE.match(categoria or "")
    return m.group(1).upper() if m else None


@router.get("/{report_id}/category-website")
def category_website(report_id: int, sample_limit: int = Query(300, ge=1, le=2000)):
    if not storage.get_report_meta(report_id):
        raise HTTPException(404, "Reporte no encontrado")

    rows = get_report_products(report_id)

    summary = {"total": 0, "ok": 0, "wrong_website": 0, "no_website": 0, "unknown_prefix": 0, "no_categoria": 0}
    # Contadores por website: cuantos productos "viven" en el website y como estan sus categorias
    per_website: dict[str, dict] = defaultdict(
        lambda: {"total_in_website": 0, "matching_prefix": 0, "other_prefix": 0, "no_prefix": 0, "should_be_here": 0}
    )
    for w in _MANAGED_WEBSITES:
        per_website[w]["prefix"] = _WEBSITE_TO_PREFIX[w]

    issues_wrong_website: list[dict] = []  # producto en website A pero categoria dice website B
    issues_no_website: list[dict] = []  # categoria valida pero producto sin ese website
    issues_unknown_prefix: list[dict] = []  # categoria no arranca con un prefijo conocido
    issues_no_categoria: list[dict] = []  # sin categoria

    for r in rows:
        summary["total"] += 1
        cat = (r.categoria_ecommerce or "").strip()
        prefix = _prefix_of(cat) if cat else None
        expected = CATEGORY_WEBSITE_MAP.get(prefix) if prefix else None
        websites = list(stores_of(r.website))

        base = {
            "sku": r.sku,
            "nombre": r.nombre,
            "categoria": cat,
            "prefix": prefix,
            "expected_website": expected,
            "websites": websites,
        }

        # Actualizar contadores por website donde el producto esta presente
        for w in websites:
            if w not in _MANAGED_WEBSITES:
                continue
            per_website[w]["total_in_website"] += 1
            if expected == w:
                per_website[w]["matching_prefix"] += 1
            elif prefix and prefix in CATEGORY_WEBSITE_MAP:
                per_website[w]["other_prefix"] += 1
            else:
                per_website[w]["no_prefix"] += 1

        # Bucketizar el producto en un unico bucket de issue (o OK)
        if not cat:
            summary["no_categoria"] += 1
            if len(issues_no_categoria) < sample_limit:
                issues_no_categoria.append(base)
            continue
        if not prefix or prefix not in CATEGORY_WEBSITE_MAP:
            summary["unknown_prefix"] += 1
            if len(issues_unknown_prefix) < sample_limit:
                issues_unknown_prefix.append(base)
            continue
        if not websites:
            summary["no_website"] += 1
            if len(issues_no_website) < sample_limit:
                issues_no_website.append(base)
            # Aun asi, sumar al contador de "deberia estar aqui"
            per_website[expected]["should_be_here"] += 1
            continue
        if expected in websites:
            summary["ok"] += 1
        else:
            summary["wrong_website"] += 1
            if len(issues_wrong_website) < sample_limit:
                issues_wrong_website.append(base)
            per_website[expected]["should_be_here"] += 1

    # Formato de per_website ordenado por volumen
    per_website_out = []
    for name in sorted(_MANAGED_WEBSITES, key=lambda w: -per_website[w]["total_in_website"]):
        entry = per_website[name]
        matching_pct = round(entry["matching_prefix"] / entry["total_in_website"] * 100) if entry["total_in_website"] else 0
        per_website_out.append({"website": name, **entry, "matching_pct": matching_pct})

    return {
        "mapping": [{"prefix": p, "website": w} for p, w in CATEGORY_WEBSITE_MAP.items()],
        "summary": summary,
        "per_website": per_website_out,
        "issues": {
            "wrong_website": issues_wrong_website,
            "no_website": issues_no_website,
            "unknown_prefix": issues_unknown_prefix,
            "no_categoria": issues_no_categoria,
        },
        "sample_limit": sample_limit,
    }
