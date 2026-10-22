@echo off
chcp 65001 > nul
cls
echo ========================================================
echo    PUBLICACAO NA VERCEL - PORTARIA E SERVICO SOCIAL
echo    Conta: marconedatascience-2608
echo ========================================================
echo.
cd /d "%~dp0frontend"

echo [1/2] Autenticando na sua conta Vercel...
echo       (Se o navegador abrir, confirme a autorizacao na tela)
call npx vercel login

echo.
echo [2/2] Publicando o projeto em producao...
call npx vercel --prod

echo.
echo ========================================================
echo    Procedimento concluido com sucesso!
echo ========================================================
pause
