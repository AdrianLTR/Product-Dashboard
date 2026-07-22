// Fecha "de negocio" del reporte: la que viene en el nombre del archivo
// (report_date, ej. Products_20260722 → 22/07/2026). Si no se pudo deducir,
// cae a la fecha de subida.
export function reportDate(r) {
  if (r?.report_date) {
    const [y, m, d] = r.report_date.split("-");
    return `${d}/${m}/${y}`;
  }
  return r?.uploaded_at ? new Date(r.uploaded_at).toLocaleDateString("es-DO") : "";
}

// Clave de orden cronologico (mas nuevo = mayor). Prefiere report_date.
export function reportSortValue(r) {
  return r?.report_date || r?.uploaded_at || "";
}
