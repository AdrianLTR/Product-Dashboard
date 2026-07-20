import { Navigate, Route, HashRouter, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { FiltersProvider } from "./context/FiltersContext";
import { ReportProvider } from "./context/ReportContext";
import { ToastProvider } from "./context/ToastContext";
import Compare from "./pages/Compare";
import Dashboard from "./pages/Dashboard";
import Executive from "./pages/Executive";
import Stores from "./pages/Stores";
import Trends from "./pages/Trends";
import Upload from "./pages/Upload";
// La ruta /products (Detalle KPIs) fue consolidada dentro del Dashboard.
// Cualquier link viejo a /products se redirige al Dashboard mas abajo.

export default function App() {
  return (
    <ToastProvider>
      <ReportProvider>
        <FiltersProvider>
          <HashRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/upload" replace />} />
                <Route path="/upload" element={<Upload />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/executive" element={<Executive />} />
                <Route path="/stores" element={<Stores />} />
                <Route path="/products" element={<Navigate to="/dashboard" replace />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/trends" element={<Trends />} />
              </Route>
            </Routes>
          </HashRouter>
        </FiltersProvider>
      </ReportProvider>
    </ToastProvider>
  );
}
