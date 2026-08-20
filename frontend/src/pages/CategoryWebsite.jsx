import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import StatCard from "../components/StatCard";
import { useReports } from "../context/ReportContext";

export default function CategoryWebsite() {
  const { currentReportId, currentReport } = useReports();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [websiteFilter, setWebsiteFilter] = useState("");
  // Estado SL: Visible es el foco principal — los que Magento ya publica.
  // Draft/Invisible tambien pueden estar mal, pero no tienen impacto inmediato.
  const [estadoFilter, setEstadoFilter] = useState("");

  useEffect(() => {
    if (!currentReportId) return;
    setError(null); setData(null);
    api.getCategoryWebsite(currentReportId, { estado: estadoFilter || undefined })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [currentReportId, estadoFilter]);

  const filteredIssues = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const w = websiteFilter.trim();
    return data.issues.filter((it) => {
      if (w && it.website !== w) return false;
      if (q && !(it.sku || "").toLowerCase().includes(q) && !(it.nombre || "").toLowerCase().includes(q) && !(it.categoria || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, websiteFilter]);

  if (!currentReportId) return <div className="emp">Carga o selecciona un reporte primero en "Cargar Reporte".</div>;
  if (error) return <div className="emp">{error}</div>;
  if (!data) return <div className="emp">Cargando…</div>;

  const s = data.summary;
  const pctOf = (v, base) => (base ? Math.round((v / base) * 100) : 0);

  return (
    <>
      <div className="sh">
        <div className="sh-t">
          <div className="sh-title">Categorías × Website</div>
          <div className="sh-sub">
            {currentReport?.filename} · si un producto tiene el website pero le falta la categoría con ese
            prefijo, Magento lo apaga. Aquí solo se marca ese caso (tener la categoría sin el website es válido).
            {estadoFilter && (
              <> · <span style={{ color: "var(--teal)" }}>filtrando por {estadoFilter}</span></>
            )}
          </div>
        </div>
      </div>

      {/* Filtro por Estado SL — los Visibles son el foco principal */}
      <div className="fb">
        <span className="sh-sub">Estado SL:</span>
        {[
          { value: "", label: "Todos" },
          { value: "Visible", label: "Visible (prioridad)" },
          { value: "Draft", label: "Draft" },
          { value: "Invisible", label: "Invisible" },
        ].map((opt) => (
          <span
            key={opt.value}
            className={"chip" + (estadoFilter === opt.value ? " on" : "")}
            onClick={() => setEstadoFilter(opt.value)}
          >
            {opt.label}
          </span>
        ))}
      </div>

      {/* Mapeo aplicado */}
      <div className="fb">
        {data.mapping.map((m) => (
          <span key={m.website} className="chip">{m.website} → requiere {m.prefix}</span>
        ))}
      </div>

      {/* Resumen global */}
      <div className="cgrid">
        <StatCard label="Total SKU" value={s.total.toLocaleString()} />
        <StatCard label="En websites gestionados" value={s.in_managed.toLocaleString()} sub={`${pctOf(s.in_managed, s.total)}%`} />
        <StatCard label="OK" colorClass="ct" value={s.ok.toLocaleString()} sub={`${pctOf(s.ok, s.in_managed)}% de gestionados`} />
        <StatCard label="Falta categoría" colorClass="cr" value={s.missing_category.toLocaleString()} sub={`${pctOf(s.missing_category, s.in_managed)}% — se apagan`} />
        <StatCard label="Sin website gestionado" colorClass="cw" value={s.no_managed_website.toLocaleString()} sub="no se valida" />
      </div>

      {/* Por website */}
      <div className="cc">
        <div className="cc-t">Por website — cuántos productos tienen el website pero les falta la categoría</div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Website</th>
                <th>Requiere prefijo</th>
                <th>Productos en el website</th>
                <th>Con categoría OK</th>
                <th>Falta categoría</th>
                <th>% que se apaga</th>
              </tr>
            </thead>
            <tbody>
              {data.per_website.map((w) => (
                <tr key={w.website} style={{ cursor: "pointer" }} onClick={() => setWebsiteFilter(websiteFilter === w.website ? "" : w.website)}>
                  <td>{w.website}</td>
                  <td><span className="chip">{w.prefix}</span></td>
                  <td>{w.in_website.toLocaleString()}</td>
                  <td className="diff-add">{w.with_category.toLocaleString()}</td>
                  <td>{w.missing_category > 0 ? <span className="diff-rem">{w.missing_category.toLocaleString()}</span> : "0"}</td>
                  <td>
                    <span className={"bdg " + (w.missing_pct === 0 ? "ok" : w.missing_pct <= 5 ? "ne" : "ms")}>
                      {w.missing_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalle: productos con website pero sin la categoría */}
      <div className="cc">
        <div className="sh" style={{ marginBottom: 12 }}>
          <div className="sh-t">
            <div className="sh-title" style={{ fontSize: 13 }}>Productos a corregir</div>
            <div className="sh-sub">
              Tienen el website pero les falta la categoría con el prefijo requerido — agrégales esa categoría para que no se apaguen
            </div>
          </div>
          <div className="ml fb">
            <input type="text" placeholder="Buscar SKU/nombre/categoría…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={websiteFilter} onChange={(e) => setWebsiteFilter(e.target.value)}>
              <option value="">Todos los websites</option>
              {data.per_website.map((w) => (
                <option key={w.website} value={w.website}>{w.website} ({w.missing_category.toLocaleString()})</option>
              ))}
            </select>
          </div>
        </div>

        {filteredIssues.length === 0 ? (
          <div className="embedded-empty">Sin productos a corregir con los filtros actuales ✓</div>
        ) : (
          <div className="embedded-table">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Estado SL</th>
                  <th>Website</th>
                  <th>Categoría que falta</th>
                  <th>Categoría actual</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssues.map((it) => (
                  <tr key={it.sku + it.website}>
                    <td>{it.sku || "—"}</td>
                    <td title={it.nombre}>{it.nombre || "—"}</td>
                    <td>
                      {it.estado_sl === "Visible"
                        ? <span className="bdg ms">{it.estado_sl}</span>
                        : (it.estado_sl || "—")}
                    </td>
                    <td>{it.website}</td>
                    <td><span className="bdg ms">falta {it.expected_prefix}</span></td>
                    <td title={it.categoria}>{it.categoria || <span className="diff-rem">(sin categoría)</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.issues_truncated && (
          <div className="sh-sub" style={{ marginTop: 8 }}>
            Mostrando muestra de {data.sample_limit.toLocaleString()} — hay {data.total_issue_rows.toLocaleString()} casos en total. Filtra por website para acotar.
          </div>
        )}
      </div>
    </>
  );
}
