import { Navigate, Route, HashRouter, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { FiltersProvider } from "./context/FiltersContext";
import { ReportProvider } from "./context/ReportContext";
import { ToastProvider } from "./context/ToastContext";
import Compare from "./pages/Compare";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Stores from "./pages/Stores";
import Upload from "./pages/Upload";

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
                <Route path="/stores" element={<Stores />} />
                <Route path="/products" element={<Products />} />
                <Route path="/compare" element={<Compare />} />
              </Route>
            </Routes>
          </HashRouter>
        </FiltersProvider>
      </ReportProvider>
    </ToastProvider>
  );
}
