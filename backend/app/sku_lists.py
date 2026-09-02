"""Cache in-memory de listados de SKUs pegados por el usuario.

Se necesita porque una lista de miles de SKUs no cabe en una query string
(limite ~8-16 KB del servidor, ~32 KB de Chrome). El frontend hace POST a
/api/sku-lists con el texto pegado, recibe un id corto, y luego usa ese
id en todas las queries GET que necesiten filtrar por esa lista.

La cache vive solo en memoria de este proceso — si el server reinicia,
todos los ids invalidan y el frontend re-postea automaticamente. Se
evictan las entradas viejas (TTL) y se cap-ea el tamano.
"""
import hashlib
import time
from threading import Lock

# id (hex) -> (skus_text, timestamp)
_STORE: dict[str, tuple[str, float]] = {}
_LOCK = Lock()
_TTL_SEC = 60 * 60 * 8      # 8 horas — suficiente para una jornada de trabajo
_MAX_ENTRIES = 200          # tope de memoria: 200 listas activas


def _evict() -> None:
    """Elimina entradas expiradas y, si sigue habiendo demasiadas, las
    mas viejas hasta bajar del tope. Se llama con el lock tomado."""
    now = time.time()
    expired = [k for k, (_, t) in _STORE.items() if now - t > _TTL_SEC]
    for k in expired:
        _STORE.pop(k, None)
    if len(_STORE) > _MAX_ENTRIES:
        # Ordenar por timestamp asc y eliminar las N mas viejas
        sobrantes = sorted(_STORE.items(), key=lambda kv: kv[1][1])[: len(_STORE) - _MAX_ENTRIES]
        for k, _ in sobrantes:
            _STORE.pop(k, None)


def store(skus_text: str) -> str:
    """Guarda un listado y devuelve el id. Si el mismo listado ya esta
    guardado (mismo hash), devuelve el mismo id — asi el frontend puede
    postear varias veces sin generar basura."""
    skus_text = (skus_text or "").strip()
    if not skus_text:
        return ""
    # id determinista: primeros 16 hex del sha256
    key = hashlib.sha256(skus_text.encode("utf-8")).hexdigest()[:16]
    with _LOCK:
        _evict()
        _STORE[key] = (skus_text, time.time())
    return key


def get(list_id: str | None) -> str | None:
    """Devuelve el texto guardado, o None si el id no existe (expiro o
    nunca se guardo). El frontend maneja el None re-posteando."""
    if not list_id:
        return None
    with _LOCK:
        entry = _STORE.get(list_id)
        if entry is None:
            return None
        # Refresh timestamp: si se sigue usando, no expira
        _STORE[list_id] = (entry[0], time.time())
        return entry[0]
