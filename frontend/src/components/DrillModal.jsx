import { useEffect, useState } from "react";
import { api } from "../api";
import FotoCell from "./FotoCell";

const PAGE = 500;

// Modal que lista los productos que cumplen `params` (website + kpi_types/estado)
// para un reporte dado. Se usa desde el Resumen Ejecutivo al hacer clic en un
// indicador ("ver los Sin Familia de JUMBO").
export default function DrillModal({ reportId, title, subtitle, params, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!reportId) return;
    setError(null);
    setData(null);
    api
      .getProducts(reportId, { ...params, offset: 0, limit: PAGE })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [reportId, JSON.stringify(params)]);

  // Cerrar con Escape
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const exportUrl = api.exportProductsUrl(reportId, params);

  return (
    <div className="modal-ov on" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="sh">
          <div className="sh-t">
            <div className="sh-title" style={{ fontSize: 15 }}>{title}</div>
            <div className="sh-sub">
              {subtitle}
              {data ? ` · ${data.total.toLocaleString()} productos${data.total > PAGE ? ` (mostrando ${PAGE})` : ""}` : ""}
            </div>
          </div>
          <div className="ml fb">
            {data && data.total > 0 && (
              <a className="btn" href={exportUrl}>↓ Exportar Excel</a>
            )}
            <button className="modal-x" onClick={onClose}>×</button>
          </div>
        </div>

        {error && <div className="emp">{error}</div>}
        {!data && !error && <div className="emp">Cargando…</div>}
        {data && data.total === 0 && <div className="embedded-empty">Sin productos.</div>}
        {data && data.total > 0 && (
          <div className="embedded-table" style={{ maxHeight: "60vh" }}>
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Departamento</th>
                  <th>Descripcion SAP</th>
                  <th>Categoría</th>
                  <th>Marca</th>
                  <th>Estado SL</th>
                  <th>Etiquetas SL</th>
                  <th>Precio</th>
                  <th>Foto</th>
                  <th>Website</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.sku}</td>
                    <td title={p.nombre}>{p.nombre || "—"}</td>
                    <td>{p.departamento || "—"}</td>
                    <td title={p.descripcion_sap}>{p.descripcion_sap || "—"}</td>
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
    </div>
  );
}
