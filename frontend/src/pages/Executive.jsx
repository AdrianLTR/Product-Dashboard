import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import DeltaModal from "../components/DeltaModal";
import DrillModal from "../components/DrillModal";
import { reportDate as fmtReportDate, reportSortValue } from "../dates";
import { useReports } from "../context/ReportContext";

const DRILL_PARAMS = {
  "Total SKU": {},
  "Visibles": { estado: "Visible" },
  "Drafts": { estado: "Draft" },
  "Completos": { kpi_types: "completos" },
  "⚡ Prioridad": { kpi_types: "prioridad" },
  "Con Precio": { kpi_types: "con-precio" },
  "Sin Foto": { kpi_types: "no-foto" },
  "Sin Familia": { kpi_types: "no-familia" },
  "Sin Nombre": { kpi_types: "no-nombre" },
  "Sin Cat": { kpi_types: "no-cat" },
};

const DELTA_INDICATORS = {
  "Total SKU": "total",
  "Visibles": "visibles",
  "Drafts": "drafts",
  "Completos": "completos",
  "⚡ Prioridad": "prioridad",
  "Con Precio": "con_precio",
  "Sin Foto": "sin_foto",
  "Sin Familia": "sin_familia",
  "Sin Nombre": "sin_nombre",
  "Sin Cat": "sin_categoria",
  "Entraron": "entrantes",
  "Salieron": "salientes",
  "Foto Nueva": "foto_nueva",
};

function scoreColor(score) {
  if (score >= 90) return "var(--teal)";
  if (score >= 70) return "var(--amb)";
  return "var(--red)";
}

function fmtDelta(v, opts = {}) {
  if (v === null || v === undefined) return null;
  const { decimals = 0 } = opts;
  const rounded = decimals ? v.toFixed(decimals) : Math.round(v).toString();
  if (v > 0) return `+${rounded}`;
  return rounded;
}

function trendClass(v, higherIsBetter = true) {
  if (v === null || v === undefined || v === 0) return "flat";
  const good = higherIsBetter ? v > 0 : v < 0;
  return good ? "up" : "down";
}
function trendArrow(v) {
  if (v === null || v === undefined || v === 0) return "•";
  return v > 0 ? "▲" : "▼";
}

