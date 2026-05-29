# Repara o binding nativo do better-sqlite3 forcando Node 22.
# Estrategia: SEMPRE usa o Node 22 bundled. Reinstala better-sqlite3 baixando o prebuilt v22.

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Reparando better-sqlite3 com Node 22" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Forca Node 22 no inicio do PATH
$nodeBundled = Join-Path $PSScriptRoot ".tools\node-v22.22.3-win-x64"
if (-not (Test-Path "$nodeBundled\node.exe")) {
    Write-Host "[ERRO] Node 22 bundled nao encontrado: $nodeBundled" -ForegroundColor Red
    Read-Host "Pressione Enter para fechar"
    exit 1
}
# IMPORTANTE: bloqueia totalmente o Node 24 global
$env:PATH = "$nodeBundled;" + (($env:PATH -split ';') -notmatch 'nodejs' -join ';')
$nodeVer = & "$nodeBundled\node.exe" --version
Write-Host "[1/5] Node ativo: $nodeVer" -ForegroundColor Green
Write-Host ""

# 2. Para processos antigos
Write-Host "[2/5] Parando processos antigos nas portas 3000/3001..." -ForegroundColor Yellow
foreach ($porta in 3000, 3001) {
    $conn = Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $procIds = $conn.OwningProcess | Select-Object -Unique
        foreach ($procId in $procIds) {
            if ($procId -and $procId -gt 0) {
                try { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue } catch {}
            }
        }
    }
}
Start-Sleep -Seconds 1
Write-Host ""

# 3. Limpa caches do better-sqlite3 e baixa prebuilt para Node 22
$bsqDir = Join-Path $PSScriptRoot "node_modules\.pnpm\better-sqlite3@11.10.0\node_modules\better-sqlite3"
if (-not (Test-Path $bsqDir)) {
    Write-Host "[3/5] better-sqlite3 nao instalado, rodando pnpm install..." -ForegroundColor Yellow
    # localiza npm/pnpm do Node 22
    $npmCmd = Join-Path $nodeBundled "npm.cmd"
    & $npmCmd install -g pnpm@10.4.1 2>&1 | Out-Host
    & pnpm install 2>&1 | Out-Host
}

Write-Host "[3/5] Re-baixando prebuilt do better-sqlite3 para Node 22..." -ForegroundColor Yellow
Push-Location $bsqDir
try {
    Remove-Item -Recurse -Force "build" -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force "lib\binding" -ErrorAction SilentlyContinue

    Write-Host "  Tentando via prebuild-install..." -ForegroundColor DarkGray
    & "$nodeBundled\node.exe" "node_modules\prebuild-install\bin.js" 2>&1 | Out-Host
} finally {
    Pop-Location
}
Write-Host ""

# 4. Verifica binding
Write-Host "[4/5] Verificando binding nativo..." -ForegroundColor Yellow
$found = $false
$searchPaths = @(
    "build\Release\better_sqlite3.node",
    "lib\binding\node-v127-win32-x64\better_sqlite3.node"
)
foreach ($p in $searchPaths) {
    $full = Join-Path $bsqDir $p
    if (Test-Path $full) {
        $size = (Get-Item $full).Length
        Write-Host "  [OK] $p ($size bytes)" -ForegroundColor Green
        $found = $true
        break
    }
}

if (-not $found) {
    Write-Host "  [FALHA] Binding nao encontrado. Tentando download manual..." -ForegroundColor Yellow
    $url = "https://github.com/WiseLibs/better-sqlite3/releases/download/v11.10.0/better-sqlite3-v11.10.0-node-v127-win32-x64.tar.gz"
    $tarball = Join-Path $env:TEMP "bsq-v127.tar.gz"
    try {
        Write-Host "  Baixando $url" -ForegroundColor DarkGray
        Invoke-WebRequest -Uri $url -OutFile $tarball -UseBasicParsing
        Write-Host "  Extraindo..." -ForegroundColor DarkGray
        tar -xzf $tarball -C $bsqDir
        if (Test-Path (Join-Path $bsqDir "build\Release\better_sqlite3.node")) {
            Write-Host "  [OK] Extraido com sucesso." -ForegroundColor Green
            $found = $true
        }
    } catch {
        Write-Host "  [ERRO] Download manual falhou: $_" -ForegroundColor Red
    }
}

if (-not $found) {
    Write-Host ""
    Write-Host "Nao foi possivel obter o binding. Faca manualmente:" -ForegroundColor Red
    Write-Host "  1. Abra https://github.com/WiseLibs/better-sqlite3/releases/tag/v11.10.0" -ForegroundColor Yellow
    Write-Host "  2. Baixe better-sqlite3-v11.10.0-node-v127-win32-x64.tar.gz" -ForegroundColor Yellow
    Write-Host "  3. Extraia em: $bsqDir" -ForegroundColor Yellow
    Read-Host "Pressione Enter para tentar iniciar mesmo assim"
}
Write-Host ""

# 5. Teste rapido do require + iniciar dev:full
Write-Host "[5/5] Testando require do better-sqlite3..." -ForegroundColor Yellow
& "$nodeBundled\node.exe" -e "try { const D = require('better-sqlite3'); const d = new D(':memory:'); d.exec('CREATE TABLE t(x)'); console.log('  [OK] better-sqlite3 carregado e funcional'); } catch(e) { console.log('  [FAIL]', e.message); process.exit(1); }"
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ABORT] better-sqlite3 nao carrega. Veja os logs acima." -ForegroundColor Red
    Read-Host "Pressione Enter para fechar"
    exit 1
}
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Iniciando dev:full" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "  API:      http://localhost:3001/api/health" -ForegroundColor Green
Write-Host ""

$pnpmCmd = "pnpm"
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    $localPnpm = Join-Path $PSScriptRoot "node_modules\.bin\pnpm.cmd"
    if (Test-Path $localPnpm) { $pnpmCmd = $localPnpm }
}

& $pnpmCmd dev:full
