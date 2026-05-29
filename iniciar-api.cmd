@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PATH=%~dp0.tools\node-v22.22.3-win-x64;%PATH%"

echo ==========================================
echo  Iniciando SOMENTE a API (porta 3001)
echo ==========================================
echo  Aguarde "API server running on http://localhost:3001/"
echo  Depois abra outro terminal e rode iniciar-frontend.cmd
echo ==========================================
echo.

if exist node_modules\.bin\pnpm.cmd (
    node_modules\.bin\pnpm.cmd dev:api
) else (
    pnpm dev:api
)
pause
