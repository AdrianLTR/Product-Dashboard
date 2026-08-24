import { useEffect, useMemo, useState } from "react";
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
  ["motivo", "Motivo"],
  ["es_sku_nuevo", "SKU Nuevo"],
  ["es_foto_nueva", "Foto Nueva"],
];

// Etiqueta y clase visible para el motivo del cambio. Aclaramos que un SKU
// puede "salir" de un indicador por 3 razones distintas para que no se
// confundan con un cambio de dato real.
const MOTIVO_LABELS = {
  salio_catalogo: { label: "Salio del catalogo", cls: "cr" },
  perdio_website: { label: "Perdio el website", cls: "ne" },
  cambio_atributo: { label: "Cambio de dato", cls: "ms" },
  nuevo_catalogo: { label: "SKU nuevo", cls: "ok" },
  gano_website: { label: "Gano el website", cls: "ne" },
};

// Motivos posibles en cada tab, en el orden en el que se muestran los chips
const MOTIVOS_POR_TAB = {
  entraron: ["cambio_atributo", "gano_website", "nuevo_catalogo"],
  salieron: ["cambio_atributo", "perdio_website", "salio_catalogo"],
};

function csvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows, tab, label, website) {
  const header = CSV_COLS.map(([, h]) => h).join(",");
  const lines = rows.map((r) => CSV_COLS.map(([k]) => csvCell(r[k])).join(","));
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

// Cuenta cuantas filas hay por cada motivo (sin filtrar por chip activo,
// para que el chip muestre el total real y no la seleccion actual).
function countByMotivo(rows) {
  const c = {};
  for (const r of rows) {
    const m = r.motivo || "sin_motivo";
    c[m] = (c[m] || 0) + 1;
  }
  return c;
}

// Modal que explica un delta del Resumen Ejecutivo: que SKUs ENTRARON al
// indicador y cuales SALIERON entre los dos reportes comparados.
export default function DeltaModal({ reportId, indicator, label, website, compareId, skus, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("entraron");
  // Motivo activo para filtrar la tabla. "" = todos.
  const [motivoFilter, setMotivoFilter] = useState("");

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

  // Cambiar de tab resetea el chip de motivo (no tiene sentido conservarlo).
  useEffect(() => { setMotivoFilter(""); }, [tab]);

  const allRows = data ? (tab === "entraron" ? data.entraron : data.salieron) : [];
  const motivosCount = useMemo(() => countByMotivo(allRows), [allRows]);
  const rows = useMemo(
    () => (motivoFilter ? allRows.filter((r) => r.motivo === motivoFilter) : allRows),
    [allRows, motivoFilter]
  );

  const motivosDisponibles = MOTIVOS_POR_TAB[tab] || [];

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

            {/* Resumen de motivos: cuantos son cambios reales vs bookkeeping */}
            {allRows.length > 0 && motivosDisponibles.some((m) => motivosCount[m]) && (
              <div className="fb" style={{ marginTop: 8, alignItems: "center" }}>
                <span className="sh-sub">Desglose:</span>
                <span
                  className={"chip" + (motivoFilter === "" ? " on" : "")}
                  onClick={() => setMotivoFilter("")}
                >
                  Todos · {allRows.length.toLocaleString()}
                </span>
                {motivosDisponibles.map((m) => {
                  const n = motivosCount[m] || 0;
                  if (!n) return null;
                  const info = MOTIVO_LABELS[m];
                  return (
                    <span
                      key={m}
                      className={"chip" + (motivoFilter === m ? " on" : "")}
                      onClick={() => setMotivoFilter(motivoFilter === m ? "" : m)}
                      title={`Filtrar solo los que ${info.label.toLowerCase()}`}
                    >
                      {info.label} · {n.toLocaleString()}
                    </span>
                  );
                })}
              </div>
            )}

            {rows.length === 0 ? (
              <div className="embedded-empty">
                {motivoFilter
                  ? `Ninguno con motivo "${MOTIVO_LABELS[motivoFilter]?.label}".`
                  : tab === "entraron" ? "Ninguno entró." : "Ninguno salió."}
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
                      <th>Motivo</th>
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
                        <td>
                          {p.motivo && MOTIVO_LABELS[p.motivo] ? (
                            <span className={"bdg " + MOTIVO_LABELS[p.motivo].cls}>
                              {MOTIVO_LABELS[p.motivo].label}
                            </span>
                          ) : "—"}
                        </td>
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
