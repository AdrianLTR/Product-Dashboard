import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Durante desarrollo, el frontend corre en :5173 y reenvia /api al backend
// (uvicorn) en :8000. En produccion, FastAPI sirve el build de este proyecto
// directamente y no hace falta proxy.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // permite acceso desde otras maquinas de la red durante dev
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
});
