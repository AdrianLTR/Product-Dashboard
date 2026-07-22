import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { reportDate as fmtReportDate, reportSortValue } from "../dates";
import { useReports } from "../context/ReportContext";

function scoreColor(score) {
  if (score >= 90) return "var(--teal)";
  if (score >= 70) return "var(--amb)";
  return "var(--red)";
}

// Formato del delta: +N / -N. Numero con signo, sin nada si es 0.
function fmtDelta(v, opts = {}) {
  if (v === null || v === undefined) return null;
  const { decimals = 0 } = opts;
  const rounded = decimals ? v.toFixed(decimals) : Math.round(v).toString();
  if (v > 0) return `+${rounded}`;
  return rounded;
}

// Devuelve className y flecha para la tendencia del delta.
function trendClass(v, higherIsBetter = true) {
  if (v === null || v === undefined || v === 0) return "flat";
  const good = higherIsBetter ? v > 0 : v < 0;
  return good ? "up" : "down";
}
function trendArrow(v) {
  if (v === null || v === undefined || v === 0) return "•";
  return v > 0 ? "▲" : "▼";
}

// Renderiza un "kpi tile" con valor grande y delta abajo si hay reporte previo
function KpiTile({ label, value, delta, higherIsBetter = true, decimals = 0, format = (v) => v.toLocaleString() }) {
  const tc = trendClass(delta, higherIsBetter);
  return (
    <div className="kpi-tile">
      <div className="kpi-tile-l">{label}</div>
      <div className="kpi-tile-v">{format(value)}</div>
      {delta !== null && delta !== undefined && (
        <div className={"kpi-tile-t trend " + tc}>
          {trendArrow(delta)} {fmtDelta(delta, { decimals })}
          <span style={{ color: "var(--tx3)", marginLeft: 4 }}>vs anterior</span>
        </div>
      )}
    </div>
  );
}

function StoreCard({ store, hasPrev }) {
  const d = store.delta || {};
  const kpiTrend = trendClass(d.kpi_score);
  return (
    <div className="cc">
      <div className="sh" style={{ marginBottom: 12 }}>
        <div className="sh-t">
          <div className="sh-title" style={{ fontSize: 14 }}>{store.name}</div>
          <div className="sh-sub">{store.total.toLocaleString()} SKUs</div>
        </div>
        <div className="ml" style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 300, color: scoreColor(store.kpi_score) }}>
            {store.kpi_score.toFixed(1)}
          </div>
          {hasPrev && (
            <div className={"trend " + kpiTrend} style={{ fontSize: 10, justifyContent: "flex-end" }}>
              {trendArrow(d.kpi_score)} {fmtDelta(d.kpi_score, { decimals: 2 })} KPI
            </div>
          )}
        </div>
      </div>

      <div className="kpi-row">
        <KpiTile label="Visibles" value={store.visibles} delta={d.visibles} />
        <KpiTile label="Completos" value={store.completos} delta={d.completos} />
        <KpiTile label="Con Precio" value={store.con_precio} delta={d.con_precio} />
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {store.sin_familia > 0 && (
          <span className="bdg ms">Sin Familia: {store.sin_familia.toLocaleString()}{hasPrev && d.sin_familia !== 0 && ` (${fmtDelta(d.sin_familia)})`}</span>
        )}
        {store.sin_foto > 0 && (
          <span className="bdg ms">Sin Foto: {store.sin_foto.toLocaleString()}{hasPrev && d.sin_foto !== 0 && ` (${fmtDelta(d.sin_foto)})`}</span>
        )}
        {store.sin_nombre > 0 && (
          <span className="bdg ms">Sin Nombre: {store.sin_nombre.toLocaleString()}{hasPrev && d.sin_nombre !== 0 && ` (${fmtDelta(d.sin_nombre)})`}</span>
        )}
        {store.sin_categoria > 0 && (
          <span className="bdg ms">Sin Cat: {store.sin_categoria.toLocaleString()}{hasPrev && d.sin_categoria !== 0 && ` (${fmtDelta(d.sin_categoria)})`}</span>
        )}
        {store.sin_familia === 0 && store.sin_foto === 0 && store.sin_nombre === 0 && store.sin_categoria === 0 && (
          <span className="bdg ok">Sin pendientes</span>
        )}
      </div>
    </div>
  );
}

