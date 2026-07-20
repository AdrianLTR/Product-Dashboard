import { createContext, useContext, useMemo, useState } from "react";

const FiltersContext = createContext(null);

const EMPTY = { web: [], estado: [] };

export function FiltersProvider({ children }) {
  const [chips, setChips] = useState(EMPTY);
  const [formato, setFormato] = useState("");
  const [sku, setSku] = useState("");
  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [familia, setFamilia] = useState("");
  const [kpiTypes, setKpiTypes] = useState([]); // toggle multi-select desde el Dashboard

  function toggleKpiType(t) {
    setKpiTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function toggleChip(field, value) {
    setChips((prev) => {
      const arr = prev[field];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...prev, [field]: next };
    });
  }

  function setEstadoExclusive(value) {
    setChips((prev) => ({
      ...prev,
      estado: prev.estado.length === 1 && prev.estado[0] === value ? [] : [value],
    }));
  }

  function reset() {
    setChips(EMPTY);
    setFormato("");
    setSku("");
    setNombre("");
    setMarca("");
    setFamilia("");
    setKpiTypes([]);
  }

  const asQuery = useMemo(
    () => ({
      website: chips.web.join(","),
      estado: chips.estado.join(","),
      formato,
      sku,
      nombre,
      marca,
      familia,
    }),
    [chips, formato, sku, nombre, marca, familia]
  );

  return (
    <FiltersContext.Provider
      value={{
        chips, toggleChip, setEstadoExclusive, formato, setFormato, sku, setSku,
        nombre, setNombre, marca, setMarca, familia, setFamilia,
        kpiTypes, toggleKpiType, setKpiTypes, reset, asQuery,
      }}
    >
      {children}
    </FiltersContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters debe usarse dentro de <FiltersProvider>");
  return ctx;
}
