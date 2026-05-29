@echo off
REM Reseta o banco SQLite e re-popula com dados de demonstração
cd /d "%~dp0"
echo Resetando banco SQLite e re-populando com dados demo...
call pnpm db:reset
echo.
echo Banco resetado com sucesso.
pause
