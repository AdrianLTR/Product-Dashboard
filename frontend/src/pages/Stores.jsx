import { useEffect, useState } from "react";
import { api } from "../api";
import { useReports } from "../context/ReportContext";

export default function Stores() {
  const { currentReportId } = useReports();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!currentReportId) return;
    api.getStores(currentReportId).then(setData);
  }, [currentReportId]);

  if (!currentReportId) {
    return <div className="emp">Carga o selecciona un reporte primero en "Cargar Reporte".</div>;
  }
  if (!data) return <div className="emp">Cargando…</div>;

  return (
    <>
      <div className="sh">
        <div className="sh-t">
          <div className="sh-title">Métricas por Website</div>
          <div className="sh-sub">Completitud y precio por tienda, un producto puede estar en varias</div>
        </div>
        <div className="ml">
          <a className="btn" href={api.exportStoresUrl(currentReportId)}>↓ Exportar Excel</a>
        </div>
      </div>

      {data.stores.length === 0 ? (
        <div className="emp">No se detectaron websites en la columna "Website" de este reporte.</div>
      ) : (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Website</th>
                <th>Total</th>
                <th>Completos</th>
                <th>% Completo</th>
                <th>Sin Familia</th>
                <th>Sin Cat.</th>
                <th>Sin Foto</th>
                <th>Con Precio</th>
                <th>Sin Precio</th>
              </tr>
            </thead>
            <tbody>
              {data.stores.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>{s.total.toLocaleString()}</td>
                  <td>{s.completos.toLocaleString()}</td>
                  <td>
                    <span className={"bdg " + (s.completos_pct >= 90 ? "ok" : s.completos_pct >= 60 ? "ne" : "ms")}>
                      {s.completos_pct}%
                    </span>
                  </td>
                  <td>{s.sin_familia.toLocaleString()}</td>
                  <td>{s.sin_categoria.toLocaleString()}</td>
                  <td>{s.sin_foto.toLocaleString()}</td>
                  <td>{s.con_precio.toLocaleString()}</td>
                  <td>{s.sin_precio.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
