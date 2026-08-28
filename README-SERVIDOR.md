# Product Hub CCN — Instalacion en el servidor

Esta guia es para instalar y mantener el Product Hub CCN en el servidor interno de CCN. Todo se maneja con scripts PowerShell — no hace falta manejo manual de venv, dependencias ni servicios.

## Requisitos previos (una sola vez)

Instalar en el servidor:

1. **Python 3.11 o superior** — https://www.python.org/downloads/windows/
   - Al instalar, tildar "Add Python to PATH"
2. **Node.js 18 o superior** — https://nodejs.org/
   - Version LTS
3. **Git** — https://git-scm.com/download/win
   - O TortoiseGit si prefieren interfaz grafica

Para verificar que todo quedo bien, abrir PowerShell y correr:
```powershell
python --version
node --version
git --version
```

Los tres deben devolver una version.

## Primera instalacion

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

3. **Opcion A** — Arrancar como servicio Windows (recomendado para produccion):
   ```powershell
   # Como Administrador
   powershell -ExecutionPolicy Bypass -File install-service.ps1
   ```
   Esto instala NSSM (si no lo tenes) y registra el servicio `ProductHubCCN`.
   Se arranca solo al bootear el servidor.

   **Opcion B** — Arrancar manualmente (util para probar):
   ```powershell
   .\start.ps1
   ```
   Se cierra con Ctrl+C. No sobrevive al cerrar la ventana.

4. Probar el acceso:
   - Desde el servidor: http://localhost:8000
   - Desde la LAN: http://\<ip-del-servidor\>:8000
   - Puede que haga falta abrir el puerto 8000 en el firewall de Windows.

## Actualizar a la ultima version

Cada vez que haya cambios en el repositorio:

```powershell
cd C:\ProductHub
powershell -ExecutionPolicy Bypass -File update.ps1
```

Este script:
- Hace `git pull` para bajar los cambios
- Reinstala dependencias solo si `requirements.txt` cambio
- Recompila el frontend
- Reinicia el servicio si esta instalado
- Muestra la lista de commits nuevos que se aplicaron

Los **reportes cargados no se tocan** — viven en `C:\ProductHubData\`, fuera del proyecto.

## Manejo del servicio

Si se instalo como servicio con `install-service.ps1`:

```powershell
# Ver estado
Get-Service ProductHubCCN

# Arrancar / parar / reiniciar
Start-Service   ProductHubCCN
Stop-Service    ProductHubCCN
Restart-Service ProductHubCCN
```

O desde la interfaz grafica: `services.msc` -> buscar "Product Hub CCN".

Los logs quedan en `C:\ProductHub\logs\stdout.log` y `stderr.log`.

## Configuracion por variables de entorno

- **`PRODUCT_HUB_DATA_DIR`** — Ruta donde se guardan los reportes. Default: `C:\ProductHubData`.
- **`PRODUCT_HUB_PORT`** — Puerto del servidor. Default: `8000`.

Si las cambias, hay que reiniciar el servicio para que las tome.

## Autenticacion con GitHub (repo privado)

Al clonar y hacer pull, Git va a pedir credenciales. Ver las opciones en el `README-DEPLOY-KEYS.md` (o preguntarle al owner del repo). La mas segura para un servidor es una **Deploy Key SSH** de solo lectura.

## Problemas comunes

- **"python no se reconoce"** — Python no esta en el PATH. Reinstalar y tildar "Add to PATH".
- **"npm no se reconoce"** — Node.js no esta en el PATH. Cerrar y reabrir PowerShell despues de instalar.
- **Puerto 8000 ocupado** — Cambiar el puerto con `$env:PRODUCT_HUB_PORT = "8080"` y volver a instalar el servicio.
- **El servicio no arranca** — Revisar `C:\ProductHub\logs\stderr.log`.
- **Errores de permisos** — Correr PowerShell como Administrador para los scripts que registran servicios.

## Backup

Solo hay que respaldar `C:\ProductHubData\` — es la unica carpeta que contiene datos reales del usuario. Todo lo demas se puede regenerar clonando el repo y corriendo `install.ps1`.
