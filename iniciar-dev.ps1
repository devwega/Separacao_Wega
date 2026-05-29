# Inicia o ambiente dev: API (3001) + Frontend (3000)
# Uso no PowerShell:  .\iniciar-dev.ps1

$ErrorActionPreference = "Continue"
Set-Location -Path $PSScriptRoot

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Portal Troca de Itens - Sankhya" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Adiciona Node bundled ao PATH
$nodeBundled = Join-Path $PSScriptRoot ".tools\node-v22.22.3-win-x64"
if (Test-Path $nodeBundled) {
    $env:PATH = "$nodeBundled;$env:PATH"
}

Write-Host "[1/4] Versão do Node:" -ForegroundColor Yellow
node --version
Write-Host ""

Write-Host "[2/4] Versão do pnpm:" -ForegroundColor Yellow
$pnpmCmd = "pnpm"
$pnpmExists = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmExists) {
    $localPnpm = Join-Path $PSScriptRoot "node_modules\.bin\pnpm.cmd"
    if (Test-Path $localPnpm) {
        $pnpmCmd = $localPnpm
        Write-Host "(usando node_modules\.bin\pnpm.cmd)" -ForegroundColor DarkGray
    } else {
        Write-Host "ERRO: pnpm não encontrado. Rode: npm i -g pnpm" -ForegroundColor Red
        Read-Host "Pressione Enter para sair"
        exit 1
    }
}
& $pnpmCmd --version
Write-Host ""

Write-Host "[3/4] Liberando portas 3000 e 3001..." -ForegroundColor Yellow
foreach ($porta in 3000, 3001) {
    $pids = (Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique
    foreach ($p in $pids) {
        if ($p -and $p -gt 0) {
            Write-Host "  Encerrando PID $p (porta $porta)" -ForegroundColor DarkGray
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        }
    }
}
Write-Host ""

Write-Host "[4/4] Iniciando API (3001) + Frontend (3000)..." -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "  API:      http://localhost:3001/api/health" -ForegroundColor Green
Write-Host "  Debug:    http://localhost:3001/api/_debug" -ForegroundColor Green
Write-Host ""
Write-Host "Pressione Ctrl+C para parar." -ForegroundColor DarkGray
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

& $pnpmCmd dev:full

Write-Host ""
Write-Host "=== Servidor encerrado ===" -ForegroundColor Cyan
Read-Host "Pressione Enter para fechar"
