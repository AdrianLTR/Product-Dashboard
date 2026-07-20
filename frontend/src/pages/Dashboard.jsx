import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import Bar from "../components/Bar";
import StatCard from "../components/StatCard";
import { useFilters } from "../context/FiltersContext";
import { useReports } from "../context/ReportContext";

function scoreColor(score) {
  if (score >= 90) return "var(--teal)";
  if (score >= 70) return "var(--amb)";
  return "var(--red)";
}

export default function Dashboard() {
  const { currentReportId } = useReports();
  const {
    chips, toggleChip, setEstadoExclusive, formato, setFormato, sku, setSku,
    nombre, setNombre, marca, setMarca, familia, setFamilia, reset, asQuery,
  } = useFilters();
  const [data, setData] = useState(null);
  const navigate = useNavigate();

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
    api.getDashboard(currentReportId, asQuery).then(setData);
  }, [currentReportId, asQuery]);

  if (!currentReportId) {
    return <div className="emp">Carga o selecciona un reporte primero en "Cargar Reporte".</div>;
  }
  if (!data) return <div className="emp">Cargando…</div>;

  const goToKpi = (type) => navigate(`/products?type=${type}`);

  return (
    <>
      <div className="sh">
        <div className="sh-t">
          <div className="sh-title">Dashboard</div>
          <div className="sh-sub">{data.total.toLocaleString()} productos con los filtros activos</div>
        </div>
        <div className="ml kpi-score">
          <div className="kpi-score-lbl">KPI</div>
          <div className="kpi-score-val" style={{ color: scoreColor(data.kpi_score) }}>
            {data.kpi_score.toFixed(2)}
          </div>
          <div className="kpi-score-sub">de 100 pts</div>
        </div>
      </div>

      <form
        className="filter-bar"
        onSubmit={(e) => { e.preventDefault(); applyDraft(); }}
      >
        <input type="text" placeholder="Buscar SKU…" value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} />
        <input type="text" placeholder="Buscar nombre…" value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />
        <input type="text" placeholder="Buscar marca…" value={draft.marca} onChange={(e) => setDraft({ ...draft, marca: e.target.value })} />
        <input type="text" placeholder="Buscar familia…" value={draft.familia} onChange={(e) => setDraft({ ...draft, familia: e.target.value })} />
        <input type="text" placeholder="Buscar formato…" value={draft.formato} onChange={(e) => setDraft({ ...draft, formato: e.target.value })} />
        <button type="submit" className={"btn " + (hasPendingChanges ? "pri" : "")}>
          {hasPendingChanges ? "Aplicar" : "Buscar"}
        </button>
        <button type="button" className="btn" onClick={reset}>Limpiar</button>
        <span style={{ fontSize: 10, color: "var(--tx3)", fontFamily: "var(--mono)", marginLeft: "auto" }}>
          Enter para aplicar
        </span>
      </form>

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
        {data.kpi_attrs.map((a) => (
          <div className="sc" key={a.key}>
            <div className="sc-l">{a.label} · 25 pts</div>
            <div className="sc-v" style={{ color: a.color }}>{a.count.toLocaleString()}</div>
            <div className="sc-s">{a.pct}% de {a.total.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="cgrid">
        <StatCard label="Total SKU" value={data.cards.total.toLocaleString()} onClick={() => goToKpi("all")} />
        <StatCard label="Completos" colorClass="ct" value={data.cards.completos.toLocaleString()} />
        <StatCard label="Sin Familia" colorClass="ca" value={data.cards.sin_familia.toLocaleString()} onClick={() => goToKpi("no-familia")} />
        <StatCard label="Sin Cat." colorClass="ca" value={data.cards.sin_categoria.toLocaleString()} onClick={() => goToKpi("no-cat")} />
        <StatCard label="Sin Nombre" colorClass="cr" value={data.cards.sin_nombre.toLocaleString()} onClick={() => goToKpi("no-nombre")} />
        <StatCard label="Sin Foto" colorClass="ca" value={data.cards.sin_foto.toLocaleString()} onClick={() => goToKpi("no-foto")} />
        <StatCard label="Con Precio" colorClass="ct" value={data.cards.con_precio.toLocaleString()} onClick={() => goToKpi("con-precio")} />
        <StatCard label="Sin Precio" colorClass="cr" value={data.cards.sin_precio.toLocaleString()} onClick={() => goToKpi("no-precio")} />
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
          <Bar label="Con precio" value={data.precio.con_precio} max={data.total} color="#18c896" onClick={() => goToKpi("con-precio")} />
          <Bar label="Sin precio" value={data.precio.sin_precio} max={data.total} color="#e04848" onClick={() => goToKpi("no-precio")} />
        </div>
        <div className="cc">
          <div className="cc-t">Grupos sin Familia</div>
          {data.grupos_sin_familia.length ? (
            data.grupos_sin_familia.map((g) => (
              <Bar key={g.label} label={g.label} value={g.count} max={data.grupos_sin_familia[0].count} color="#f0a030" />
            ))
          ) : (
            <div className="emp" style={{ padding: "1rem" }}>Todo completo ✓</div>
          )}
        </div>
        <div className="cc">
          <div className="cc-t">Grupos sin Categoría</div>
          {data.grupos_sin_categoria.length ? (
            data.grupos_sin_categoria.map((g) => (
              <Bar key={g.label} label={g.label} value={g.count} max={data.grupos_sin_categoria[0].count} color="#a78bfa" />
            ))
          ) : (
            <div className="emp" style={{ padding: "1rem" }}>Todo completo ✓</div>
          )}
        </div>
      </div>
    </>
  );
}
