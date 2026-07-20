from fastapi import APIRouter, HTTPException, UploadFile

from .. import importer, storage
from ..schemas import ReportOut

router = APIRouter(prefix="/api/reports", tags=["reports"])

ALLOWED_EXTENSIONS = (".xlsx", ".xlsm")


@router.post("/upload", response_model=ReportOut)
async def upload_report(file: UploadFile):
    if not file.filename.lower().endswith(ALLOWED_EXTENSIONS):
        raise HTTPException(400, "Solo se aceptan archivos .xlsx")
    content = await file.read()
    try:
        meta = importer.import_xlsx(file.filename, content)
    except Exception as exc:  # noqa: BLE001 - error de parseo del archivo del usuario
        raise HTTPException(400, f"No se pudo procesar el archivo: {exc}") from exc
    return meta


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
