import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import Bar from "../components/Bar";
import FotoCell from "../components/FotoCell";
import StatCard from "../components/StatCard";
import { useFilters } from "../context/FiltersContext";
import { useReports } from "../context/ReportContext";

function scoreColor(score) {
  if (score >= 90) return "var(--teal)";
  if (score >= 70) return "var(--amb)";
  return "var(--red)";
}

// Mapea el nombre de tarjeta con el ID del filtro KPI (mismo que espera el backend)
const KPI_LABELS = {
  completos: "Completos",
  "no-familia": "Sin Familia",
  "no-cat": "Sin Categoría",
  "no-nombre": "Sin Nombre",
  "no-foto": "Sin Foto",
  "con-precio": "Con Precio",
  "no-precio": "Sin Precio",
};

const EMBEDDED_LIMIT = 500;

export default function Dashboard() {
  const { currentReportId } = useReports();
  const {
    chips, toggleChip, setEstadoExclusive, formato, setFormato, sku, setSku,
    nombre, setNombre, marca, setMarca, familia, setFamilia,
    kpiTypes, toggleKpiType, setKpiTypes, skuList, setSkuList, reset, asQuery,
  } = useFilters();
  const [data, setData] = useState(null);
  const [tableData, setTableData] = useState(null);

  // Panel de "cargar listado de SKUs": textarea local que se aplica con boton
  const [showSkuPanel, setShowSkuPanel] = useState(false);
  const [skuDraft, setSkuDraft] = useState(skuList);
  useEffect(() => setSkuDraft(skuList), [skuList]);

  // Los inputs se manejan en estado local (draft) y solo se aplican al
  // contexto de filtros con Enter o el boton Aplicar. Evita disparar una
  // peticion por cada tecla y saturar al backend.
  const [draft, setDraft] = useState({ sku, nombre, marca, familia, formato });
  useEffect(() => {
    setDraft({ sku, nombre, marca, familia, formato });
  }, [sku, nombre, marca, familia, formato]);
  const hasPendingChanges = useMemo(
    () =>
      draft.sku !== sku ||
      draft.nombre !== nombre ||
      draft.marca !== marca ||
      draft.familia !== familia ||
      draft.formato !== formato,
    [draft, sku, nombre, marca, familia, formato]
  );
  function applyDraft() {
    setSku(draft.sku);
    setNombre(draft.nombre);
    setMarca(draft.marca);
    setFamilia(draft.familia);
    setFormato(draft.formato);
  }

  useEffect(() => {
    if (!currentReportId) return;
    // Pasar tambien kpi_types para que el KPI score y las tarjetas reflejen
    // la seleccion de toggles (Sin Foto, etc), igual que la tabla.
    api.getDashboard(currentReportId, { ...asQuery, kpi_types: kpiTypes.join(",") }).then(setData);
  }, [currentReportId, asQuery, kpiTypes]);

  // La tabla embebida se actualiza cuando cambian los filtros del dashboard,
  // los tipos KPI seleccionados o el reporte activo.
  useEffect(() => {
    if (!currentReportId) return;
    api
      .getProducts(currentReportId, {
        ...asQuery,
        kpi_types: kpiTypes.join(","),
        offset: 0,
        limit: EMBEDDED_LIMIT,
      })
      .then(setTableData);
  }, [currentReportId, asQuery, kpiTypes]);

  if (!currentReportId) {
    return <div className="emp">Carga o selecciona un reporte primero en "Cargar Reporte".</div>;
  }
  if (!data) return <div className="emp">Cargando…</div>;

  const isTypeActive = (t) => kpiTypes.includes(t);
  const anyKpiActive = kpiTypes.length > 0;

  const exportUrl = api.exportProductsUrl(currentReportId, {
    ...asQuery,
    kpi_types: kpiTypes.join(","),
  });

  // Focos de atencion: brechas mas grandes, ordenadas por cantidad. Sirven
  // como worklist para el equipo — donde poner foco esta semana.
  const focos = [
    { key: "no-familia", label: "Sin Familia", count: data.cards.sin_familia, click: () => toggleKpiType("no-familia"), active: isTypeActive("no-familia") },
    { key: "no-cat", label: "Sin Categoría", count: data.cards.sin_categoria, click: () => toggleKpiType("no-cat"), active: isTypeActive("no-cat") },
    { key: "no-foto", label: "Sin Foto", count: data.cards.sin_foto, click: () => toggleKpiType("no-foto"), active: isTypeActive("no-foto") },
    { key: "no-precio", label: "Sin Precio", count: data.cards.sin_precio, click: () => toggleKpiType("no-precio"), active: isTypeActive("no-precio") },
    { key: "no-nombre", label: "Sin Nombre", count: data.cards.sin_nombre, click: () => toggleKpiType("no-nombre"), active: isTypeActive("no-nombre") },
  ]
    .map((f) => ({ ...f, pct: data.total ? Math.round((f.count / data.total) * 100) : 0 }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  return (
    <div className="dash-grid">
      {/* Rail izquierdo: resumen ejecutivo del reporte (score + composición + focos) */}
      <aside className="dash-rail">
        <div>
          <div className="dash-rail-title">Score de calidad</div>
          <div className="kpi-score-val" style={{ color: scoreColor(data.kpi_score) }}>
            {data.kpi_score.toFixed(1)}
          </div>
          <div className="sc-s">de 100 · {data.total.toLocaleString()} SKUs</div>
        </div>
        <div>
          <div className="dash-rail-title">Composición · 25 pts c/u</div>
          {data.kpi_attrs.map((a) => (
            <Bar key={a.key} label={a.label} value={a.pct} max={100} color={a.color} right={`${a.pct}%`} />
          ))}
        </div>
        <div>
          <div className="dash-rail-title">Focos de atención</div>
          {focos.length === 0 ? (
            <div className="foco ok">
              <span className="foco-label">Sin pendientes</span>
              <span className="foco-n">✓</span>
            </div>
          ) : (
            focos.map((f) => (
              <div
                key={f.key}
                className={"foco" + (f.pct >= 30 ? " crit" : "") + (f.active ? " active" : "")}
                onClick={f.click}
                style={{ cursor: "pointer", opacity: f.active ? 1 : undefined }}
                title="Clic para filtrar la tabla"
              >
                <span className="foco-label">{f.label}</span>
                <span className="foco-n">{f.count.toLocaleString()} · {f.pct}%</span>
              </div>
            ))
          )}
        </div>
      </aside>

      <div className="dash-main">
      <div className="sh">
        <div className="sh-t">
          <div className="sh-title">Dashboard</div>
          <div className="sh-sub">{data.total.toLocaleString()} productos con los filtros activos</div>
        </div>
      </div>

      <form className="filter-bar" onSubmit={(e) => { e.preventDefault(); applyDraft(); }}>
        <input type="text" placeholder="Buscar SKU…" value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} />
        <input type="text" placeholder="Buscar nombre…" value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />
        <input type="text" placeholder="Buscar marca…" value={draft.marca} onChange={(e) => setDraft({ ...draft, marca: e.target.value })} />
        <input type="text" placeholder="Buscar familia…" value={draft.familia} onChange={(e) => setDraft({ ...draft, familia: e.target.value })} />
        <input type="text" placeholder="Buscar formato…" value={draft.formato} onChange={(e) => setDraft({ ...draft, formato: e.target.value })} />
        <button type="submit" className={"btn " + (hasPendingChanges ? "pri" : "")}>
          {hasPendingChanges ? "Aplicar" : "Buscar"}
        </button>
        <button type="button" className="btn" onClick={reset}>Limpiar</button>
        <button
          type="button"
          className={"btn" + (skuList.trim() ? " pri" : "")}
          onClick={() => setShowSkuPanel((v) => !v)}
          style={{ marginLeft: "auto" }}
        >
          {skuList.trim()
            ? `Listado activo (${data.sku_list_report?.requested ?? "…"})`
            : "↥ Cargar listado de SKUs"}
        </button>
      </form>

      {showSkuPanel && (
        <div className="cc" style={{ padding: "12px 14px" }}>
          <div className="sh" style={{ marginBottom: 8 }}>
            <div className="sh-t">
              <div className="sh-title" style={{ fontSize: 13 }}>Comparar listado de SKUs contra este reporte</div>
              <div className="sh-sub">Pega los SKUs (uno por línea, o separados por coma/espacio). El dashboard mostrará solo esos.</div>
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
            {data.sku_list_report && (
              <span className="sh-sub" style={{ marginLeft: "auto" }}>
                {data.sku_list_report.requested.toLocaleString()} pegados ·{" "}
                <span className="diff-add">{data.sku_list_report.found.toLocaleString()} encontrados</span> ·{" "}
                <span className="diff-rem">{data.sku_list_report.missing_count.toLocaleString()} no están en el reporte</span>
              </span>
            )}
          </div>
          {data.sku_list_report && data.sku_list_report.missing_count > 0 && (
            <div className="sh-sub" style={{ marginTop: 8 }}>
              No encontrados: <span style={{ fontFamily: "var(--mono)", color: "var(--red)" }}>
                {data.sku_list_report.missing.slice(0, 60).join(", ")}
                {data.sku_list_report.missing_count > 60 && ` … (+${(data.sku_list_report.missing_count - 60).toLocaleString()})`}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="fb">
        {data.filters.stores.map((s) => (
          <span key={s} className={"chip" + (chips.web.includes(s) ? " on" : "")} onClick={() => toggleChip("web", s)}>
            {s}
          </span>
        ))}
      </div>
      <div className="fb">
        {["Visible", "Draft", "Invisible"].map((e) => (
          <span
            key={e}
            className={"chip" + (chips.estado.includes(e) ? " on" : "")}
            onClick={() => setEstadoExclusive(e)}
          >
            {e}
          </span>
        ))}
      </div>

      <div className="cgrid">
        <StatCard
          label="Total SKU"
          value={data.cards.total.toLocaleString()}
          onClick={() => setKpiTypes([])}
          active={!anyKpiActive}
          title="Clic para limpiar filtros KPI (mostrar todos)"
        />
        <StatCard label="Completos" colorClass="ct" value={data.cards.completos.toLocaleString()} onClick={() => toggleKpiType("completos")} active={isTypeActive("completos")} />
        <StatCard label="Sin Familia" colorClass="ca" value={data.cards.sin_familia.toLocaleString()} onClick={() => toggleKpiType("no-familia")} active={isTypeActive("no-familia")} />
        <StatCard label="Sin Cat." colorClass="ca" value={data.cards.sin_categoria.toLocaleString()} onClick={() => toggleKpiType("no-cat")} active={isTypeActive("no-cat")} />
        <StatCard label="Sin Nombre" colorClass="cr" value={data.cards.sin_nombre.toLocaleString()} onClick={() => toggleKpiType("no-nombre")} active={isTypeActive("no-nombre")} />
        <StatCard label="Sin Foto" colorClass="ca" value={data.cards.sin_foto.toLocaleString()} onClick={() => toggleKpiType("no-foto")} active={isTypeActive("no-foto")} />
        <StatCard label="Con Precio" colorClass="ct" value={data.cards.con_precio.toLocaleString()} onClick={() => toggleKpiType("con-precio")} active={isTypeActive("con-precio")} />
        <StatCard label="Sin Precio" colorClass="cr" value={data.cards.sin_precio.toLocaleString()} onClick={() => toggleKpiType("no-precio")} active={isTypeActive("no-precio")} />
      </div>

      {/* Tabla embebida: muestra los productos que cumplen los filtros y KPIs
          seleccionados. Vive dentro del propio Dashboard, con scroll interno. */}
      <div className="cc">
        <div className="sh" style={{ marginBottom: 10 }}>
          <div className="sh-t">
            <div className="sh-title" style={{ fontSize: 13 }}>Productos filtrados</div>
            <div className="sh-sub">
              {tableData
                ? `${tableData.total.toLocaleString()} coinciden${tableData.total > EMBEDDED_LIMIT ? ` — mostrando primeros ${EMBEDDED_LIMIT}` : ""}`
                : "Cargando…"}
              {anyKpiActive && (
                <> · KPIs: {kpiTypes.map((t) => KPI_LABELS[t] || t).join(" + ")}{kpiTypes.length > 1 && " (AND)"}</>
              )}
            </div>
          </div>
          <div className="ml fb">
            {anyKpiActive && (
              <button className="btn" onClick={() => setKpiTypes([])}>Quitar KPIs</button>
            )}
            <a className="btn" href={exportUrl}>↓ Exportar Excel</a>
          </div>
        </div>

        {tableData && tableData.total === 0 ? (
          <div className="embedded-empty">Ningún producto cumple los filtros seleccionados.</div>
        ) : (
          <div className="embedded-table">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Departamento</th>
                  <th>Familia</th>
                  <th>Categoría</th>
                  <th>Marca</th>
                  <th>Estado SL</th>
                  <th>Etiquetas SL</th>
                  <th>Precio Regular</th>
                  <th>Foto</th>
                  <th>Website</th>
                </tr>
              </thead>
              <tbody>
                {(tableData?.items || []).map((p) => (
                  <tr key={p.id}>
                    <td>{p.sku}</td>
                    <td title={p.nombre}>{p.nombre || "—"}</td>
                    <td>{p.departamento || "—"}</td>
                    <td>{p.familia || "—"}</td>
                    <td>{p.categoria_ecommerce || "—"}</td>
                    <td>{p.marca || "—"}</td>
                    <td>{p.estado_sl || "—"}</td>
                    <td title={p.etiquetas_sl}>{p.etiquetas_sl || "—"}</td>
                    <td>{p.precio_regular ? p.precio_regular.toLocaleString() : "—"}</td>
                    <td><FotoCell value={p.foto_descriptiva_sl} /></td>
                    <td title={p.website}>{p.website || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ch2">
        <div className="cc">
          <div className="cc-t">Estado SL</div>
          {data.estado_pie.length ? (
            data.estado_pie.map((e) => (
              <Bar key={e.label} label={e.label} value={e.count} max={data.total} color="#4a9eff" />
            ))
          ) : (
            <div className="emp">Sin datos</div>
          )}
        </div>
        <div className="cc">
          <div className="cc-t">Top Marcas</div>
          {data.top_marcas.length ? (
            data.top_marcas.map((m) => (
              <Bar key={m.label} label={m.label} value={m.count} max={data.top_marcas[0].count} color="#a78bfa" />
            ))
          ) : (
            <div className="emp">Sin datos</div>
          )}
        </div>
        <div className="cc">
          <div className="cc-t">Top Categorías eComm</div>
          {data.top_categorias.length ? (
            data.top_categorias.map((c) => (
              <Bar key={c.label} label={c.label} value={c.count} max={data.top_categorias[0].count} color="#6366f1" />
            ))
          ) : (
            <div className="emp">Sin datos</div>
          )}
        </div>
        <div className="cc">
          <div className="cc-t">Precio</div>
          <Bar label="Con precio" value={data.precio.con_precio} max={data.total} color="#18c896" onClick={() => toggleKpiType("con-precio")} />
          <Bar label="Sin precio" value={data.precio.sin_precio} max={data.total} color="#e04848" onClick={() => toggleKpiType("no-precio")} />
        </div>

        <div className="cc">
          <div className="cc-t">
            Etiquetas SL
            {data.sin_etiquetas > 0 && (
              <span style={{ float: "right", color: "var(--red)", textTransform: "none", letterSpacing: 0 }}>
                {data.sin_etiquetas.toLocaleString()} sin etiqueta
              </span>
            )}
          </div>
          {data.top_etiquetas && data.top_etiquetas.length ? (
            data.top_etiquetas.map((t) => (
              <Bar
                key={t.label}
                label={t.label}
                value={t.count}
                max={data.top_etiquetas[0].count}
                color="#14b8a6"
                right={`${t.count.toLocaleString()} · ${data.total ? Math.round((t.count / data.total) * 100) : 0}%`}
              />
            ))
          ) : (
            <div className="emp">Sin etiquetas en este reporte</div>
          )}
        </div>

        <div className="cc">
          <div className="cc-t">Departamentos · volumen</div>
          {data.departamentos && data.departamentos.length ? (
            data.departamentos.slice(0, 12).map((d) => (
              <Bar
                key={d.departamento}
                label={d.departamento}
                value={d.total}
                max={data.departamentos[0].total}
                color="#4a9eff"
                right={d.total.toLocaleString()}
              />
            ))
          ) : (
            <div className="emp">Sin datos</div>
          )}
        </div>

        <div className="cc">
          <div className="cc-t">Departamentos · % completo</div>
          {data.departamentos && data.departamentos.length ? (
            [...data.departamentos]
              .sort((a, b) => a.completos_pct - b.completos_pct)
              .slice(0, 12)
              .map((d) => (
                <Bar
                  key={d.departamento}
                  label={d.departamento}
                  value={d.completos_pct}
                  max={100}
                  color={d.completos_pct >= 90 ? "#18c896" : d.completos_pct >= 60 ? "#f0a030" : "#e04848"}
                  right={`${d.completos_pct}% · ${d.total.toLocaleString()}`}
                  title={`${d.departamento}: ${d.completos.toLocaleString()} completos de ${d.total.toLocaleString()}`}
                />
              ))
          ) : (
            <div className="emp">Sin datos</div>
          )}
        </div>
        <div className="cc">
          <div className="cc-t">Departamentos sin Familia</div>
          {data.deptos_sin_familia.length ? (
            data.deptos_sin_familia.map((g) => (
              <Bar key={g.label} label={g.label} value={g.count} max={data.deptos_sin_familia[0].count} color="#f0a030" />
            ))
          ) : (
            <div className="emp" style={{ padding: "1rem" }}>Todo completo ✓</div>
          )}
        </div>
        <div className="cc">
          <div className="cc-t">Departamentos sin Categoría</div>
          {data.deptos_sin_categoria.length ? (
            data.deptos_sin_categoria.map((g) => (
              <Bar key={g.label} label={g.label} value={g.count} max={data.deptos_sin_categoria[0].count} color="#a78bfa" />
            ))
          ) : (
            <div className="emp" style={{ padding: "1rem" }}>Todo completo ✓</div>
          )}
        </div>
      </div>

      </div>
    </div>
  );
}
