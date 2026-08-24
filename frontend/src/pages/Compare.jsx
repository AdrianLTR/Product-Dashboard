import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import StatCard from "../components/StatCard";
import { reportDate, reportSortValue } from "../dates";
import { useReports } from "../context/ReportContext";

export default function Compare() {
  const { reports, compareBaseId, setCompareBaseId, compareTargetId, setCompareTargetId } = useReports();
  const sorted = useMemo(
    () => [...reports].sort((a, b) => reportSortValue(a).localeCompare(reportSortValue(b))),
    [reports]
  );
  const baseId = compareBaseId;
  const targetId = compareTargetId;
  const setBaseId = setCompareBaseId;
  const setTargetId = setCompareTargetId;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // SKU paste
  const [skuDraft, setSkuDraft] = useState("");
  const [skuList, setSkuList] = useState("");
  const [showSkuPanel, setShowSkuPanel] = useState(false);

  useEffect(() => {
    if (!sorted.length) return;
    const exists = (id) => sorted.some((r) => r.id === id);
    if (!targetId || !exists(targetId)) {
      setTargetId(sorted[sorted.length - 1].id);
    }
    if (!baseId || !exists(baseId)) {
      setBaseId(sorted[sorted.length - 2]?.id ?? sorted[sorted.length - 1].id);
    }
  }, [sorted, baseId, targetId, setBaseId, setTargetId]);

  function swapReports() {
    const b = baseId, t = targetId;
    setBaseId(t);
    setTargetId(b);
  }

  useEffect(() => {
    if (!baseId || !targetId) return;
    setError(null);
    setData(null);
    api.compareReports(baseId, targetId, skuList.trim() || undefined).then(setData).catch((err) => setError(err.message));
  }, [baseId, targetId, skuList]);

  if (reports.length < 2) {
    return <div className="emp">Necesitas al menos dos reportes cargados para comparar. Ve a "Cargar Reporte".</div>;
  }

  return (
    <>
      <div className="sh">
        <div className="sh-t">
          <div className="sh-title">Comparar Reportes</div>
          <div className="sh-sub">
            Compara el reporte base (anterior) contra el reporte nuevo
            {skuList.trim() && <> · <span style={{ color: "var(--teal)" }}>filtrado por listado de SKUs</span></>}
          </div>
        </div>
        <div className="ml fb">
          <select value={baseId ?? ""} onChange={(e) => setBaseId(Number(e.target.value))}>
            {sorted.map((r) => (
              <option key={r.id} value={r.id}>Base: {r.filename} ({reportDate(r)})</option>
            ))}
          </select>
          <select value={targetId ?? ""} onChange={(e) => setTargetId(Number(e.target.value))}>
            {sorted.map((r) => (
              <option key={r.id} value={r.id}>Nuevo: {r.filename} ({reportDate(r)})</option>
            ))}
          </select>
          <button className="btn" onClick={swapReports} title="Intercambiar base y nuevo">Invertir</button>
          <button
            className={"btn" + (skuList.trim() ? " pri" : "")}
            onClick={() => setShowSkuPanel((v) => !v)}
          >
            {skuList.trim() ? "Listado activo" : "Pegar SKUs"}
          </button>
          {baseId && targetId ? (
            <a className="btn" href={api.exportCompareUrl(baseId, targetId)}>Exportar Excel</a>
          ) : null}
        </div>
      </div>

      {showSkuPanel && (
        <div className="cc no-print" style={{ padding: "12px 14px" }}>
          <div className="sh" style={{ marginBottom: 8 }}>
            <div className="sh-t">
              <div className="sh-title" style={{ fontSize: 13 }}>Filtrar comparacion por listado de SKUs</div>
              <div className="sh-sub">Pega los SKUs (uno por linea, o separados por coma/espacio). La comparacion solo mostrara esos productos.</div>
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
            <StatCard label="Visibles antes" value={data.summary.visibles_antes.toLocaleString()} />
            <StatCard label="Visibles ahora" colorClass="ct" value={data.summary.visibles_ahora.toLocaleString()} />
            <StatCard
              label="Se volvieron Visibles"
              colorClass="ct"
              value={"+" + data.summary.became_visible_count.toLocaleString()}
              sub="entre estos dos reportes"
            />
            <StatCard
              label="Colocados Invisibles"
              colorClass={data.summary.became_invisible_count > 0 ? "cr" : "cw"}
              value={data.summary.became_invisible_count.toLocaleString()}
            />
          </div>

          {data.became_visible.length > 0 && (
            <div className="cc">
              <div className="cc-t">Se volvieron Visibles ({data.summary.became_visible_count.toLocaleString()})</div>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Nombre</th>
                      <th>Estado antes</th>
                      <th>Estado ahora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.became_visible.map((r) => (
                      <tr key={r.sku}>
                        <td>{r.sku}</td>
                        <td title={r.nombre}>{r.nombre}</td>
                        <td className="diff-rem">{r.estado_antes || "—"}</td>
                        <td className="diff-add">{r.estado_ahora}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
