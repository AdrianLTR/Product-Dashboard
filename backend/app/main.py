from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routers import compare, dashboard, products, reports, stores

app = FastAPI(title="Product Hub CCN")

# Durante desarrollo el frontend corre en Vite (localhost:5173) y llama a esta API.
# En produccion se sirve el build de React desde este mismo proceso (ver abajo),
# asi que CORS solo hace falta para el modo dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reports.router)
app.include_router(dashboard.router)
app.include_router(stores.router)
app.include_router(products.router)
app.include_router(compare.router)

FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
