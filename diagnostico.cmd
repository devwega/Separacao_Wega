@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PATH=%~dp0.tools\node-v22.22.3-win-x64;%PATH%"

echo ==========================================
echo  DIAGNOSTICO - Portal Troca de Itens
echo ==========================================
echo.

echo --- Diretorio atual ---
cd
echo.

echo --- Versao do Node ---
node --version 2>&1
echo.

echo --- Versao do pnpm (PATH) ---
where pnpm 2>nul
pnpm --version 2>nul
echo.

echo --- Versao do pnpm local ---
if exist node_modules\.bin\pnpm.cmd (
    node_modules\.bin\pnpm.cmd --version
) else (
    echo node_modules\.bin\pnpm.cmd NAO encontrado
)
echo.

echo --- node_modules existe? ---
if exist node_modules (echo SIM) else (echo NAO - rode: pnpm install)
echo.

echo --- better-sqlite3 instalado? ---
if exist node_modules\better-sqlite3 (echo SIM) else (echo NAO)
echo.

echo --- Banco SQLite ---
if exist server\db\sankhya.sqlite (
    for %%I in (server\db\sankhya.sqlite) do echo Tamanho: %%~zI bytes
) else (
    echo NAO existe - sera criado no primeiro start
)
echo.

echo --- Portas em uso (3000 / 3001) ---
netstat -ano | findstr ":3000 " | findstr LISTENING
netstat -ano | findstr ":3001 " | findstr LISTENING
echo (vazio = portas livres)
echo.

echo --- Ultimas linhas dev-full.out.log ---
if exist dev-full.out.log (
    powershell -Command "Get-Content dev-full.out.log -Tail 20"
) else (
    echo Sem log anterior
)
echo.

echo --- Ultimas linhas dev-full.err.log ---
if exist dev-full.err.log (
    powershell -Command "Get-Content dev-full.err.log -Tail 20"
) else (
    echo Sem log de erro
)
echo.

echo ==========================================
echo  Fim do diagnostico
echo ==========================================
pause
