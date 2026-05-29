@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PATH=%~dp0.tools\node-v22.22.3-win-x64;%PATH%"

echo ==========================================
echo  Iniciando SOMENTE o Frontend (porta 3000)
echo ==========================================
echo  Pre-requisito: API deve estar rodando em iniciar-api.cmd
echo  Frontend: http://localhost:3000
echo ==========================================
echo.

if exist node_modules\.bin\pnpm.cmd (
    node_modules\.bin\pnpm.cmd dev
) else (
    pnpm dev
)
pause
