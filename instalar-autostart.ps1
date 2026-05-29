# Registra o ambiente dev para iniciar automaticamente no login do Windows.
# Roda 1 vez. Depois disso, sempre que voce ligar o PC, API + Frontend sobem sozinhos.
#
# Uso: clique direito > "Executar com PowerShell"  OU  no PS: .\instalar-autostart.ps1
# Para desinstalar:  .\instalar-autostart.ps1 -Remover

param([switch]$Remover)

$ErrorActionPreference = "Stop"
$TaskName = "TrocaItensSankhya-DevServer"
$ProjectRoot = $PSScriptRoot
$ScriptToRun = Join-Path $ProjectRoot "iniciar-em-background.ps1"

if ($Remover) {
    Write-Host "Removendo tarefa agendada..." -ForegroundColor Yellow
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "OK - Autostart desabilitado." -ForegroundColor Green
    } catch {
        Write-Host "Tarefa nao encontrada (ja estava desinstalada)." -ForegroundColor DarkGray
    }
    Read-Host "Pressione Enter para fechar"
    exit 0
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Instalando autostart do dev server" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pasta do projeto: $ProjectRoot" -ForegroundColor DarkGray
Write-Host "Script alvo:      $ScriptToRun" -ForegroundColor DarkGray
Write-Host ""

if (-not (Test-Path $ScriptToRun)) {
    Write-Host "ERRO: arquivo iniciar-em-background.ps1 nao foi encontrado." -ForegroundColor Red
    Read-Host "Pressione Enter para fechar"
    exit 1
}

# Remove tarefa anterior se existir
try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop } catch {}

# Cria a tarefa: roda no login do usuario, em background, sem janela
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptToRun`"" `
    -WorkingDirectory $ProjectRoot

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Days 0) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Inicia API (3001) e Frontend (3000) do portal Troca de Itens automaticamente no login" | Out-Null

Write-Host "OK - Tarefa agendada criada com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "A partir de agora, ao ligar o PC e fazer login:" -ForegroundColor White
Write-Host "  - API sobe em http://localhost:3001" -ForegroundColor White
Write-Host "  - Frontend sobe em http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Iniciar agora sem precisar reiniciar?" -ForegroundColor Yellow
$r = Read-Host "[S/n]"
if ($r -eq "" -or $r -ieq "s" -or $r -ieq "y") {
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "Servidor iniciado em background." -ForegroundColor Green
    Write-Host "Aguarde ~5s e abra http://localhost:3000 no navegador." -ForegroundColor Green
}

Write-Host ""
Write-Host "Comandos uteis:" -ForegroundColor Cyan
Write-Host "  Ver status:    Get-ScheduledTask -TaskName $TaskName" -ForegroundColor DarkGray
Write-Host "  Parar:         Stop-ScheduledTask -TaskName $TaskName" -ForegroundColor DarkGray
Write-Host "  Iniciar:       Start-ScheduledTask -TaskName $TaskName" -ForegroundColor DarkGray
Write-Host "  Desinstalar:   .\instalar-autostart.ps1 -Remover" -ForegroundColor DarkGray
Write-Host ""
Read-Host "Pressione Enter para fechar"
