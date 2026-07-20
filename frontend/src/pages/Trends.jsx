import { useEffect, useState } from "react";
import { api } from "../api";
import LineChart from "../components/LineChart";
import StatCard from "../components/StatCard";

function fmtDate(iso) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Trends() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getTrends().then(setData);
  }, []);

  if (!data) return <div className="emp">Cargando…</div>;

  const reports = data.reports;
  if (reports.length === 0) {
    return <div className="emp">Aún no hay reportes cargados. Ve a "Cargar Reporte".</div>;
  }

  const labels = reports.map((r) => fmtDate(r.uploaded_at));
  const last = reports[reports.length - 1];
  const prev = reports.length > 1 ? reports[reports.length - 2] : null;
  const delta = (a, b) => (prev ? a - b : null);
  const kpiDelta = prev ? (last.kpi_score - prev.kpi_score).toFixed(2) : null;

  return (
    <>
      <div className="sh">
        <div className="sh-t">
          <div className="sh-title">Tendencia</div>
          <div className="sh-sub">
            Evolución entre los {reports.length} reportes cargados — el valor de guardar el histórico
          </div>
        </div>
      </div>

      <div className="cgrid">
        <StatCard label="KPI actual" colorClass={last.kpi_score >= 90 ? "ct" : last.kpi_score >= 70 ? "ca" : "cr"} value={last.kpi_score.toFixed(2)} sub={kpiDelta !== null ? `${kpiDelta >= 0 ? "▲ +" : "▼ "}${kpiDelta} vs anterior` : "primer reporte"} />
        <StatCard label="Total SKU" value={last.total.toLocaleString()} sub={prev ? `${delta(last.total, prev.total) >= 0 ? "+" : ""}${delta(last.total, prev.total).toLocaleString()} vs anterior` : ""} />
        <StatCard label="Completos" colorClass="ct" value={last.completos.toLocaleString()} sub={prev ? `${delta(last.completos, prev.completos) >= 0 ? "+" : ""}${delta(last.completos, prev.completos).toLocaleString()} vs anterior` : ""} />
        <StatCard label="Con Precio" colorClass="cb" value={last.con_precio.toLocaleString()} />
        <StatCard label="Sin Foto" colorClass="ca" value={last.sin_foto.toLocaleString()} />
        <StatCard label="Sin Familia" colorClass="ca" value={last.sin_familia.toLocaleString()} />
      </div>

      {reports.length < 2 ? (
        <div className="emp">Con al menos dos reportes cargados verás aquí las gráficas de evolución.</div>
      ) : (
        <div className="ch2">
          <div className="cc">
            <div className="cc-t">Evolución del KPI Score (0–100)</div>
            <LineChart
              labels={labels}
              max={100}
              series={[{ name: "KPI Score", color: "#18c896", values: reports.map((r) => r.kpi_score) }]}
            />
          </div>
          <div className="cc">
            <div className="cc-t">Totales por reporte</div>
            <LineChart
              labels={labels}
              series={[
                { name: "Total SKU", color: "#4a9eff", values: reports.map((r) => r.total) },
                { name: "Completos", color: "#18c896", values: reports.map((r) => r.completos) },
                { name: "Con precio", color: "#a78bfa", values: reports.map((r) => r.con_precio) },
              ]}
            />
          </div>
          <div className="cc">
            <div className="cc-t">Pendientes por reporte</div>
            <LineChart
              labels={labels}
              series={[
                { name: "Sin foto", color: "#f0a030", values: reports.map((r) => r.sin_foto) },
                { name: "Sin familia", color: "#e04848", values: reports.map((r) => r.sin_familia) },
              ]}
            />
          </div>
        </div>
      )}

      <div className="cc">
        <div className="cc-t">Historial de reportes</div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Archivo</th>
                <th>Total</th>
                <th>KPI Score</th>
                <th>Completos</th>
                <th>Con Precio</th>
                <th>Sin Foto</th>
                <th>Sin Familia</th>
              </tr>
            </thead>
            <tbody>
              {[...reports].reverse().map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.uploaded_at).toLocaleString("es-DO")}</td>
                  <td>{r.filename}</td>
                  <td>{r.total.toLocaleString()}</td>
                  <td>
                    <span className={"bdg " + (r.kpi_score >= 90 ? "ok" : r.kpi_score >= 70 ? "ne" : "ms")}>
                      {r.kpi_score.toFixed(2)}
                    </span>
                  </td>
                  <td>{r.completos.toLocaleString()}</td>
                  <td>{r.con_precio.toLocaleString()}</td>
                  <td>{r.sin_foto.toLocaleString()}</td>
                  <td>{r.sin_familia.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
