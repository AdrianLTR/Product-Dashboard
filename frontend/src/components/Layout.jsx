import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useReports } from "../context/ReportContext";

const NAV = [
  { to: "/upload", label: "Cargar Reporte" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/executive", label: "Resumen Ejecutivo" },
  { to: "/stores", label: "Por Website" },
  { to: "/compare", label: "Comparar Reportes" },
  { to: "/trends", label: "Tendencia" },
];

export default function Layout() {
  const { currentReport, reports } = useReports();
  const [theme, setTheme] = useState(() => localStorage.getItem("ph-theme") || "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("ph-theme", theme);
  }, [theme]);

  return (
    <>
      <header className="top">
        <div className="logo">
          <span className="logo-sq" />
          Product Hub CCN
        </div>
        <div className="hdr-r">
          {currentReport
            ? `${currentReport.filename} · ${currentReport.row_count.toLocaleString()} productos`
            : reports.length
            ? "Selecciona un reporte"
            : "Sin reportes cargados"}
          <button
            className="btn"
            title="Cambiar tema claro/oscuro"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "☀ Claro" : "🌙 Oscuro"}
          </button>
        </div>
      </header>
      <div className="app-shell">
        <aside>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => "nbtn" + (isActive ? " on" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </aside>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </>
  );
}
