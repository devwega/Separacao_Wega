# Repara o better-sqlite3 (recompila para versao atual do Node) e inicia o dev server.
# Resolve o erro NODE_MODULE_VERSION 127 vs 137.

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Reparando better-sqlite3 e iniciando" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Para processos antigos
Write-Host "[1/4] Parando processos antigos nas portas 3000/3001..." -ForegroundColor Yellow
foreach ($porta in 3000, 3001) {
    $conn = Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $procIds = $conn.OwningProcess | Select-Object -Unique
        foreach ($procId in $procIds) {
            if ($procId -and $procId -gt 0) {
                try {
                    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                    Write-Host "  PID $procId encerrado (porta $porta)" -ForegroundColor DarkGray
                } catch {}
            }
        }
    }
}
Write-Host ""

# 2. Mostra versao do Node
Write-Host "[2/4] Versao do Node:" -ForegroundColor Yellow
node --version
Write-Host ""

# 3. Recompila better-sqlite3 contra a versao atual do Node
Write-Host "[3/4] Recompilando better-sqlite3..." -ForegroundColor Yellow
Write-Host "  Pode demorar 1-2 minutos. Aguarde..." -ForegroundColor DarkGray
$pnpmCmd = "pnpm"
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    $localPnpm = Join-Path $PSScriptRoot "node_modules\.bin\pnpm.cmd"
    if (Test-Path $localPnpm) { $pnpmCmd = $localPnpm }
}
& $pnpmCmd rebuild better-sqlite3
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[FALLBACK] rebuild falhou, tentando reinstalar..." -ForegroundColor Yellow
    & $pnpmCmd install --force
}
Write-Host ""

# 4. Inicia o dev:full
Write-Host "[4/4] Iniciando API + Frontend..." -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "  API:      http://localhost:3001/api/health" -ForegroundColor Green
Write-Host "  Debug:    http://localhost:3001/api/_debug" -ForegroundColor Green
Write-Host ""
Write-Host "Pressione Ctrl+C para parar." -ForegroundColor DarkGray
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

& $pnpmCmd dev:full
