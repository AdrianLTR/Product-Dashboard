import { useRef, useState } from "react";
import { api } from "../api";
import { reportDate } from "../dates";
import { useReports } from "../context/ReportContext";
import { useToast } from "../context/ToastContext";

export default function Upload() {
  const { reports, currentReportId, setCurrentReportId, refreshReports } = useReports();
  const toast = useToast();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // {done, total}
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx") && !file.name.toLowerCase().endsWith(".xlsm")) {
      toast("Solo se aceptan archivos .xlsx", "err");
      return;
    }
    setBusy(true);
    setProgress({ done: 0, total: 1 });
    try {
      const report = await api.uploadReport(file, (done, total) => setProgress({ done, total }));
      await refreshReports();
      setCurrentReportId(report.id);
      toast(`${report.row_count.toLocaleString()} productos cargados`, "ok");
    } catch (err) {
      toast(`Error al procesar el archivo: ${err.message}`, "err", 6000);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function handleDelete(id) {
    if (!confirm("¿Eliminar este reporte y sus productos? No se puede deshacer.")) return;
    await api.deleteReport(id);
    await refreshReports();
    toast("Reporte eliminado", "inf");
  }

  return (
    <>
      <div className="sh">
        <div className="sh-t">
          <div className="sh-title">Cargar Reporte</div>
          <div className="sh-sub">Cada carga crea un snapshot nuevo, sin borrar los anteriores — asi se puede comparar</div>
        </div>
      </div>

      <div
        className={"upz" + (dragging ? " drag" : "")}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
      >
        <div className="upz-txt">
          <strong>
            {busy
              ? progress && progress.total > 1
                ? `Subiendo ${progress.done} / ${progress.total} (${Math.round((progress.done / progress.total) * 100)}%)…`
                : "Procesando…"
              : "Arrastra el .xlsx aquí o haz clic"}
          </strong>
          {!busy && "Reporte de Sales Layer (primera hoja)"}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm"
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      <div className="cc">
        <div className="cc-t">Reportes cargados ({reports.length})</div>
        {reports.length === 0 ? (
          <div className="emp">Aún no hay reportes. Carga el primero arriba.</div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Fecha del reporte</th>
                  <th>Cargado</th>
                  <th>Productos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td>{r.filename}</td>
                    <td>{reportDate(r)}</td>
                    <td>{new Date(r.uploaded_at).toLocaleString("es-DO")}</td>
                    <td>{r.row_count.toLocaleString()}</td>
                    <td className="fb">
                      <button
                        className="btn"
                        disabled={r.id === currentReportId}
                        onClick={() => setCurrentReportId(r.id)}
                      >
                        {r.id === currentReportId ? "Activo" : "Usar"}
                      </button>
                      <button className="btn dng" onClick={() => handleDelete(r.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
