@echo off
chcp 65001 > nul
cls
echo ========================================================
echo       ENVIANDO PROJETO PARA O GITHUB
echo   Repositorio: marconedatascience/portaria_servico_social
echo ========================================================
echo.
cd /d "%~dp0"
echo 1. Adicionando arquivos alterados...
git add .
echo.
echo 2. Registrando commit com as alteracoes...
git diff-index --quiet HEAD --
if %ERRORLEVEL% neq 0 (
    git commit -m "fix(auth): conexao api cadastro, CORS backend, tratamento amigavel de erros e correcao de setState"
) else (
    echo Nenhum arquivo pendente para commit. Prosseguindo com o envio...
)
echo.
echo 3. Enviando branch main para o GitHub...
echo (Se pedir autorizacao, clique em autorizar no navegador)
echo.
git push origin main
echo.
echo ========================================================
if %ERRORLEVEL% equ 0 (
    echo    Envio concluido com sucesso no GitHub!
) else (
    echo    Ocorreu uma falha no envio. Verifique o login.
)
echo ========================================================
pause
