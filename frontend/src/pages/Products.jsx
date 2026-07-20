import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useFilters } from "../context/FiltersContext";
import { useReports } from "../context/ReportContext";

const TYPES = [
  { value: "all", label: "Todos" },
  { value: "no-nombre", label: "Sin Nombre" },
  { value: "no-familia", label: "Sin Familia" },
  { value: "no-cat", label: "Sin Categoría" },
  { value: "no-foto", label: "Sin Foto" },
  { value: "con-precio", label: "Con Precio" },
  { value: "no-precio", label: "Sin Precio" },
];

const PAGE = 300;

export default function Products() {
  const { currentReportId } = useReports();
  const { asQuery } = useFilters();
  const [searchParams, setSearchParams] = useSearchParams();
  const type = searchParams.get("type") || "all";
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [data, setData] = useState(null);

  useEffect(() => setLimit(PAGE), [type, search, currentReportId, asQuery]);

  useEffect(() => {
    if (!currentReportId) return;
    api.getProducts(currentReportId, { ...asQuery, kpi_type: type, search, offset: 0, limit }).then(setData);
  }, [currentReportId, asQuery, type, search, limit]);

  if (!currentReportId) {
    return <div className="emp">Carga o selecciona un reporte primero en "Cargar Reporte".</div>;
  }

  return (
    <>
      <div className="sh">
        <div className="sh-t">
          <div className="sh-title">Detalle de KPIs</div>
          <div className="sh-sub">Explora los productos según su estado. Mantiene los filtros del Dashboard activos.</div>
        </div>
        <div className="ml fb">
          <select value={type} onChange={(e) => setSearchParams({ type: e.target.value })}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input placeholder="Buscar SKU o nombre…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <a className="btn" href={api.exportProductsUrl(currentReportId, { ...asQuery, kpi_type: type, search })}>
            ↓ Exportar Excel
          </a>
        </div>
      </div>

      {!data ? (
        <div className="emp">Cargando…</div>
      ) : data.total === 0 ? (
        <div className="emp">No hay productos que coincidan con este filtro.</div>
      ) : (
        <>
          <div className="sh-sub">{data.total.toLocaleString()} productos encontrados</div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Familia</th>
                  <th>Categoría</th>
                  <th>Marca</th>
                  <th>Estado SL</th>
                  <th>Precio Regular</th>
                  <th>Website</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.sku}</td>
                    <td title={p.nombre}>{p.nombre || "—"}</td>
                    <td>{p.familia || "—"}</td>
                    <td>{p.categoria_ecommerce || "—"}</td>
                    <td>{p.marca || "—"}</td>
                    <td>{p.estado_sl || "—"}</td>
                    <td>{p.precio_regular ? p.precio_regular.toLocaleString() : "—"}</td>
                    <td title={p.website}>{p.website || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.total > limit && (
            <div className="fb">
              <span className="sh-sub">Mostrando {limit.toLocaleString()} de {data.total.toLocaleString()}</span>
              <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>
                Cargar {Math.min(PAGE, data.total - limit).toLocaleString()} más
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