export default function Executive() {
  const { currentReportId, reports } = useReports();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [storeFilter, setStoreFilter] = useState("");

  // Reportes elegibles, ordenados por fecha del reporte (mas nuevo primero)
  const sorted = useMemo(
    () => [...reports].sort((a, b) => reportSortValue(b).localeCompare(reportSortValue(a))),
    [reports]
  );

  // Reporte a analizar (default: el activo) y contra cual comparar
  // ("" = automatico, el inmediatamente anterior por fecha).
  const [reportId, setReportId] = useState(currentReportId);
  const [compareId, setCompareId] = useState("");

  useEffect(() => {
    // Si cambia el reporte activo global, seguirlo por defecto
    setReportId(currentReportId);
  }, [currentReportId]);

  useEffect(() => {
    if (!reportId) return;
    setError(null);
    setData(null);
    api
      .getExecutive(reportId, compareId || undefined)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [reportId, compareId]);

  const visibleStores = useMemo(() => {
    if (!data) return [];
    const q = storeFilter.trim().toLowerCase();
    if (!q) return data.stores;
    return data.stores.filter((s) => s.name.toLowerCase().includes(q));
  }, [data, storeFilter]);

  if (!currentReportId) {
    return <div className="emp">Carga o selecciona un reporte primero en "Cargar Reporte".</div>;
  }

  return (
    <>
      <div className="exec-head no-print-hide">
        <div className="sh-t">
          <div className="exec-h1">Resumen Ejecutivo</div>
          <div className="exec-meta">
            {data ? (
              <>
                {data.current.filename} · {fmtReportDate(data.current)}
                {data.previous
                  ? <> · vs {data.previous.filename} ({fmtReportDate(data.previous)})</>
                  : <> · sin reporte de comparación — no hay deltas</>}
              </>
            ) : (
              "Cargando…"
            )}
          </div>
        </div>
        <div className="ml fb no-print" style={{ alignItems: "center" }}>
          <select value={reportId ?? ""} onChange={(e) => setReportId(Number(e.target.value))} title="Reporte a analizar">
            {sorted.map((r) => (
              <option key={r.id} value={r.id}>Reporte: {r.filename} ({fmtReportDate(r)})</option>
            ))}
          </select>
          <select value={compareId} onChange={(e) => setCompareId(e.target.value)} title="Comparar contra">
            <option value="">vs anterior (auto)</option>
            {sorted.filter((r) => r.id !== reportId).map((r) => (
              <option key={r.id} value={r.id}>vs {r.filename} ({fmtReportDate(r)})</option>
            ))}
          </select>
          <button className="btn" onClick={() => window.print()}>🖨 Imprimir / PDF</button>
        </div>
      </div>

      {error && <div className="emp">{error}</div>}
      {!data && !error && <div className="emp">Cargando…</div>}
      {data && (() => {
      const hasPrev = !!data.previous;
      const g = data.global;
      const gd = g.delta || {};
      return (
      <>


      {/* Hero global */}
      <div className="exec-hero">
        <div className="exec-score">
          <div className="exec-score-v" style={{ color: scoreColor(g.kpi_score) }}>
            {g.kpi_score.toFixed(1)}
          </div>
          <div className="exec-score-l">Score de calidad · de 100</div>
          {hasPrev && (
            <div className={"trend " + trendClass(gd.kpi_score)} style={{ justifyContent: "center" }}>
              {trendArrow(gd.kpi_score)} {fmtDelta(gd.kpi_score, { decimals: 2 })} vs anterior
            </div>
          )}
        </div>
        <div className="kpi-row">
          <KpiTile label="Total SKU" value={g.total} delta={gd.total} />
          <KpiTile label="Visibles" value={g.visibles} delta={gd.visibles} />
          <KpiTile label="Completos" value={g.completos} delta={gd.completos} />
          <KpiTile label="Con Precio" value={g.con_precio} delta={gd.con_precio} />
          <KpiTile label="Sin Foto" value={g.sin_foto} delta={gd.sin_foto} higherIsBetter={false} />
          <KpiTile label="Sin Familia" value={g.sin_familia} delta={gd.sin_familia} higherIsBetter={false} />
        </div>
      </div>

      {/* Cards por website */}
      <div className="sh no-print-hide" style={{ marginTop: 4 }}>
        <div className="sh-t">
          <div className="sh-title">Por Website</div>
          <div className="sh-sub">{data.stores.length} tiendas detectadas — ordenadas por volumen</div>
        </div>
        <div className="ml no-print">
          <input type="text" placeholder="Filtrar tienda…" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} />
        </div>
      </div>

      {visibleStores.length === 0 ? (
        <div className="emp">No hay tiendas que coincidan con el filtro.</div>
      ) : (
        <div className="ch2">
          {visibleStores.map((s) => (
            <StoreCard key={s.name} store={s} hasPrev={hasPrev} />
          ))}
        </div>
      )}
      </>
      );
      })()}
    </>
  );
}
