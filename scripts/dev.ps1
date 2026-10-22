# scripts\dev.ps1
# Script para iniciar Backend (FastAPI) e Frontend (Next.js)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " [HNSBC] Inicializando Servicos (Backend + Frontend)" -ForegroundColor Cyan
Write-Host " Diretorio raiz: $ProjectRoot" -ForegroundColor Gray
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Localizar Backend e Python do venv
$BackendDir = Join-Path $ProjectRoot "backend"
if (-not (Test-Path $BackendDir)) {
    $BackendDir = $ProjectRoot
}

$VenvPython = Join-Path $ProjectRoot "venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    # Tenta venv no diretorio padrao caso executado de outro local
    if (Test-Path "C:\Users\marcone\Documents\portaria_serivco_social\venv\Scripts\python.exe") {
        $VenvPython = "C:\Users\marcone\Documents\portaria_serivco_social\venv\Scripts\python.exe"
    } else {
        $VenvPython = if (Get-Command py -ErrorAction SilentlyContinue) { "py" } else { "python" }
    }
}

Write-Host "`n[1/2] Iniciando Servidor Backend (FastAPI na porta 8000)..." -ForegroundColor Yellow
$BackendCmd = "`$Host.UI.RawUI.WindowTitle = 'HNSBC - Backend FastAPI'; Set-Location '$BackendDir'; & '$VenvPython' -m uvicorn main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $BackendCmd

# 2. Localizar Frontend
$FrontendDir = Join-Path $ProjectRoot "frontend"
if (-not (Test-Path $FrontendDir) -and (Test-Path "C:\Users\marcone\Documents\portaria_serivco_social\frontend")) {
    $FrontendDir = "C:\Users\marcone\Documents\portaria_serivco_social\frontend"
    Write-Host "Frontend redirecionado para $FrontendDir" -ForegroundColor Cyan
}

if (Test-Path (Join-Path $FrontendDir "package.json")) {
    Write-Host "[2/2] Iniciando Servidor Frontend (Next.js na porta 3000)..." -ForegroundColor Yellow
    $FrontendCmd = "`$Host.UI.RawUI.WindowTitle = 'HNSBC - Frontend Next.js'; Set-Location '$FrontendDir'; npm run dev"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $FrontendCmd
} else {
    Write-Host "[2/2] AVISO: Diretorio frontend nao encontrado para iniciar Next.js." -ForegroundColor Red
}

# 3. Aguardar subida dos servicos e abrir navegador
Start-Sleep -Seconds 3
Write-Host "`nAbrindo aplicacao no navegador..." -ForegroundColor Cyan
Start-Process "http://localhost:3000"
Start-Process "http://localhost:8000/docs"

Write-Host "`n====================================================" -ForegroundColor Green
Write-Host " Sistema em execucao!" -ForegroundColor Green
Write-Host " - Frontend:    http://localhost:3000" -ForegroundColor White
Write-Host " - Backend API: http://localhost:8000/docs" -ForegroundColor White
Write-Host "====================================================" -ForegroundColor Green
