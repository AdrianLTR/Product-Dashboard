import io

import pandas as pd

from . import storage
from .product import KNOWN_COLUMNS, Product
from .utils import to_float


def import_xlsx(filename: str, file_bytes: bytes) -> dict:
    """Lee la primera hoja del xlsx y guarda un nuevo reporte (snapshot).
    Cada carga es independiente de las anteriores, para poder comparar
    contra el ultimo reporte mas adelante."""
    df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=0, dtype=str)
    df.columns = [str(c).strip() for c in df.columns]
    df = df.fillna("")

    products = []
    for idx, row in enumerate(df.to_dict(orient="records")):
        mapped: dict = {}
        extra: dict = {}
        for col, value in row.items():
            field = KNOWN_COLUMNS.get(col)
            if field:
                mapped[field] = value
            else:
                extra[col] = value

        products.append(
            Product(
                id=idx,
                sku=str(mapped.get("sku", "")).strip(),
                nombre=mapped.get("nombre", ""),
                familia=mapped.get("familia", ""),
                categoria_ecommerce=mapped.get("categoria_ecommerce", ""),
                descripcion_detallada=mapped.get("descripcion_detallada", ""),
                foto_descriptiva_sl=mapped.get("foto_descriptiva_sl", ""),
                website=mapped.get("website", ""),
                estado_sl=mapped.get("estado_sl", ""),
                marca=mapped.get("marca", ""),
                precio_regular=to_float(mapped.get("precio_regular")),
                precio_merca=to_float(mapped.get("precio_merca")),
                grupo_articulo=mapped.get("grupo_articulo", ""),
                formato=mapped.get("formato", ""),
                etiquetas_sl=mapped.get("etiquetas_sl", ""),
                descripcion_sap=mapped.get("descripcion_sap", ""),
                extra=extra,
            )
        )

    return storage.save_report(filename, products)
