# Product Hub CCN — instrucciones para montar en el servidor

Dashboard interno de catálogo (KPIs por website, detalle por SKU, comparación
entre reportes, resumen ejecutivo). Backend en FastAPI (Python), frontend en
React. Sin motor de base de datos: cada reporte cargado se guarda como un
archivo JSON plano en disco.

## Requisitos previos

- Windows con **Python 3.12+** instalado
- **Node.js LTS** instalado (para compilar el frontend)

## 1. Extraer el archivo

Descomprime este zip donde quieras que viva el proyecto en el servidor,
por ejemplo `C:\apps\product-hub`.

## 2. Backend — crear entorno virtual e instalar dependencias

```powershell
cd C:\apps\product-hub
python -m venv C:\venvs\product_hub
C:\venvs\product_hub\Scripts\pip install -r backend\requirements.txt
```

## 3. Frontend — compilar

```powershell
cd frontend
npm install
npm run build
cd ..
```

Esto genera `frontend\dist`, que el backend sirve directamente — no hace
falta un servidor web aparte para el frontend.

## 4. Abrir el puerto en el firewall de Windows

Una sola vez, en una terminal como administrador:

```powershell
New-NetFirewallRule -DisplayName "Product Hub CCN" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

## 5. Arrancar el servidor

```powershell
C:\venvs\product_hub\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir backend
```

Mientras esa ventana quede abierta, la app responde en el puerto 8000 (API
y frontend en un solo proceso). Si se cierra la ventana, el servidor se cae.

## 6. Acceder desde cualquier PC de la red de la empresa

```powershell
ipconfig
```

Toma la IPv4 de esta máquina (algo como `192.168.x.x` o `10.x.x.x`) y desde
cualquier navegador de la red, entra a:

```
http://<esa-IP>:8000
```

## Dónde quedan los reportes cargados

Cada `.xlsx` que se sube desde "Cargar Reporte" se guarda como un snapshot
independiente en:

```
%USERPROFILE%\.local\product_hub_data\reports\<id>.json
```

Esto vive **fuera** de la carpeta del proyecto, así que reemplazar los
archivos del proyecto (una actualización futura) no borra el histórico de
reportes. Se puede cambiar de ubicación con la variable de entorno
`PRODUCT_HUB_DATA_DIR` antes de arrancar uvicorn, por ejemplo para apuntar
a un disco con respaldo.

## Actualizar el proyecto más adelante

Cuando haya cambios, se recibirá un zip nuevo. Pasos:

1. Detener el servidor (Ctrl+C en la terminal de uvicorn).
2. Descomprimir el zip nuevo sobre la misma carpeta (reemplaza los archivos
   de código; no toca `%USERPROFILE%\.local\product_hub_data\`, que vive
   aparte).
3. Repetir el paso 3 de arriba (`npm install && npm run build`) solo si el
   frontend cambió.
4. Volver a arrancar uvicorn (paso 5).

## Mantener el servidor arriba de forma permanente (opcional)

Los pasos anteriores dejan la app corriendo mientras la terminal esté
abierta. Si se quiere que sobreviva a un reinicio de la PC o a que alguien
cierre sesión sin querer, se puede configurar como servicio de Windows
(con NSSM o el Programador de Tareas). No es necesario para probar el
sistema; solo para dejarlo en producción de forma permanente.
