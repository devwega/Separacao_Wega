@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM Adiciona o Node bundled ao PATH (caso o usuário não tenha Node instalado globalmente)
set "PATH=%~dp0.tools\node-v22.22.3-win-x64;%PATH%"

echo ==========================================
echo  Portal Troca de Itens - Sankhya
echo ==========================================

echo.
echo [1/4] Verificando Node...
node --version
if errorlevel 1 (
    echo [ERRO] Node nao encontrado. Verifique a pasta .tools\node-v22.22.3-win-x64
    pause
    exit /b 1
)

echo.
echo [2/4] Verificando pnpm...
where pnpm >nul 2>nul
if errorlevel 1 (
    echo pnpm nao esta no PATH. Usando node_modules/.bin/pnpm...
    set "PNPM=node_modules\.bin\pnpm.cmd"
) else (
    set "PNPM=pnpm"
)
%PNPM% --version

echo.
echo [3/4] Liberando porta 3000 e 3001 (caso esteja em uso)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr LISTENING') do (
    echo Matando processo PID %%a (porta 3000)
    taskkill /F /PID %%a >nul 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 " ^| findstr LISTENING') do (
    echo Matando processo PID %%a (porta 3001)
    taskkill /F /PID %%a >nul 2>nul
)

echo.
echo [4/4] Iniciando API (3001) + Frontend (3000)...
echo.
echo  Frontend: http://localhost:3000
echo  API:      http://localhost:3001/api/health
echo.
echo Pressione Ctrl+C para parar.
echo ==========================================
echo.
call %PNPM% dev:full
echo.
echo === Servidor encerrado ===
pause
