# Product Hub CCN — Instalacion en el servidor

Guia rapida para instalar y mantener el Product Hub CCN en el servidor interno de CCN. Todo se hace con scripts PowerShell — 3 comandos en total.

## Requisitos previos (una sola vez)

Instalar en el servidor:

1. **Python 3.11 o superior** — https://www.python.org/downloads/windows/
   - Al instalar, tildar **"Add Python to PATH"**
2. **Node.js 18 o superior** — https://nodejs.org/ (version LTS)
3. **Git** — https://git-scm.com/download/win (o TortoiseGit si prefiere interfaz grafica)

Para verificar que quedo bien, abrir PowerShell y correr:
```powershell
python --version
node --version
git --version
```

Los tres deben devolver una version.

## Instalacion (una sola vez)

1. Clonar el repositorio en `C:\ProductHub\`:
   ```powershell
   cd C:\
   git clone https://github.com/AdrianLTR/Product-Dashboard.git ProductHub
   cd ProductHub
   ```

2. Correr el instalador:
   ```powershell
   powershell -ExecutionPolicy Bypass -File install.ps1
   ```
   Este script:
   - Instala las librerias de Python (fastapi, pandas, etc.)
   - Instala y compila el frontend (React)
   - Crea la carpeta de datos en `C:\ProductHubData\`
   - Setea la variable de entorno `PRODUCT_HUB_DATA_DIR`

## Arrancar el servidor

Doble click en **`start.ps1`** — se abre una ventana de PowerShell con el servidor corriendo.

**Dejar esa ventana abierta.** Se puede minimizar. Si se cierra, se apaga el servidor.

Acceso:
- Desde el servidor: http://localhost:8000
- Desde la LAN: `http://<ip-del-servidor>:8000`

Puede que la primera vez haga falta abrir el puerto 8000 en el firewall de Windows.

**Nota:** el servidor CCN esta encendido 24/7 y nadie cierra sesion, asi que la ventana queda siempre abierta y el servicio queda disponible. Si en algun momento el servidor se reinicia, hay que volver a hacer doble click en `start.ps1`.

## Actualizar a la ultima version

Cada vez que haya cambios en el repositorio:

1. Cerrar la ventana de `start.ps1` (con la X o Ctrl+C dentro)
2. Correr:
   ```powershell
   cd C:\ProductHub
   powershell -ExecutionPolicy Bypass -File update.ps1
   ```
3. Volver a doble-click en `start.ps1`

El script `update.ps1`:
- Hace `git pull` para bajar los cambios
- Reinstala dependencias solo si `requirements.txt` cambio
- Recompila el frontend
- Muestra la lista de commits nuevos que se aplicaron

Los **reportes cargados no se tocan** — viven en `C:\ProductHubData\`, fuera del proyecto.

## Configuracion por variables de entorno

- **`PRODUCT_HUB_DATA_DIR`** — Ruta donde se guardan los reportes. Default: `C:\ProductHubData`.
- **`PRODUCT_HUB_PORT`** — Puerto del servidor. Default: `8000`.

Se setean permanentemente con:
```powershell
[Environment]::SetEnvironmentVariable("PRODUCT_HUB_PORT", "8080", "Machine")
```

Reiniciar `start.ps1` para que las tome.

## Autenticacion con GitHub (repo privado)

Al clonar y hacer pull, Git va a pedir credenciales. Las opciones estan documentadas aparte — la mas segura para un servidor es una **Deploy Key SSH** de solo lectura, generada especificamente para este equipo.

## Problemas comunes

- **"python no se reconoce"** — Python no esta en el PATH. Reinstalar y tildar "Add to PATH".
- **"npm no se reconoce"** — Node.js no esta en el PATH. Cerrar y reabrir PowerShell despues de instalar.
- **Puerto 8000 ocupado** — Cambiar el puerto con `[Environment]::SetEnvironmentVariable("PRODUCT_HUB_PORT", "8080", "Machine")` y volver a arrancar.
- **La ventana se cierra sola** — Correr desde una terminal (`powershell.exe`) y ejecutar `.\start.ps1` para ver el mensaje de error.
- **"Access denied" al instalar dependencias** — Correr el PowerShell como Administrador solo para `install.ps1` la primera vez.

## Backup

Solo hay que respaldar `C:\ProductHubData\` — es la unica carpeta con datos reales. Todo lo demas se regenera clonando el repo y corriendo `install.ps1`.

## Alternativa: correrlo como servicio Windows

Si en algun momento se prefiere que el servidor arranque solo al bootear (sin depender de la ventana abierta), existe `install-service.ps1` que lo registra como servicio Windows usando NSSM. Requiere permisos de Administrador y agrega complejidad extra — solo tiene sentido si nadie se va a acordar de arrancar `start.ps1` despues de un reinicio.
