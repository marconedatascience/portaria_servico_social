@echo off
chcp 65001 > nul
cls
echo ========================================================
echo       ENVIANDO PROJETO PARA O GITHUB
echo   Repositorio: marconedatascience/portaria_servico_social
echo ========================================================
echo.
cd /d "%~dp0"
echo 1. Adicionando arquivos alterados e novas stores...
git add .
echo.
echo 2. Registrando commit com as refatoracoes...
git commit -m "refactor(portaria): separa stores Orelhinha/Visitas, persiste visitantes via INSERT/push, adiciona hidratacao F5 e validacoes"
echo.
echo 3. Enviando branch main para o GitHub...
echo (Se pedir autorizacao, clique em autorizar no navegador)
echo.
git push -u origin main
echo.
echo ========================================================
if %ERRORLEVEL% equ 0 (
    echo    Envio concluido com sucesso no GitHub!
) else (
    echo    Ocorreu uma falha no envio. Verifique o login.
)
echo ========================================================
pause