function KpiTile({ label, value, delta, higherIsBetter = true, decimals = 0, format = (v) => v.toLocaleString(), onClick, onDeltaClick }) {
  const tc = trendClass(delta, higherIsBetter);
  return (
    <div
      className={"kpi-tile" + (onClick ? " clickable" : "")}
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
      title={onClick ? "Clic para ver el detalle" : undefined}
    >
      <div className="kpi-tile-l">{label}</div>
      <div className="kpi-tile-v">{format(value)}</div>
      {delta !== null && delta !== undefined && (
        <div
          className={"kpi-tile-t trend " + tc + (onDeltaClick ? " delta-link" : "")}
          onClick={onDeltaClick ? (e) => { e.stopPropagation(); onDeltaClick(); } : undefined}
          title={onDeltaClick ? "Clic para ver cuáles cambiaron" : undefined}
        >
          {trendArrow(delta)} {fmtDelta(delta, { decimals })}
          <span style={{ color: "var(--tx3)", marginLeft: 4 }}>
            vs anterior{onDeltaClick ? " ↗" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

function StoreCard({ store, hasPrev, onDrill, onDelta }) {
  const deltaFor = (label) => (hasPrev ? () => onDelta(label, store.name) : undefined);
  const d = store.delta || {};
  const kpiTrend = trendClass(d.kpi_score);
  const pend = (label, count, delta) =>
    count > 0 ? (
      <span
        className="bdg ms"
        style={{ cursor: "pointer" }}
        onClick={() => onDrill(label, store.name)}
        title={`Ver ${label} de ${store.name}`}
      >
        {label}: {count.toLocaleString()}{hasPrev && delta !== 0 && ` (${fmtDelta(delta)})`}
      </span>
    ) : null;

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
        <KpiTile label="Visibles" value={store.visibles} delta={d.visibles} onClick={() => onDrill("Visibles", store.name)} onDeltaClick={deltaFor("Visibles")} />
        <KpiTile
          label="Drafts"
          value={store.drafts ?? 0}
          delta={d.drafts}
          higherIsBetter={false}
          onClick={() => onDrill("Drafts", store.name)}
          onDeltaClick={deltaFor("Drafts")}
        />
        <KpiTile label="Completos" value={store.completos} delta={d.completos} onClick={() => onDrill("Completos", store.name)} onDeltaClick={deltaFor("Completos")} />
        <KpiTile label="Con Precio" value={store.con_precio} delta={d.con_precio} onClick={() => onDrill("Con Precio", store.name)} onDeltaClick={deltaFor("Con Precio")} />
        <KpiTile
          label="⚡ Prioridad"
          value={store.prioridad ?? 0}
          delta={d.prioridad}
          higherIsBetter={false}
          onClick={() => onDrill("⚡ Prioridad", store.name)}
          onDeltaClick={deltaFor("⚡ Prioridad")}
        />
      </div>

      {hasPrev && (store.entrantes > 0 || store.salientes > 0 || store.foto_nueva > 0) && (
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {store.entrantes > 0 && (
            <span className="bdg ok" style={{ cursor: "pointer" }} onClick={() => onDelta("Entraron", store.name)}>
              +{store.entrantes.toLocaleString()} entraron
            </span>
          )}
          {store.salientes > 0 && (
            <span className="bdg ms" style={{ cursor: "pointer" }} onClick={() => onDelta("Salieron", store.name)}>
              -{store.salientes.toLocaleString()} salieron
            </span>
          )}
          {store.foto_nueva > 0 && (
            <span className="bdg" style={{ cursor: "pointer", background: "var(--teal)", color: "#fff" }} onClick={() => onDelta("Foto Nueva", store.name)}>
              {store.foto_nueva.toLocaleString()} foto nueva
            </span>
          )}
        </div>
      )}

      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {pend("Sin Familia", store.sin_familia, d.sin_familia)}
        {pend("Sin Foto", store.sin_foto, d.sin_foto)}
        {pend("Sin Nombre", store.sin_nombre, d.sin_nombre)}
        {pend("Sin Cat", store.sin_categoria, d.sin_categoria)}
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

  const sorted = useMemo(
    () => [...reports].sort((a, b) => reportSortValue(b).localeCompare(reportSortValue(a))),
    [reports]
  );

  const [reportId, setReportId] = useState(currentReportId);
  const [compareId, setCompareId] = useState("");

  // SKU paste
  const [skuDraft, setSkuDraft] = useState("");
  const [skuList, setSkuList] = useState("");
  const [showSkuPanel, setShowSkuPanel] = useState(false);

  useEffect(() => {
    setReportId(currentReportId);
  }, [currentReportId]);

  useEffect(() => {
    if (!reportId) return;
    setError(null);
    setData(null);
    api
      .getExecutive(reportId, compareId || undefined, skuList.trim() || undefined)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [reportId, compareId, skuList]);

  const visibleStores = useMemo(() => {
    if (!data) return [];
    const q = storeFilter.trim().toLowerCase();
    if (!q) return data.stores;
    return data.stores.filter((s) => s.name.toLowerCase().includes(q));
  }, [data, storeFilter]);

  const [drill, setDrill] = useState(null);
  const openDrill = (label, website) => setDrill({ label, website });
  const [delta, setDelta] = useState(null);
  const openDelta = (label, website) => setDelta({ label, website });

  if (!currentReportId) {
    return <div className="emp">Carga o selecciona un reporte primero en "Cargar Reporte".</div>;
  }

  return (
    <>
      <div className="exec-head no-print-hide">
        <div className="sh-t">
          <div className="exec-h1">Resumen Ejecutivo</div>
          {data && (
            <div className="exec-dates">
              <span className="exec-date-cur">{fmtReportDate(data.current)}</span>
              {data.previous ? (
                <>
                  <span className="exec-date-vs">vs</span>
                  <span className="exec-date-prev">{fmtReportDate(data.previous)}</span>
                </>
              ) : (
                <span className="exec-date-vs">sin comparación</span>
              )}
            </div>
          )}
          <div className="exec-meta">
            {data ? (
              <>
                {data.current.filename}
                {data.previous
                  ? <> · vs {data.previous.filename}</>
                  : <> · no hay reporte de comparación, no hay deltas</>}
                {skuList.trim() && <> · <span style={{ color: "var(--teal)" }}>filtrado por listado de SKUs</span></>}
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
          <button
            className={"btn" + (skuList.trim() ? " pri" : "")}
            onClick={() => setShowSkuPanel((v) => !v)}
          >
            {skuList.trim() ? "Listado activo" : "Pegar SKUs"}
          </button>
          <button className="btn" onClick={() => window.print()}>Imprimir / PDF</button>
        </div>
      </div>

      {showSkuPanel && (
        <div className="cc no-print" style={{ padding: "12px 14px" }}>
          <div className="sh" style={{ marginBottom: 8 }}>
            <div className="sh-t">
              <div className="sh-title" style={{ fontSize: 13 }}>Filtrar resumen por listado de SKUs</div>
              <div className="sh-sub">Pega los SKUs (uno por linea, o separados por coma/espacio). El resumen y los deltas se calculan solo con esos SKUs — cada uno se compara contra su version en el reporte anterior.</div>
            </div>
          </div>
          <textarea
            value={skuDraft}
            onChange={(e) => setSkuDraft(e.target.value)}
            placeholder={"SKU001\nSKU002\nSKU003…"}
            style={{ width: "100%", minHeight: 90, background: "var(--sur)", border: "1px solid var(--b2)", borderRadius: 6, color: "var(--tx)", fontFamily: "var(--mono)", fontSize: 12, padding: 8, resize: "vertical" }}
          />
          <div className="fb" style={{ marginTop: 8 }}>
            <button className="btn pri" onClick={() => setSkuList(skuDraft)}>Aplicar listado</button>
            <button className="btn" onClick={() => { setSkuDraft(""); setSkuList(""); }}>Quitar listado</button>
          </div>
        </div>
      )}

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
          <KpiTile label="Total SKU" value={g.total} delta={gd.total} onClick={() => openDrill("Total SKU", null)} onDeltaClick={hasPrev ? () => openDelta("Total SKU", null) : undefined} />
          <KpiTile label="Visibles" value={g.visibles} delta={gd.visibles} onClick={() => openDrill("Visibles", null)} onDeltaClick={hasPrev ? () => openDelta("Visibles", null) : undefined} />
          <KpiTile
            label="Drafts"
            value={g.drafts ?? 0}
            delta={gd.drafts}
            higherIsBetter={false}
            onClick={() => openDrill("Drafts", null)}
            onDeltaClick={hasPrev ? () => openDelta("Drafts", null) : undefined}
          />
          <KpiTile label="Completos" value={g.completos} delta={gd.completos} onClick={() => openDrill("Completos", null)} onDeltaClick={hasPrev ? () => openDelta("Completos", null) : undefined} />
          <KpiTile
            label="⚡ Prioridad"
            value={g.prioridad ?? 0}
            delta={gd.prioridad}
            higherIsBetter={false}
            onClick={() => openDrill("⚡ Prioridad", null)}
            onDeltaClick={hasPrev ? () => openDelta("⚡ Prioridad", null) : undefined}
          />
          <KpiTile label="Con Precio" value={g.con_precio} delta={gd.con_precio} onClick={() => openDrill("Con Precio", null)} onDeltaClick={hasPrev ? () => openDelta("Con Precio", null) : undefined} />
          <KpiTile label="Sin Foto" value={g.sin_foto} delta={gd.sin_foto} higherIsBetter={false} onClick={() => openDrill("Sin Foto", null)} onDeltaClick={hasPrev ? () => openDelta("Sin Foto", null) : undefined} />
          <KpiTile label="Sin Familia" value={g.sin_familia} delta={gd.sin_familia} higherIsBetter={false} onClick={() => openDrill("Sin Familia", null)} onDeltaClick={hasPrev ? () => openDelta("Sin Familia", null) : undefined} />
          {hasPrev && (
            <>
              <KpiTile
                label="Entraron"
                value={g.entrantes ?? 0}
                delta={null}
                onClick={() => openDelta("Entraron", null)}
              />
              <KpiTile
                label="Salieron"
                value={g.salientes ?? 0}
                delta={null}
                higherIsBetter={false}
                onClick={() => openDelta("Salieron", null)}
              />
              <KpiTile
                label="Foto Nueva"
                value={g.foto_nueva ?? 0}
                delta={null}
                onClick={() => openDelta("Foto Nueva", null)}
              />
            </>
          )}
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
            <StoreCard key={s.name} store={s} hasPrev={hasPrev} onDrill={openDrill} onDelta={openDelta} />
          ))}
        </div>
      )}
      </>
      );
      })()}

      {drill && (
        <DrillModal
          reportId={reportId}
          title={`${drill.label}${drill.website ? " · " + drill.website : " · Todos los websites"}`}
          subtitle={data ? `${data.current.filename} (${fmtReportDate(data.current)})` : ""}
          params={{ ...(DRILL_PARAMS[drill.label] || {}), ...(drill.website ? { website: drill.website } : {}) }}
          onClose={() => setDrill(null)}
        />
      )}

      {delta && (
        <DeltaModal
          reportId={reportId}
          indicator={DELTA_INDICATORS[delta.label]}
          label={delta.label}
          website={delta.website}
          compareId={compareId || undefined}
          skus={skuList.trim() || undefined}
          onClose={() => setDelta(null)}
        />
      )}
    </>
  );
}
