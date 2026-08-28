# install.ps1 - Instalacion inicial de Product Hub CCN en el servidor
#
# Corre UNA SOLA VEZ cuando se clona el repo por primera vez.
# Para actualizaciones posteriores usar update.ps1
#
# Requisitos previos en el servidor:
#   - Python 3.11+ instalado y en el PATH (probar: python --version)
#   - Node.js 18+ instalado y en el PATH (probar: node --version)
#   - Git instalado (para las actualizaciones futuras)
#
# Uso: click derecho sobre este archivo -> "Ejecutar con PowerShell"
#      o desde una terminal: powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Product Hub CCN - Instalacion en el servidor" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Verificar Python y Node
Write-Host "`n[1/4] Verificando requisitos..." -ForegroundColor Yellow
try { $py = python --version 2>&1; Write-Host "  Python: $py" -ForegroundColor Green }
catch { Write-Host "  ERROR: Python no esta instalado o no esta en el PATH" -ForegroundColor Red; exit 1 }
try { $nd = node --version 2>&1; Write-Host "  Node:   $nd" -ForegroundColor Green }
catch { Write-Host "  ERROR: Node.js no esta instalado o no esta en el PATH" -ForegroundColor Red; exit 1 }

# 2. Instalar dependencias Python (en el Python global del sistema)
Write-Host "`n[2/4] Instalando dependencias de Python..." -ForegroundColor Yellow
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR instalando dependencias Python" -ForegroundColor Red; exit 1 }

# 3. Instalar dependencias Node y compilar frontend
Write-Host "`n[3/4] Compilando frontend..." -ForegroundColor Yellow
Set-Location frontend
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR en npm install" -ForegroundColor Red; exit 1 }
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR en npm run build" -ForegroundColor Red; exit 1 }
Set-Location ..

# 4. Configurar carpeta de datos (fuera del proyecto para que git pull no la toque)
Write-Host "`n[4/4] Configurando carpeta de datos..." -ForegroundColor Yellow
$dataDir = "C:\ProductHubData"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir | Out-Null
    Write-Host "  Carpeta creada: $dataDir" -ForegroundColor Green
} else {
    Write-Host "  Ya existe:      $dataDir" -ForegroundColor Green
}
# Setear la variable de entorno a nivel de maquina (persiste entre reinicios)
[Environment]::SetEnvironmentVariable("PRODUCT_HUB_DATA_DIR", $dataDir, "Machine")
Write-Host "  Variable PRODUCT_HUB_DATA_DIR seteada a: $dataDir" -ForegroundColor Green

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  Instalacion completada" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "`nProximos pasos:"
Write-Host "  - Para arrancar el servidor manualmente:  .\start.ps1"
Write-Host "  - Para instalarlo como servicio Windows:  .\install-service.ps1"
Write-Host "  - Para actualizarlo cuando haya cambios:  .\update.ps1"
Write-Host ""
