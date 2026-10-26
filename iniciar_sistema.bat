@echo off
title Sistema Portaria e Servico Social - HNSBC
echo ========================================================
echo   Iniciando o Sistema Portaria e Servico Social (Rede Local)
echo ========================================================
echo.

rem Descobrir o IP da maquina na rede local
set "MEU_IP=192.168.11.159"
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        set "MEU_IP=%%b"
    )
)

echo [1/2] Iniciando Servidor Backend (FastAPI em 0.0.0.0:8000)...
if exist "%~dp0venv\Scripts\python.exe" (
    start "Backend - FastAPI" cmd /k "cd /d "%~dp0backend" && "%~dp0venv\Scripts\python.exe" -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
) else (
    start "Backend - FastAPI" cmd /k "cd /d "%~dp0backend" && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
)

timeout /t 2 /nobreak >nul

echo [2/2] Iniciando Servidor Frontend (Next.js em 0.0.0.0:3000)...
start "Frontend - Next.js" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 5 /nobreak >nul

echo Abrindo aplicacao no navegador local...
start http://localhost:3000

echo.
echo ========================================================
echo   TUDO PRONTO PARA ACESSO EM TODA A REDE!
echo.
echo   - Acesso Local:            http://localhost:3000
echo   - Acesso em Qualquer Rede: http://%MEU_IP%:3000
echo.
echo   - API Backend:             http://%MEU_IP%:8000/docs
echo ========================================================
echo.
pause
