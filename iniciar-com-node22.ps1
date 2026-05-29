# Inicia o dev server usando o Node 22 bundled em .tools/
# Resolve o erro NODE_MODULE_VERSION sem precisar de Visual Studio.

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Iniciando dev server com Node 22 bundled" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Para processos antigos nas portas 3000/3001
Write-Host "[1/3] Parando processos antigos..." -ForegroundColor Yellow
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
Start-Sleep -Seconds 1
Write-Host ""

# 2. Configura PATH para usar Node 22 bundled
$nodeBundled = Join-Path $PSScriptRoot ".tools\node-v22.22.3-win-x64"
if (-not (Test-Path "$nodeBundled\node.exe")) {
    Write-Host "[ERRO] Node 22 bundled nao encontrado em $nodeBundled" -ForegroundColor Red
    Write-Host "Verifique se o arquivo .tools\node-v22.22.3-win-x64.zip foi extraido." -ForegroundColor Red
    Read-Host "Pressione Enter para fechar"
    exit 1
}
$env:PATH = "$nodeBundled;$env:PATH"

Write-Host "[2/3] Versao do Node em uso:" -ForegroundColor Yellow
& "$nodeBundled\node.exe" --version
Write-Host "  (better-sqlite3 ja esta pre-compilado para esta versao)" -ForegroundColor DarkGray
Write-Host ""

# 3. Inicia pnpm dev:full (usara o Node 22 do PATH)
Write-Host "[3/3] Iniciando API (3001) + Frontend (3000)..." -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "  API:      http://localhost:3001/api/health" -ForegroundColor Green
Write-Host "  Debug:    http://localhost:3001/api/_debug" -ForegroundColor Green
Write-Host ""
Write-Host "Pressione Ctrl+C para parar." -ForegroundColor DarkGray
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Localiza pnpm
$pnpmCmd = "pnpm"
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    $localPnpm = Join-Path $PSScriptRoot "node_modules\.bin\pnpm.cmd"
    if (Test-Path $localPnpm) {
        $pnpmCmd = $localPnpm
    }
}

& $pnpmCmd dev:full
