import re

# Marcas propias (marca privada / private label) de CCN. Un producto de
# cualquiera de estas marcas cuenta como "marca propia" en el filtro del
# dashboard. Lista confirmada por el usuario.
PRIVATE_BRANDS_RAW = [
    "LIDER",
    "FOOD CLUB",
    "SIMPLY DONE",
    "Full Circle",
    "TOP CARE",
    "ORIGEN NACIONAL",
    "THAT'S SMART",
    "CAPE COVELLE",
    "TIPPY TOES",
    "PAWS",
    "IMPERIAL NUTS",
    "CULINARY TOURS",
    "CRAV'N FLAVOR",
    "OVER THE TOP",
    "SWEET P'S",
    "CONGELADOS DE NAVARRA",
    "BERGEN",
    "CHARKING",
    "CASA DE LOS AROMAS",
    "WIDE AWAKE",
    "MOKATE",
    "LOYD",
    "CREMICA",
    "BECENSE",
    "INKA CROPS",
    "TBEST",
    "JAKE",
    "AQUA DEUS",
    "PURE HARMONY",
    "FEIRACO",
    "CASA SUICA",
    "CUETARA",
    "LUPPO",
    "BISCOLATA",
    "GRETA",
    "ESFRE BOM",
    "NOVIC",
    "SANIL",
    "BETTA",
    "VERMEIREN",
    "REGGIA",
    "VIVALE",
    "LA SERENISIMA",
    "NATUR ALL",
    "CORNER SHOP",
    "SOMOSIERRA",
    "CHOCO FUN",
    "FLOR DE MAYO",
]


def normalize_brand(value: str) -> str:
    """Normaliza para comparar sin importar mayusculas, espacios extra o el
    tipo de apostrofe usado (recto vs curvo)."""
    s = str(value or "")
    s = s.replace("’", "'").replace("‘", "'")
    s = re.sub(r"\s+", " ", s.strip())
    return s.upper()


PRIVATE_BRANDS = frozenset(normalize_brand(b) for b in PRIVATE_BRANDS_RAW)


def is_private_brand(marca: str) -> bool:
    return normalize_brand(marca) in PRIVATE_BRANDS
