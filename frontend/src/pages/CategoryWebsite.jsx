import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import StatCard from "../components/StatCard";
import { useReports } from "../context/ReportContext";

const TABS = [
  { key: "wrong_website", label: "Categoria ≠ website", desc: "Producto está en un website que no corresponde a su prefijo. Magento apaga el producto." },
  { key: "no_website", label: "Falta website", desc: "La categoría tiene un prefijo válido pero al producto no le pusieron el website." },
  { key: "unknown_prefix", label: "Prefijo desconocido", desc: "La categoría no arranca con un prefijo del mapeo. Puede que sea un prefijo nuevo." },
  { key: "no_categoria", label: "Sin categoría", desc: "El producto no tiene 'Categoria eCommerce'." },
];

export default function CategoryWebsite() {
  const { currentReportId, currentReport } = useReports();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("wrong_website");
  const [search, setSearch] = useState("");
  const [websiteFilter, setWebsiteFilter] = useState("");

  useEffect(() => {
    if (!currentReportId) return;
    setError(null); setData(null);
    api.getCategoryWebsite(currentReportId).then(setData).catch((err) => setError(err.message));
  }, [currentReportId]);

  const filteredIssues = useMemo(() => {
    if (!data) return [];
    const items = data.issues[tab] || [];
    const q = search.trim().toLowerCase();
    const w = websiteFilter.trim().toUpperCase();
    return items.filter((it) => {
      if (q && !(it.sku || "").toLowerCase().includes(q) && !(it.nombre || "").toLowerCase().includes(q) && !(it.categoria || "").toLowerCase().includes(q)) return false;
      if (w) {
        const inSites = (it.websites || []).some((s) => s.toUpperCase().includes(w));
        const isExpected = (it.expected_website || "").toUpperCase().includes(w);
        if (!inSites && !isExpected) return false;
      }
      return true;
    });
  }, [data, tab, search, websiteFilter]);

  if (!currentReportId) return <div className="emp">Carga o selecciona un reporte primero en "Cargar Reporte".</div>;
  if (error) return <div className="emp">{error}</div>;
  if (!data) return <div className="emp">Cargando…</div>;

  const s = data.summary;
  const total = s.total || 1;
  const pct = (v) => Math.round((v / total) * 100);

  return (
    <>
      <div className="sh">
        <div className="sh-t">
          <div className="sh-title">Categorías × Website</div>
          <div className="sh-sub">
            {currentReport?.filename} · valida que cada producto esté en el website que indica su prefijo de categoría
            {" · si falta uno de los dos, Magento apaga el producto"}
          </div>
        </div>
      </div>

      {/* Mapeo aplicado */}
      <div className="fb">
        {data.mapping.map((m) => (
          <span key={m.prefix} className="chip">{m.prefix} → {m.website}</span>
        ))}
      </div>

      {/* Resumen global */}
      <div className="cgrid">
        <StatCard label="Total SKU" value={s.total.toLocaleString()} />
        <StatCard label="OK" colorClass="ct" value={s.ok.toLocaleString()} sub={`${pct(s.ok)}%`} />
        <StatCard label="Categoría ≠ website" colorClass="cr" value={s.wrong_website.toLocaleString()} sub={`${pct(s.wrong_website)}%`} onClick={() => setTab("wrong_website")} active={tab === "wrong_website"} />
        <StatCard label="Falta website" colorClass="ca" value={s.no_website.toLocaleString()} sub={`${pct(s.no_website)}%`} onClick={() => setTab("no_website")} active={tab === "no_website"} />
        <StatCard label="Prefijo desconocido" colorClass="cb" value={s.unknown_prefix.toLocaleString()} sub={`${pct(s.unknown_prefix)}%`} onClick={() => setTab("unknown_prefix")} active={tab === "unknown_prefix"} />
        <StatCard label="Sin categoría" colorClass="cw" value={s.no_categoria.toLocaleString()} sub={`${pct(s.no_categoria)}%`} onClick={() => setTab("no_categoria")} active={tab === "no_categoria"} />
      </div>

      {/* Por website */}
      <div className="cc">
        <div className="cc-t">Alineación por website</div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Website</th>
                <th>Prefijo</th>
                <th>Total en website</th>
                <th>Prefijo correcto</th>
                <th>% alineado</th>
                <th>Otro prefijo</th>
                <th>Sin prefijo</th>
                <th>Debería estar aquí</th>
              </tr>
            </thead>
            <tbody>
              {data.per_website.map((w) => (
                <tr key={w.website}>
                  <td>{w.website}</td>
                  <td><span className="chip">{w.prefix}</span></td>
                  <td>{w.total_in_website.toLocaleString()}</td>
                  <td>{w.matching_prefix.toLocaleString()}</td>
                  <td>
                    <span className={"bdg " + (w.matching_pct >= 95 ? "ok" : w.matching_pct >= 80 ? "ne" : "ms")}>
                      {w.matching_pct}%
                    </span>
                  </td>
                  <td>{w.other_prefix > 0 ? <span className="diff-rem">{w.other_prefix.toLocaleString()}</span> : "0"}</td>
                  <td>{w.no_prefix.toLocaleString()}</td>
                  <td>{w.should_be_here > 0 ? <span className="diff-add">+{w.should_be_here.toLocaleString()}</span> : "0"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalle de issues */}
      <div className="cc">
        <div className="sh" style={{ marginBottom: 12 }}>
          <div className="sh-t">
            <div className="sh-title" style={{ fontSize: 13 }}>Detalle de issues</div>
            <div className="sh-sub">{TABS.find((t) => t.key === tab)?.desc}</div>
          </div>
          <div className="ml fb">
            <input type="text" placeholder="Buscar SKU/nombre/categoría…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <input type="text" placeholder="Filtrar website…" value={websiteFilter} onChange={(e) => setWebsiteFilter(e.target.value)} />
          </div>
        </div>

        <div className="fb" style={{ marginBottom: 10 }}>
          {TABS.map((t) => (
            <span key={t.key} className={"chip" + (tab === t.key ? " on" : "")} onClick={() => setTab(t.key)}>
              {t.label} · {(data.summary[t.key] ?? 0).toLocaleString()}
            </span>
          ))}
        </div>

        {filteredIssues.length === 0 ? (
          <div className="embedded-empty">Sin issues en esta categoría con los filtros actuales ✓</div>
        ) : (
          <div className="embedded-table">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Prefijo</th>
                  <th>Website esperado</th>
                  <th>Websites actuales</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssues.map((it) => (
                  <tr key={it.sku + it.categoria}>
                    <td>{it.sku || "—"}</td>
                    <td title={it.nombre}>{it.nombre || "—"}</td>
                    <td title={it.categoria}>{it.categoria || "—"}</td>
                    <td>{it.prefix ? <span className="chip">{it.prefix}</span> : "—"}</td>
                    <td className="diff-add">{it.expected_website || "—"}</td>
                    <td className="diff-rem">{(it.websites || []).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.sample_limit && (data.summary[tab] || 0) > data.sample_limit && (
          <div className="sh-sub" style={{ marginTop: 8 }}>
            Mostrando muestra de {data.sample_limit} — hay {data.summary[tab].toLocaleString()} en total. Ajusta filtros para reducir, o exporta el reporte.
          </div>
        )}
      </div>
    </>
  );
}
