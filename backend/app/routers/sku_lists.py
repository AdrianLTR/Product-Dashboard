from fastapi import APIRouter
from pydantic import BaseModel

from .. import sku_lists

router = APIRouter(prefix="/api/sku-lists", tags=["sku-lists"])


class SkuListIn(BaseModel):
    skus: str


class SkuListOut(BaseModel):
    id: str
    count: int


@router.post("", response_model=SkuListOut)
def store_sku_list(body: SkuListIn):
    """Guarda un listado pegado por el usuario y devuelve un id corto.
    El frontend usa ese id en las queries GET siguientes (dashboard,
    products, executive, compare) via el parametro sku_list_id — para
    esquivar el limite de tamano de las URLs cuando hay miles de SKUs."""
    text = body.skus or ""
    list_id = sku_lists.store(text)
    # Contar SKUs no vacios: mismo criterio que parse_sku_list
    from ..filters import parse_sku_list
    count = len(parse_sku_list(text))
    return {"id": list_id, "count": count}
