import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import StatCard from "../components/StatCard";
import { useReports } from "../context/ReportContext";

export default function Compare() {
  const { reports } = useReports();
  const sorted = useMemo(
    () => [...reports].sort((a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at)),
    [reports]
  );
  const [targetId, setTargetId] = useState(null);
  const [baseId, setBaseId] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sorted.length) return;
    setTargetId((prev) => prev ?? sorted[sorted.length - 1].id);
    setBaseId((prev) => prev ?? sorted[sorted.length - 2]?.id ?? sorted[sorted.length - 1].id);
  }, [sorted]);

  useEffect(() => {
    if (!baseId || !targetId) return;
    setError(null);
    setData(null);
    api.compareReports(baseId, targetId).then(setData).catch((err) => setError(err.message));
  }, [baseId, targetId]);

  if (reports.length < 2) {
    return <div className="emp">Necesitas al menos dos reportes cargados para comparar. Ve a "Cargar Reporte".</div>;
  }

  return (
    <>
      <div className="sh">
        <div className="sh-t">
          <div className="sh-title">Comparar Reportes</div>
          <div className="sh-sub">Compara el reporte base (anterior) contra el reporte nuevo</div>
        </div>
        <div className="ml fb">
          <select value={baseId ?? ""} onChange={(e) => setBaseId(Number(e.target.value))}>
            {sorted.map((r) => (
              <option key={r.id} value={r.id}>Base: {r.filename} ({new Date(r.uploaded_at).toLocaleDateString("es-DO")})</option>
            ))}
          </select>
          <select value={targetId ?? ""} onChange={(e) => setTargetId(Number(e.target.value))}>
            {sorted.map((r) => (
              <option key={r.id} value={r.id}>Nuevo: {r.filename} ({new Date(r.uploaded_at).toLocaleDateString("es-DO")})</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="emp">{error}</div>}
      {!data && !error && <div className="emp">Cargando…</div>}

      {data && (
        <>
          <div className="cgrid">
            <StatCard label="Total antes" value={data.summary.total_before.toLocaleString()} />
            <StatCard label="Total ahora" value={data.summary.total_after.toLocaleString()} />
            <StatCard
              label="Delta SKUs"
              colorClass={data.summary.delta >= 0 ? "ct" : "cr"}
              value={(data.summary.delta >= 0 ? "+" : "") + data.summary.delta.toLocaleString()}
            />
            <StatCard label="Nuevos" colorClass="cb" value={data.summary.new_count.toLocaleString()} />
            <StatCard label="Eliminados" colorClass="cr" value={data.summary.removed_count.toLocaleString()} />
            <StatCard label="Modificados" colorClass="ca" value={data.summary.changed_count.toLocaleString()} />
            <StatCard label="KPI antes" value={data.summary.kpi_score_before.toFixed(2)} />
            <StatCard label="KPI ahora" value={data.summary.kpi_score_after.toFixed(2)} />
            <StatCard
              label="Delta KPI"
              colorClass={data.summary.kpi_score_delta >= 0 ? "ct" : "cr"}
              value={(data.summary.kpi_score_delta >= 0 ? "+" : "") + data.summary.kpi_score_delta.toFixed(2)}
            />
          </div>

          <div className="cc">
            <div className="cc-t">SKUs nuevos ({data.summary.new_count.toLocaleString()})</div>
            {data.new_skus.length ? (
              <div className="fb">
                {data.new_skus.map((sku) => (
                  <span key={sku} className="chip diff-add">{sku}</span>
                ))}
              </div>
            ) : (
              <div className="emp">Ninguno</div>
            )}
          </div>

          <div className="cc">
            <div className="cc-t">SKUs eliminados ({data.summary.removed_count.toLocaleString()})</div>
            {data.removed_skus.length ? (
              <div className="fb">
                {data.removed_skus.map((sku) => (
                  <span key={sku} className="chip diff-rem">{sku}</span>
                ))}
              </div>
            ) : (
              <div className="emp">Ninguno</div>
            )}
          </div>

          <div className="cc">
            <div className="cc-t">Productos modificados ({data.summary.changed_count.toLocaleString()})</div>
            {data.changed.length ? (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Nombre</th>
                      <th>Campo</th>
                      <th>Antes</th>
                      <th>Ahora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.changed.flatMap((c) =>
                      Object.entries(c.fields).map(([key, f]) => (
                        <tr key={c.sku + key}>
                          <td>{c.sku}</td>
                          <td title={c.nombre}>{c.nombre}</td>
                          <td>{f.label}</td>
                          <td className="diff-rem">{f.before || "—"}</td>
                          <td className="diff-add">{f.after || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="emp">Sin cambios de contenido en los SKUs comunes</div>
            )}
          </div>
        </>
      )}
    </>
  );
}
