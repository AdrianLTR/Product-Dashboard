from dataclasses import dataclass, field

from .departments import departamento_of

# Columnas conocidas del reporte de Sales Layer, mapeadas a campos propios.
# Todo lo que no calce aqui se guarda igual en `extra` (dict) sin perderse.
KNOWN_COLUMNS = {
    "Sku": "sku",
    "SKU": "sku",
    "Nombre": "nombre",
    "Familia": "familia",
    "Categoria eCommerce": "categoria_ecommerce",
    "Descripción detallada": "descripcion_detallada",
    "Foto descriptiva SL": "foto_descriptiva_sl",
    "Website": "website",
    "Estado SL": "estado_sl",
    "Marca": "marca",
    "Precio Regular": "precio_regular",
    "Precio Merca": "precio_merca",
    "Grupo de Articulo": "grupo_articulo",
    "Formato": "formato",
}


@dataclass
class Product:
    id: int = 0  # posicion dentro del reporte, no es un id global
    sku: str = ""
    nombre: str = ""
    familia: str = ""
    categoria_ecommerce: str = ""
    descripcion_detallada: str = ""
    foto_descriptiva_sl: str = ""
    website: str = ""
    estado_sl: str = ""
    marca: str = ""
    precio_regular: float | None = None
    precio_merca: float | None = None
    grupo_articulo: str = ""
    formato: str = ""
    extra: dict = field(default_factory=dict)
    # Derivado del grupo via Hoja Madre; no se persiste (siempre se recalcula
    # al leer, asi un cambio en el mapeo aplica sin re-subir reportes).
    departamento: str = field(default="", compare=False)

    def __post_init__(self):
        self.departamento = departamento_of(self.grupo_articulo)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "sku": self.sku,
            "nombre": self.nombre,
            "familia": self.familia,
            "categoria_ecommerce": self.categoria_ecommerce,
            "descripcion_detallada": self.descripcion_detallada,
            "foto_descriptiva_sl": self.foto_descriptiva_sl,
            "website": self.website,
            "estado_sl": self.estado_sl,
            "marca": self.marca,
            "precio_regular": self.precio_regular,
            "precio_merca": self.precio_merca,
            "grupo_articulo": self.grupo_articulo,
            "formato": self.formato,
            "extra": self.extra,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Product":
        known = {f: data.get(f) for f in cls.__dataclass_fields__ if f in data}
        return cls(**known)
