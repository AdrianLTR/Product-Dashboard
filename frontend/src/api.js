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
  uploadReport: async (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("/reports/upload", { method: "POST", body: form });
  },
  getDashboard: (reportId, filters) => request(`/reports/${reportId}/dashboard${qs(filters)}`),
  getStores: (reportId) => request(`/reports/${reportId}/stores`),
  getProducts: (reportId, params) => request(`/reports/${reportId}/products${qs(params)}`),
  compareReports: (baseId, targetId) => request(`/compare${qs({ base_id: baseId, target_id: targetId })}`),
};
