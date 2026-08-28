# install-service.ps1 - Instala Product Hub CCN como servicio de Windows via NSSM
#
# Usa NSSM (Non-Sucking Service Manager) para convertir uvicorn en un servicio
# Windows real: se arranca al bootear, se reinicia si crashea, se ve en services.msc.
#
# Requisitos:
#   - NSSM en el PATH, o descargarlo automaticamente (este script lo intenta)
#   - Correr como Administrador (para poder crear servicios)
#   - install.ps1 debe haberse corrido antes
#
# Uso: click derecho -> "Ejecutar con PowerShell" (como Administrador)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

# Verificar admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Este script necesita ejecutarse como Administrador." -ForegroundColor Red
    Write-Host "Click derecho -> 'Ejecutar como Administrador' o corre PowerShell elevado." -ForegroundColor Yellow
    exit 1
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Product Hub CCN - Instalacion como servicio" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$serviceName = "ProductHubCCN"
$displayName = "Product Hub CCN"
$description = "Dashboard interno de catalogacion de productos"
$port = if ($env:PRODUCT_HUB_PORT) { $env:PRODUCT_HUB_PORT } else { "8000" }
$dataDir = if ($env:PRODUCT_HUB_DATA_DIR) { $env:PRODUCT_HUB_DATA_DIR } else { "C:\ProductHubData" }

# 1. Buscar / descargar NSSM
Write-Host "`n[1/3] Buscando NSSM..." -ForegroundColor Yellow
$nssm = $null
try { $nssm = (Get-Command nssm.exe -ErrorAction Stop).Source } catch {}

if (-not $nssm) {
    # Descargar NSSM automaticamente
    $nssmDir = "C:\nssm"
    $nssmZip = "$env:TEMP\nssm.zip"
    Write-Host "  NSSM no encontrado. Descargando..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile $nssmZip
    Expand-Archive -Path $nssmZip -DestinationPath $nssmDir -Force
    $arch = if ([Environment]::Is64BitOperatingSystem) { "win64" } else { "win32" }
    $nssm = "$nssmDir\nssm-2.24\$arch\nssm.exe"
    if (-not (Test-Path $nssm)) {
        Write-Host "  ERROR: no se pudo instalar NSSM. Descargalo manualmente de https://nssm.cc" -ForegroundColor Red
        exit 1
    }
    Write-Host "  NSSM instalado en: $nssm" -ForegroundColor Green
} else {
    Write-Host "  NSSM encontrado: $nssm" -ForegroundColor Green
}

# 2. Remover el servicio si ya existe (para reinstalar limpio)
Write-Host "`n[2/3] Registrando el servicio..." -ForegroundColor Yellow
$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "  Servicio ya existia; lo removemos primero." -ForegroundColor Yellow
    & $nssm stop $serviceName confirm | Out-Null
    & $nssm remove $serviceName confirm | Out-Null
    Start-Sleep -Seconds 2
}

# 3. Crear el servicio
$python = (Get-Command python.exe).Source
$appArgs = "-m uvicorn backend.app.main:app --host 0.0.0.0 --port $port"

& $nssm install $serviceName $python $appArgs | Out-Null
& $nssm set $serviceName AppDirectory $PSScriptRoot | Out-Null
& $nssm set $serviceName DisplayName $displayName | Out-Null
& $nssm set $serviceName Description $description | Out-Null
& $nssm set $serviceName Start SERVICE_AUTO_START | Out-Null
& $nssm set $serviceName AppEnvironmentExtra "PRODUCT_HUB_DATA_DIR=$dataDir" | Out-Null
# Logs
$logDir = "$PSScriptRoot\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
& $nssm set $serviceName AppStdout "$logDir\stdout.log" | Out-Null
& $nssm set $serviceName AppStderr "$logDir\stderr.log" | Out-Null
& $nssm set $serviceName AppRotateFiles 1 | Out-Null
& $nssm set $serviceName AppRotateBytes 10485760 | Out-Null

Write-Host "  Servicio $serviceName registrado" -ForegroundColor Green

# Arrancarlo
Write-Host "`n[3/3] Arrancando el servicio..." -ForegroundColor Yellow
Start-Service -Name $serviceName
Start-Sleep -Seconds 2
$svc = Get-Service -Name $serviceName
Write-Host "  Estado: $($svc.Status)" -ForegroundColor Green

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  Servicio instalado y corriendo" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  URL local:    http://localhost:$port"
Write-Host "  URL LAN:      http://<ip-del-servidor>:$port"
Write-Host "  Logs:         $logDir"
Write-Host "  Data dir:     $dataDir"
Write-Host ""
Write-Host "  Manejarlo desde services.msc, o:"
Write-Host "    Start-Service ProductHubCCN"
Write-Host "    Stop-Service  ProductHubCCN"
Write-Host "    Restart-Service ProductHubCCN"
Write-Host ""
