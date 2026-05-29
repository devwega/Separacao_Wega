# Verifica se o dev server esta rodando e mostra os ultimos logs.
# Uso: .\status.ps1

$TaskName = "TrocaItensSankhya-DevServer"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Status do Dev Server" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Status da tarefa agendada
Write-Host "[Tarefa Agendada Windows]" -ForegroundColor Yellow
$t = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($t) {
    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    Write-Host "  Estado:           $($t.State)"
    Write-Host "  Ultima execucao:  $($info.LastRunTime)"
    Write-Host "  Ultimo resultado: $($info.LastTaskResult)  (0 = OK)"
} else {
    Write-Host "  NAO INSTALADA - rode instalar-autostart.ps1 primeiro" -ForegroundColor DarkGray
}
Write-Host ""

# Verifica portas
Write-Host "[Portas]" -ForegroundColor Yellow
foreach ($porta in 3000, 3001) {
    $c = Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue
    if ($c) {
        $procId = $c[0].OwningProcess
        $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
        Write-Host "  $porta -> ATIVO (PID $procId, $($p.Name))" -ForegroundColor Green
    } else {
        Write-Host "  $porta -> livre" -ForegroundColor DarkGray
    }
}
Write-Host ""

# Health check
Write-Host "[Health Check]" -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -TimeoutSec 3
    Write-Host "  API:      OK -- $($r | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Host "  API:      OFFLINE -- $($_.Exception.Message)" -ForegroundColor Red
}
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/" -TimeoutSec 3 -UseBasicParsing
    Write-Host "  Frontend: OK -- HTTP $($r.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "  Frontend: OFFLINE -- $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Ultimos logs
Write-Host "[Ultimas 15 linhas do log da API]" -ForegroundColor Yellow
$log = Join-Path $PSScriptRoot "dev-full.out.log"
if (Test-Path $log) {
    Get-Content $log -Tail 15 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
} else {
    Write-Host "  (sem log ainda)" -ForegroundColor DarkGray
}
Write-Host ""

Write-Host "Comandos:" -ForegroundColor Cyan
Write-Host "  Reiniciar:   .\parar-tudo.ps1 ; Start-ScheduledTask -TaskName $TaskName" -ForegroundColor DarkGray
Write-Host "  Parar:       .\parar-tudo.ps1" -ForegroundColor DarkGray
Write-Host "  Iniciar:     Start-ScheduledTask -TaskName $TaskName" -ForegroundColor DarkGray
Write-Host ""
Read-Host "Pressione Enter para fechar"
