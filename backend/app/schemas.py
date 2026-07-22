import datetime

from pydantic import BaseModel, ConfigDict


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    uploaded_at: datetime.datetime
    report_date: str | None = None  # fecha del archivo (YYYY-MM-DD) si se pudo deducir
    row_count: int


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku: str
    nombre: str
    familia: str
    categoria_ecommerce: str
    descripcion_detallada: str
    foto_descriptiva_sl: str
    website: str
    estado_sl: str
    marca: str
    precio_regular: float | None
    precio_merca: float | None
    grupo_articulo: str
    formato: str
    departamento: str = ""


class ProductPage(BaseModel):
    total: int
    items: list[ProductOut]
