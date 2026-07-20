const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // respuesta sin JSON, se usa el statusText
    }
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

function qs(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "";
  return "?" + new URLSearchParams(entries).toString();
}

export const api = {
  listReports: () => request("/reports"),
  getReport: (id) => request(`/reports/${id}`),
  deleteReport: (id) => request(`/reports/${id}`, { method: "DELETE" }),
  uploadReport: async (file, onProgress) => {
    // Sube el archivo en pedazos de ~500 KB para esquivar el limite de tamano
    // de POST del proxy intermedio (Codespaces y balancers similares). El backend
    // reensambla y responde con el ReportOut en el ultimo pedazo.
    const CHUNK_SIZE = 500 * 1024;
    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
    const uploadId = (crypto.randomUUID && crypto.randomUUID()) ||
      // Fallback por si el navegador no expone randomUUID.
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

    let last = null;
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);

      const form = new FormData();
      form.append("upload_id", uploadId);
      form.append("chunk_index", String(i));
      form.append("total_chunks", String(totalChunks));
      form.append("filename", file.name);
      form.append("chunk", blob, "chunk");

      last = await request("/reports/upload/chunk", { method: "POST", body: form });
      onProgress?.(i + 1, totalChunks);
    }
    // Ultimo `last` es el ReportOut (los intermedios son {received, total}).
    return last;
  },
  getDashboard: (reportId, filters) => request(`/reports/${reportId}/dashboard${qs(filters)}`),
  getStores: (reportId) => request(`/reports/${reportId}/stores`),
  getProducts: (reportId, params) => request(`/reports/${reportId}/products${qs(params)}`),
  compareReports: (baseId, targetId) => request(`/compare${qs({ base_id: baseId, target_id: targetId })}`),
  getTrends: () => request("/trends"),
  // URLs de descarga directa (el navegador baja el xlsx; no pasan por fetch)
  exportProductsUrl: (reportId, params) => `${BASE}/export/products/${reportId}${qs(params)}`,
  exportStoresUrl: (reportId) => `${BASE}/export/stores/${reportId}`,
  exportCompareUrl: (baseId, targetId) => `${BASE}/export/compare${qs({ base_id: baseId, target_id: targetId })}`,
};
