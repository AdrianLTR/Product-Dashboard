# update.ps1 - Actualizar Product Hub CCN a la ultima version
#
# Baja los cambios desde el repo, recompila el frontend y reinicia el servicio
# si esta instalado. No toca la carpeta de datos (los reportes cargados).
#
# Uso: click derecho -> "Ejecutar con PowerShell"
#      o: powershell -ExecutionPolicy Bypass -File update.ps1

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Product Hub CCN - Actualizacion" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. git pull
Write-Host "`n[1/4] Bajando cambios del repositorio..." -ForegroundColor Yellow
$before = git rev-parse HEAD
git pull
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR en git pull" -ForegroundColor Red; exit 1 }
$after = git rev-parse HEAD
if ($before -eq $after) {
    Write-Host "  Ya estabas en la ultima version. Nada que hacer." -ForegroundColor Green
    exit 0
}

# 2. Actualizar dependencias Python solo si requirements.txt cambio
Write-Host "`n[2/4] Chequeando dependencias Python..." -ForegroundColor Yellow
$changed = git diff --name-only $before $after
if ($changed -match "backend/requirements.txt") {
    Write-Host "  requirements.txt cambio, reinstalando..." -ForegroundColor Yellow
    python -m pip install -r backend\requirements.txt
} else {
    Write-Host "  Sin cambios en dependencias Python" -ForegroundColor Green
}

# 3. Recompilar frontend (siempre; los .jsx pueden haber cambiado)
Write-Host "`n[3/4] Recompilando frontend..." -ForegroundColor Yellow
Set-Location frontend
# npm install solo si package.json cambio
if ($changed -match "frontend/package.json") {
    Write-Host "  package.json cambio, corriendo npm install..." -ForegroundColor Yellow
    npm install
}
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR en npm run build" -ForegroundColor Red; exit 1 }
Set-Location ..

# 4. Reiniciar el servicio si esta instalado
Write-Host "`n[4/4] Reiniciando servicio (si existe)..." -ForegroundColor Yellow
$service = Get-Service -Name "ProductHubCCN" -ErrorAction SilentlyContinue
if ($service) {
    Restart-Service -Name "ProductHubCCN"
    Write-Host "  Servicio ProductHubCCN reiniciado" -ForegroundColor Green
} else {
    Write-Host "  El servicio no esta instalado. Si estas corriendo start.ps1 manualmente," -ForegroundColor Yellow
    Write-Host "  cerra esa ventana y volvela a abrir." -ForegroundColor Yellow
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  Actualizacion completada" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "`nCambios aplicados:"
git log --oneline $before..$after
