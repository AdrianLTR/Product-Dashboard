import json
from functools import lru_cache
from pathlib import Path

# Mapeo Grupo de Articulo -> Departamento (Hoja Madre). Los grupos sin
# departamento en la hoja, o que no aparecen, se agrupan como "Otros".
# El departamento se deriva en tiempo de lectura desde el grupo del producto,
# asi que los reportes ya cargados funcionan sin volver a subirlos.
_DATA = Path(__file__).parent / "data" / "grupo_departamento.json"
OTROS = "Otros"

try:
    _MAP: dict[str, str] = json.loads(_DATA.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError):
    _MAP = {}


@lru_cache(maxsize=8192)
def departamento_of(grupo: str | None) -> str:
    if not grupo:
        return OTROS
    return _MAP.get(str(grupo).strip(), OTROS)


def all_departamentos() -> list[str]:
    return sorted(set(_MAP.values()))
