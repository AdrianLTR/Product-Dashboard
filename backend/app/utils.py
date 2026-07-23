import json
import unicodedata
from functools import lru_cache

STORE_ALIASES: dict[str, str] = {
    # normalizar variantes de escritura del mismo sitio a un nombre canónico.
    # ej: "JUMBO.COM.DO": "JUMBO"
}


def is_empty(v) -> bool:
    if v is None:
        return True
    s = str(v).strip()
    return s == "" or s.lower() == "nan"


def normalize_store(s) -> str:
    s = str(s or "")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(s.strip().upper().split())


# stores_of se llama por cada fila dentro de cada filtro del dashboard. Con
# 77k productos y varios chips activos son cientos de miles de llamadas por
# request. El string "Website" se repite muchisimo entre productos, asi que
# cachearlo en un LRU convierte la mayoria en lookups O(1). Se devuelve tupla
# para que el resultado sea inmutable y compartible.
@lru_cache(maxsize=8192)
def stores_of(website: str) -> tuple[str, ...]:
    raw = str(website or "").split(",")
    out: list[str] = []
    seen: set[str] = set()
    for piece in raw:
        n = normalize_store(piece)
        if not n:
            continue
        canon = STORE_ALIASES.get(n, n)
        if canon not in seen:
            seen.add(canon)
            out.append(canon)
    return tuple(out)


def has_price(v) -> bool:
    if v is None or str(v).strip() == "":
        return False
    try:
        return float(v) > 0
    except (TypeError, ValueError):
        return False


def to_float(v):
    if v is None or str(v).strip() == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# Los 4 atributos del KPI score (25 pts c/u). Misma formula que usan el
# dashboard y la comparacion, centralizada para que Tendencia no divierja.
KPI_SCORE_ATTRS = [
    ("nombre", False),
    ("descripcion_detallada", False),
    ("precio_regular", True),
    ("foto_descriptiva_sl", False),
]

COMPLETENESS_FIELDS = [
    "nombre",
    "familia",
    "categoria_ecommerce",
    "descripcion_detallada",
    "foto_descriptiva_sl",
    "website",
    "estado_sl",
]


def kpi_score(rows) -> float:
    total = len(rows)
    if not total:
        return 0.0
    score = 0.0
    for key, is_price in KPI_SCORE_ATTRS:
        cnt = sum(
            1
            for r in rows
            if (has_price(getattr(r, key)) if is_price else not is_empty(getattr(r, key)))
        )
        score += round(cnt / total * 100) * 0.25
    return round(score, 2)


def is_complete(row) -> bool:
    return all(not is_empty(getattr(row, f)) for f in COMPLETENESS_FIELDS)


def is_priority(row) -> bool:
    """Prioridad maxima de trabajo: ya tiene foto (el insumo mas caro de
    conseguir) pero la ficha aun no esta completa. Cerrarlos es rapido porque
    solo falta contenido, no fotografia."""
    return not is_empty(row.foto_descriptiva_sl) and not is_complete(row)


def load_extra(extra: str) -> dict:
    try:
        return json.loads(extra) if extra else {}
    except json.JSONDecodeError:
        return {}
