import { useEffect, useState } from "react";
import { api } from "../api";
import FotoCell from "./FotoCell";
import { reportDate } from "../dates";

// Columnas exportadas al CSV (mismo orden que la tabla del modal)
const CSV_COLS = [
  ["sku", "SKU"],
  ["nombre", "Nombre"],
  ["departamento", "Departamento"],
  ["descripcion_sap", "Descripcion SAP"],
  ["estado_sl", "Estado SL"],
  ["etiquetas_sl", "Etiquetas SL"],
  ["foto_descriptiva_sl", "Foto descriptiva SL"],
  ["website", "Website"],
  ["es_sku_nuevo", "SKU Nuevo"],
  ["es_foto_nueva", "Foto Nueva"],
];

function csvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows, tab, label, website) {
  const header = CSV_COLS.map(([, h]) => h).join(",");
  const lines = rows.map((r) => CSV_COLS.map(([k]) => csvCell(r[k])).join(","));
  // BOM para que Excel abra utf-8 con tildes bien
  const csv = "﻿" + [header, ...lines].join("\r\n");
  const slug = (label + "_" + tab + (website ? "_" + website : "")).replace(/[^\w-]+/g, "_");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `Delta_${slug}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Modal que explica un delta del Resumen Ejecutivo: que SKUs ENTRARON al
// indicador y cuales SALIERON entre los dos reportes comparados.
export default function DeltaModal({ reportId, indicator, label, website, compareId, skus, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("entraron");

  useEffect(() => {
    if (!reportId) return;
    setError(null);
    setData(null);
    api
      .getExecutiveDelta(reportId, { indicator, website, compare_id: compareId, skus })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [reportId, indicator, website, compareId, skus]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = data ? (tab === "entraron" ? data.entraron : data.salieron) : [];

  return (
    <div className="modal-ov on" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 1100 }} onClick={(e) => e.stopPropagation()}>
        <div className="sh">
          <div className="sh-t">
            <div className="sh-title" style={{ fontSize: 15 }}>
              Cambios en {label}{website ? ` · ${website}` : " · Todos los websites"}
            </div>
            <div className="sh-sub">
              {data ? (
                <>
                  {data.previous
                    ? `${reportDate(data.previous)} → ${reportDate(data.current)}`
                    : "Sin reporte anterior"}
                  {" · "}
                  {data.count_before.toLocaleString()} → {data.count_after.toLocaleString()}
                  {" ("}
                  <span className={data.delta >= 0 ? "diff-add" : "diff-rem"}>
                    {data.delta >= 0 ? "+" : ""}{data.delta.toLocaleString()}
                  </span>
                  {")"}
                </>
              ) : (
                "Cargando…"
              )}
            </div>
          </div>
          <div className="ml fb">
            {data && rows.length > 0 && (
              <button className="btn" onClick={() => downloadCsv(rows, tab, label, website)}>
                ↓ Exportar CSV
              </button>
            )}
            <button className="modal-x" onClick={onClose}>×</button>
          </div>
        </div>

        {error && <div className="emp">{error}</div>}
        {!data && !error && <div className="emp">Cargando…</div>}

        {data && (
          <>
            <div className="fb">
              <span
                className={"chip" + (tab === "entraron" ? " on" : "")}
                onClick={() => setTab("entraron")}
              >
                ▲ Entraron · {data.entraron_count.toLocaleString()}
              </span>
              <span
                className={"chip" + (tab === "salieron" ? " on" : "")}
                onClick={() => setTab("salieron")}
              >
                ▼ Salieron · {data.salieron_count.toLocaleString()}
              </span>
              <span className="sh-sub" style={{ marginLeft: "auto" }}>
                {tab === "entraron"
                  ? `Productos que ahora cuentan en "${label}" y antes no`
                  : `Productos que antes contaban en "${label}" y ya no`}
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="embedded-empty">
                {tab === "entraron" ? "Ninguno entró." : "Ninguno salió."}
              </div>
            ) : (
              <div className="embedded-table" style={{ maxHeight: "58vh" }}>
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Nombre</th>
                      <th>Departamento</th>
                      <th>Descripcion SAP</th>
                      <th>Estado SL</th>
                      <th>Etiquetas SL</th>
                      <th>Foto</th>
                      <th>Website</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <tr key={p.sku}>
                        <td>
                          {p.sku}
                          {tab === "entraron" && p.es_sku_nuevo && (
                            <span className="bdg ok" style={{ marginLeft: 6 }}>nuevo</span>
                          )}
                          {tab === "entraron" && p.es_foto_nueva && (
                            <span className="bdg" style={{ marginLeft: 6, background: "var(--teal)", color: "#fff" }}>foto nueva</span>
                          )}
                        </td>
                        <td title={p.nombre}>{p.nombre || "—"}</td>
                        <td>{p.departamento || "—"}</td>
                        <td title={p.descripcion_sap}>{p.descripcion_sap || "—"}</td>
                        <td>{p.estado_sl || "—"}</td>
                        <td title={p.etiquetas_sl}>{p.etiquetas_sl || "—"}</td>
                        <td><FotoCell value={p.foto_descriptiva_sl} /></td>
                        <td title={p.website}>{p.website || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
