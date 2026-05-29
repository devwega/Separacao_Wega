# Repara o ambiente:
# 1. Detecta Visual Studio Build Tools instalado
# 2. Se encontrar, configura msvs_version e tenta recompilar better-sqlite3 pro Node atual
# 3. Se falhar, cai pro Node 22 bundled (que ja tem o binario pre-compilado)
# 4. Inicia o dev server

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Reparo completo do ambiente" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ETAPA 1: parar processos antigos
Write-Host "[1/5] Parando processos antigos..." -ForegroundColor Yellow
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

# ETAPA 2: detectar Visual Studio via vswhere
Write-Host "[2/5] Procurando Visual Studio com workload C++..." -ForegroundColor Yellow
$vswhereCandidates = @(
    "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe",
    "$env:ProgramFiles\Microsoft Visual Studio\Installer\vswhere.exe"
)
$vswhere = $null
foreach ($p in $vswhereCandidates) {
    if (Test-Path $p) { $vswhere = $p; break }
}

$vsVersion = $null
$vsYear = $null
if ($vswhere) {
    Write-Host "  vswhere encontrado: $vswhere" -ForegroundColor DarkGray
    $vsInfo = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -format json | ConvertFrom-Json
    if ($vsInfo -and $vsInfo.Count -gt 0) {
        $vs = $vsInfo[0]
        $vsVersion = $vs.installationVersion
        $vsPath = $vs.installationPath
        Write-Host "  Visual Studio encontrado: $($vs.displayName)" -ForegroundColor Green
        Write-Host "  Versao: $vsVersion" -ForegroundColor DarkGray
        Write-Host "  Caminho: $vsPath" -ForegroundColor DarkGray
        # Determina o ano
        if ($vsVersion -like "17.*") { $vsYear = "2022" }
        elseif ($vsVersion -like "16.*") { $vsYear = "2019" }
        elseif ($vsVersion -like "15.*") { $vsYear = "2017" }
    } else {
        Write-Host "  Nenhuma instalacao de VS com C++ encontrada por vswhere." -ForegroundColor Yellow
    }
} else {
    Write-Host "  vswhere.exe nao encontrado." -ForegroundColor Yellow
}
Write-Host ""

# ETAPA 3: tentativa de rebuild se VS detectado
$rebuildOk = $false
if ($vsYear) {
    Write-Host "[3/5] Tentando rebuild com VS $vsYear..." -ForegroundColor Yellow
    # Configura msvs_version pro pnpm
    & pnpm config set msvs_version $vsYear 2>&1 | Out-Null
    $env:GYP_MSVS_VERSION = $vsYear
    Write-Host "  msvs_version setado = $vsYear" -ForegroundColor DarkGray
    Write-Host "  Recompilando better-sqlite3 (pode levar 1-2 minutos)..." -ForegroundColor DarkGray

    & pnpm rebuild better-sqlite3 2>&1 | Tee-Object -Variable rebuildOutput | Out-Host

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Rebuild bem-sucedido!" -ForegroundColor Green
        $rebuildOk = $true
    } else {
        Write-Host "  [FALHA] Rebuild falhou. Usando fallback (Node 22 bundled)." -ForegroundColor Yellow
    }
} else {
    Write-Host "[3/5] VS C++ workload nao detectado. Pulando rebuild." -ForegroundColor Yellow
}
Write-Host ""

# ETAPA 4: se rebuild nao funcionou, configura Node 22 bundled
if (-not $rebuildOk) {
    Write-Host "[4/5] Configurando Node 22 bundled (fallback)..." -ForegroundColor Yellow
    $nodeBundled = Join-Path $PSScriptRoot ".tools\node-v22.22.3-win-x64"
    if (-not (Test-Path "$nodeBundled\node.exe")) {
        Write-Host "  [ERRO] Node 22 bundled nao encontrado em $nodeBundled" -ForegroundColor Red
        Read-Host "Pressione Enter para fechar"
        exit 1
    }
    $env:PATH = "$nodeBundled;$env:PATH"
    Write-Host "  Usando Node em: $nodeBundled" -ForegroundColor DarkGray
    Write-Host "  Versao: $(& "$nodeBundled\node.exe" --version)" -ForegroundColor Green
} else {
    Write-Host "[4/5] Usando Node global (recompilado com sucesso)." -ForegroundColor Yellow
    Write-Host "  Versao: $(node --version)" -ForegroundColor Green
}
Write-Host ""

# ETAPA 5: iniciar dev:full
Write-Host "[5/5] Iniciando API (3001) + Frontend (3000)..." -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "  API:      http://localhost:3001/api/health" -ForegroundColor Green
Write-Host "  Debug:    http://localhost:3001/api/_debug" -ForegroundColor Green
Write-Host ""
Write-Host "Pressione Ctrl+C para parar." -ForegroundColor DarkGray
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$pnpmCmd = "pnpm"
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    $localPnpm = Join-Path $PSScriptRoot "node_modules\.bin\pnpm.cmd"
    if (Test-Path $localPnpm) { $pnpmCmd = $localPnpm }
}

& $pnpmCmd dev:full
