# Product Hub CCN

Dashboard interno de catálogo (KPIs por website, detalle por SKU, comparación
entre reportes). Backend en FastAPI, frontend en React. Sin motor de base de
datos por ahora (ver sección "Datos").

## Version standalone (sin instalar nada)

`standalone/product-hub-standalone.html` es una copia funcional de la app,
en un solo archivo HTML, sin backend, sin Node, sin Python. Corre 100% en el
navegador (usa SheetJS por CDN para leer/escribir xlsx e IndexedDB del
navegador para guardar el historial de reportes — soporta reportes reales de
Sales Layer de decenas de miles de filas, a diferencia de `localStorage` que
se llena rápido). Sirve para probar el flujo completo (cargar, dashboard, por
website, detalle KPIs, comparar reportes) en cualquier PC sin pedir permisos
de instalación.

Para usarla: doble clic en el archivo y se abre en el navegador. Los datos
quedan guardados solo en ese navegador/PC — no es para producción ni para
compartir en la red en tiempo real, es para ver y probar mientras se resuelve
la instalación de Node/Python en la máquina que va a servir la app real.

Incluye, además de los módulos base:
- **Resumen Ejecutivo** (para la directiva): vista limpia de una página con el
  score de calidad, KPIs principales, completitud por atributo y "focos de
  atención". Muestra tendencia (flechas ▲▼) contra el reporte inmediatamente
  anterior, y tiene botón "Imprimir / PDF" con estilos de impresión que dejan
  solo esta hoja (el resto de la app se oculta al imprimir). Tiene un selector
  de website: se puede scopear el resumen a una sola tienda (JUMBO, CASA CUESTA,
  etc.) y las métricas, focos y tendencia se recalculan solo para esa tienda —
  así se imprime un one-pager por website. Nota: como un SKU tiene un solo
  `Estado SL` global aunque esté en varias tiendas, "% visible por website" es
  una aproximación (visibilidad global de los productos listados en esa tienda),
  no visibilidad real por tienda.
- **Métricas por Website** (ranking de calidad): tabla de tiendas ordenada por
  score de calidad de menor a mayor (dónde poner foco), con mini-resumen (score
  promedio ponderado, mejor y peor tienda) y exportable a Excel. El score es la
  misma métrica 0-100 del Resumen Ejecutivo, calculada solo con los productos de
  cada tienda. Los alias de tiendas (para consolidar variantes como
  `MERCA JUMBO` / `MERCAJUMBO`) se configuran en la constante `STORE_ALIASES`
  dentro del HTML.
- **Grupos de Artículo** (operativo, para quienes catalogan): para cada Grupo
  de Artículo mide cuántas Familias (o Categorías eComm) distintas tiene, cuál
  es la dominante y su % de consistencia, y cuántos productos están sin asignar.
  El objetivo es reducir el error al asignar: si un grupo tiene una sola familia
  clara y varios vacíos, esos vacíos son "asignables directo". Al hacer clic en
  un grupo se abre el detalle con la sugerencia ("asignar X — es el N% del
  grupo"), la distribución y la lista de SKUs sin asignar (con botón para
  copiarlos). El export genera dos hojas: "Grupos" (resumen) y "Sugerencias"
  (cada producto sin valor con la familia/categoría sugerida y su % de
  confianza, lista para revisar y cargar).
- **Exportar a Excel** desde Detalle KPIs y desde Comparar Reportes.
- **Backup / Restaurar** (botones en "Cargar Reporte"): descarga todo el
  historial de reportes a un `.json` y lo puede restaurar en otra PC o el
  mismo navegador más tarde — es la forma de pasar snapshots entre colegas o
  respaldarlos, ya que no hay servidor compartido en esta versión.
- Barra de progreso y procesamiento por lotes durante la carga, para no
  congelar la pestaña con reportes grandes (probado con un reporte real de
  ~77,000 productos / 17MB).
- Aviso de SKUs duplicados detectados en el archivo cargado.
- Indicador de uso de almacenamiento del navegador (IndexedDB no es
  ilimitado, aunque es muchísimo más generoso que `localStorage`).

## Correrlo en GitHub Codespaces (sin instalar nada localmente)

