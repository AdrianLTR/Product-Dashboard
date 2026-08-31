# start.ps1 - Arranca Product Hub CCN manualmente (util para pruebas)
#
# Para produccion es mejor usar install-service.ps1 y correrlo como servicio
# Windows: se arranca solo con el sistema y sobrevive a logouts.
#
# Uso: click derecho -> "Ejecutar con PowerShell"
#      Ctrl+C para detener.

Set-Location -Path $PSScriptRoot

# Asegurar la variable de entorno para esta sesion (por si install.ps1 no corrio)
if (-not $env:PRODUCT_HUB_DATA_DIR) {
    $env:PRODUCT_HUB_DATA_DIR = "C:\ProductHubData"
    if (-not (Test-Path $env:PRODUCT_HUB_DATA_DIR)) {
        New-Item -ItemType Directory -Path $env:PRODUCT_HUB_DATA_DIR | Out-Null
    }
}

$port = if ($env:PRODUCT_HUB_PORT) { $env:PRODUCT_HUB_PORT } else { "8000" }

$host.UI.RawUI.WindowTitle = "Product Hub CCN - Servidor (NO CERRAR)"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Product Hub CCN - Servidor corriendo" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Puerto:        $port"
Write-Host "  Data dir:      $env:PRODUCT_HUB_DATA_DIR"
Write-Host "  Acceso local:  http://localhost:$port"
Write-Host "  Acceso LAN:    http://<ip-del-servidor>:$port"
Write-Host ""
Write-Host "  * DEJAR ESTA VENTANA ABIERTA (se puede minimizar) *" -ForegroundColor Yellow
Write-Host "  * Si se cierra, el servidor se apaga             *" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Para detener el servidor: Ctrl+C o cerrar la ventana" -ForegroundColor DarkGray
Write-Host ""

python -m uvicorn backend.app.main:app --host 0.0.0.0 --port $port
