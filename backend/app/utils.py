import json
import unicodedata

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


def stores_of(website: str) -> list[str]:
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
    return out


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


def load_extra(extra: str) -> dict:
    try:
        return json.loads(extra) if extra else {}
    except json.JSONDecodeError:
        return {}
