import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api";

const ReportContext = createContext(null);

export function ReportProvider({ children }) {
  const [reports, setReports] = useState([]);
  const [currentReportId, setCurrentReportId] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listReports();
      setReports(data);
      setCurrentReportId((prev) => {
        if (prev && data.some((r) => r.id === prev)) return prev;
        return data[0]?.id ?? null;
      });
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshReports();
  }, [refreshReports]);

  const currentReport = reports.find((r) => r.id === currentReportId) || null;

  return (
    <ReportContext.Provider
      value={{ reports, currentReportId, setCurrentReportId, currentReport, refreshReports, loading }}
    >
      {children}
    </ReportContext.Provider>
  );
}

export function useReports() {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error("useReports debe usarse dentro de <ReportProvider>");
  return ctx;
}