Mientras se resuelven los permisos de instalación local, se puede seguir
trabajando en un Codespace: es una máquina en la nube que abre GitHub, con
Node y Python ya instalados automáticamente (ver `.devcontainer/devcontainer.json`).
Solo hace falta un navegador y acceso a github.com.

1. Subir esta carpeta a un repositorio de GitHub (idealmente **privado**):
   ```
   cd product-hub
   git init
   git add .
   git commit -m "Version inicial de Product Hub CCN"
   git branch -M main
   git remote add origin https://github.com/<tu-usuario>/product-hub-ccn.git
   git push -u origin main
   ```
2. En github.com, en el repo: botón **Code** → pestaña **Codespaces** →
   **Create codespace on main**.
3. Se abre un VS Code en el navegador. Al terminar de construirse (unos
   minutos la primera vez), ya corrió automáticamente
   `pip install -r backend/requirements.txt` y `npm install` en el frontend.
4. En la terminal del Codespace:
   ```
   source /workspaces/.venv/bin/activate
   cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   y en otra terminal:
   ```
   cd frontend && npm run dev
   ```
5. Codespaces reenvía los puertos 8000 y 5173 automáticamente y te da un
   link para abrirlos en el navegador (aviso "Open in Browser" o pestaña
   **Ports**).

Nota: aunque no se instale nada en la PC de la empresa, sigue haciendo falta
que la empresa permita el acceso a github.com/Codespaces — conviene
confirmarlo, y no subir el repo como público dado que describe un sistema
interno de CCN.

## Entornos

- Backend (Python): venv dedicado en `C:\Users\Alorenzo\.venvs\product_hub` (fuera de OneDrive).
- Frontend (Node): requiere Node.js LTS instalado (`winget install OpenJS.NodeJS.LTS`).

## Desarrollo (dos procesos)

Terminal 1 — backend:
```
C:\Users\Alorenzo\.venvs\product_hub\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
(ejecutar desde `backend/`)

Terminal 2 — frontend:
```
npm install
npm run dev
```
(ejecutar desde `frontend/`, solo la primera vez hace falta `npm install`)

Abrir `http://localhost:5173`. Vite reenvía las llamadas a `/api` hacia el backend en el puerto 8000.

## Producción / acceso desde la red de la empresa

Un solo proceso sirve todo (API + frontend ya compilado):

```
cd frontend
npm install
npm run build          # genera frontend/dist

cd ../backend
C:\Users\Alorenzo\.venvs\product_hub\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Desde cualquier PC de la red de la empresa, entrar a `http://<IP-de-esta-maquina>:8000`
(la IP se ve con `ipconfig`). La máquina que corre el servidor debe quedar
encendida y con el firewall permitiendo el puerto 8000 en la red local.

## Datos

No se usa ningún motor de base de datos (SQLite, Postgres, etc.) por el momento.
Cada carga de un .xlsx se guarda como un archivo JSON plano e independiente en:

```
C:\Users\<usuario>\.local\product_hub_data\reports\<id>.json
```

(se crea solo al arrancar; se puede cambiar con la variable de entorno
`PRODUCT_HUB_DATA_DIR`). Cada archivo es un "reporte" (snapshot) con sus
productos adentro; nunca se pisa el anterior, y así se puede comparar un
reporte contra el anterior en el módulo "Comparar Reportes". Borrar un reporte
es simplemente borrar su archivo `.json`.

Si más adelante se autoriza el uso de una base de datos, este esquema de
archivos se puede migrar a SQLite/Postgres sin tocar el resto de la app: toda
la lectura/escritura pasa por `backend/app/storage.py`, que es el único punto
que sabe dónde y cómo se guardan los reportes.

## Próximo paso: Sales Layer API

Cuando se conecte la API de Sales Layer, el plan es agregar un módulo de
sincronización (`backend/app/routers/sync.py` o similar) que llame a la API
en un horario definido y cree un "reporte" nuevo con el mismo esquema que hoy
crea la carga manual de xlsx — el resto de la app (dashboard, comparación,
detalle KPIs) no necesita cambios porque ya trabaja sobre esa misma tabla.
