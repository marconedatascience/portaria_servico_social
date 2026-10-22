# scripts\setup.ps1
# Script de instalacao de dependencias (Backend + Frontend)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " [HNSBC] Instalando Dependencias do Projeto" -ForegroundColor Cyan
Write-Host " Diretorio: $ProjectRoot" -ForegroundColor Gray
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Detectar comando Python
$PythonCmd = if (Get-Command py -ErrorAction SilentlyContinue) { "py" } elseif (Get-Command python -ErrorAction SilentlyContinue) { "python" } else { $null }

if (-not $PythonCmd) {
    Write-Host "ERRO: Python nao encontrado no PATH do sistema." -ForegroundColor Red
    exit 1
}

# 2. Configurar Ambiente Virtual (venv)
$VenvDir = Join-Path $ProjectRoot "venv"
if (-not (Test-Path $VenvDir)) {
    Write-Host "`n[1/3] Criando ambiente virtual Python ($VenvDir)..." -ForegroundColor Yellow
    & $PythonCmd -m venv $VenvDir
} else {
    Write-Host "`n[1/3] Ambiente virtual ja existe em $VenvDir." -ForegroundColor Green
}

$VenvPip = Join-Path $VenvDir "Scripts\pip.exe"
if (-not (Test-Path $VenvPip)) {
    $VenvPip = "pip"
}

# 3. Instalar Dependencias do Backend
$ReqPath = Join-Path $ProjectRoot "backend\requirements.txt"
if (-not (Test-Path $ReqPath)) {
    $ReqPath = Join-Path $ProjectRoot "requirements.txt"
}

if (Test-Path $ReqPath) {
    Write-Host "`n[2/3] Instalando dependencias do Backend via pip ($ReqPath)..." -ForegroundColor Yellow
    & $VenvPip install -r $ReqPath
    Write-Host "Dependencias do Backend instaladas com sucesso!" -ForegroundColor Green
} else {
    Write-Host "`n[2/3] AVISO: requirements.txt nao encontrado em $ProjectRoot." -ForegroundColor Yellow
}

# 4. Instalar Dependencias do Frontend
$FrontendDir = Join-Path $ProjectRoot "frontend"
if (-not (Test-Path $FrontendDir) -and (Test-Path "C:\Users\marcone\Documents\portaria_serivco_social\frontend")) {
    $FrontendDir = "C:\Users\marcone\Documents\portaria_serivco_social\frontend"
    Write-Host "`n[3/3] Frontend localizado em $FrontendDir..." -ForegroundColor Cyan
}

if (Test-Path (Join-Path $FrontendDir "package.json")) {
    Write-Host "`n[3/3] Instalando dependencias do Frontend via npm ($FrontendDir)..." -ForegroundColor Yellow
    Push-Location $FrontendDir
    npm install
    Pop-Location
    Write-Host "Dependencias do Frontend instaladas com sucesso!" -ForegroundColor Green
} else {
    Write-Host "`n[3/3] AVISO: Pasta frontend com package.json nao encontrada em $ProjectRoot." -ForegroundColor Yellow
}

Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host " Setup concluido com sucesso! Execute .\scripts\dev.ps1 para iniciar." -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Cyan
