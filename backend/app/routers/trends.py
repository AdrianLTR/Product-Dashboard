from fastapi import APIRouter

from .. import storage
from ..filters import get_report_products
from ..utils import has_price, is_complete, is_empty, kpi_score

router = APIRouter(prefix="/api/trends", tags=["trends"])


@router.get("")
def trends():
    """Serie historica: una entrada por reporte cargado, en orden cronologico.
    Permite graficar la evolucion del KPI score y de los totales."""
    out = []
    for meta in sorted(storage.list_reports(), key=lambda m: m["uploaded_at"]):
        rows = get_report_products(meta["id"])
        total = len(rows)
        visibles = sum(1 for r in rows if (r.estado_sl or "").strip().lower() == "visible")
        out.append(
            {
                **meta,
                "total": total,
                "kpi_score": kpi_score(rows),
                "completos": sum(1 for r in rows if is_complete(r)),
                "con_precio": sum(1 for r in rows if has_price(r.precio_regular)),
                "sin_foto": sum(1 for r in rows if is_empty(r.foto_descriptiva_sl)),
                "sin_familia": sum(1 for r in rows if is_empty(r.familia)),
                "visibles": visibles,
            }
        )
    return {"reports": out}
