import re
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .. import importer, storage
from ..schemas import ReportOut

router = APIRouter(prefix="/api/reports", tags=["reports"])

ALLOWED_EXTENSIONS = (".xlsx", ".xlsm")

# Directorio para ensamblar cargas en pedazos (chunks). Se usa cuando el
# proxy intermedio (Codespaces, un balancer, etc.) impone un limite de
# tamano de POST y el .xlsx completo no cabe en una sola request.
UPLOAD_TMP = Path(tempfile.gettempdir()) / "product_hub_uploads"
UPLOAD_TMP.mkdir(parents=True, exist_ok=True)

# UUID v4 con guiones (formato que emite crypto.randomUUID() del navegador).
_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def _validate_filename(filename: str) -> None:
    if not filename.lower().endswith(ALLOWED_EXTENSIONS):
        raise HTTPException(400, "Solo se aceptan archivos .xlsx")


def _process(filename: str, content: bytes) -> dict:
    try:
        return importer.import_xlsx(filename, content)
    except Exception as exc:  # noqa: BLE001 - error de parseo del archivo del usuario
        raise HTTPException(400, f"No se pudo procesar el archivo: {exc}") from exc


@router.post("/upload", response_model=ReportOut)
async def upload_report(file: UploadFile):
    """Carga directa en una sola request. Sirve para llamadas desde curl u otras
    herramientas cuando no hay limite de tamano de POST. Desde el frontend web
    se usa /upload/chunk para evitar el limite del proxy."""
    _validate_filename(file.filename)
    content = await file.read()
    return _process(file.filename, content)


@router.post("/upload/chunk")
async def upload_chunk(
    upload_id: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(..., ge=1),
    filename: str = Form(...),
    chunk: UploadFile = File(...),
):
    """Recibe un pedazo del archivo. Cuando llega el ultimo, ensambla todo,
    procesa el reporte y devuelve el ReportOut. Para pedazos intermedios
    devuelve {"received": N, "total": M} solo para reportar progreso."""
    if not _UUID_RE.match(upload_id):
        raise HTTPException(400, "upload_id invalido")
    if not (0 <= chunk_index < total_chunks):
        raise HTTPException(400, "chunk_index fuera de rango")
    _validate_filename(filename)

    session_dir = UPLOAD_TMP / upload_id
    session_dir.mkdir(parents=True, exist_ok=True)
    chunk_path = session_dir / f"{chunk_index:06d}"
    chunk_path.write_bytes(await chunk.read())

    if chunk_index < total_chunks - 1:
        received = len(list(session_dir.iterdir()))
        return {"received": received, "total": total_chunks}

    # Ultimo pedazo: ensamblar y procesar.
    try:
        parts = sorted(session_dir.iterdir())
        if len(parts) != total_chunks:
            raise HTTPException(
                400,
                f"Faltan pedazos: recibidos {len(parts)} de {total_chunks}. "
                "Vuelve a intentar la carga.",
            )
        full = b"".join(p.read_bytes() for p in parts)
        return _process(filename, full)
    finally:
        shutil.rmtree(session_dir, ignore_errors=True)


@router.get("", response_model=list[ReportOut])
def list_reports():
    return storage.list_reports()


@router.get("/{report_id}", response_model=ReportOut)
def get_report(report_id: int):
    meta = storage.get_report_meta(report_id)
    if not meta:
        raise HTTPException(404, "Reporte no encontrado")
    return meta


@router.delete("/{report_id}")
def delete_report(report_id: int):
    if not storage.delete_report(report_id):
        raise HTTPException(404, "Reporte no encontrado")
    return {"ok": True}
