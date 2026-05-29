# Inicia o dev server em background, sem janela visivel, com log em arquivo.
# Usa o Node 22 bundled em .tools/ para evitar problemas de NODE_MODULE_VERSION.

$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot

# Forca uso do Node 22 bundled (better-sqlite3 esta pre-compilado para ele)
$nodeBundled = Join-Path $ProjectRoot ".tools\node-v22.22.3-win-x64"
if (Test-Path "$nodeBundled\node.exe") {
    $env:PATH = "$nodeBundled;$env:PATH"
}

$LogOut = Join-Path $ProjectRoot "dev-full.out.log"
$LogErr = Join-Path $ProjectRoot "dev-full.err.log"

# Detecta pnpm (global ou local)
$pnpmCmd = "pnpm"
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    $localPnpm = Join-Path $ProjectRoot "node_modules\.bin\pnpm.cmd"
    if (Test-Path $localPnpm) {
        $pnpmCmd = $localPnpm
    } else {
        Add-Content $LogErr "[$(Get-Date)] ERRO: pnpm nao encontrado"
        exit 1
    }
}

# Evita rodar 2x
function PortaEmUso($porta) {
    return (Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue) -ne $null
}

if ((PortaEmUso 3000) -or (PortaEmUso 3001)) {
    Add-Content $LogOut "[$(Get-Date)] Servidor ja esta rodando (porta 3000 ou 3001 em uso). Abortando."
    exit 0
}

Add-Content $LogOut "[$(Get-Date)] === Iniciando dev server em background (Node 22 bundled) ==="

Start-Process -FilePath $pnpmCmd `
    -ArgumentList "dev:full" `
    -WorkingDirectory $ProjectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $LogOut `
    -RedirectStandardError $LogErr
