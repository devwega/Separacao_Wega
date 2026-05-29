# Para todos os processos do dev server (API + Frontend)
# Uso: .\parar-tudo.ps1

Write-Host "Procurando processos nas portas 3000 e 3001..." -ForegroundColor Yellow

$matados = 0
foreach ($porta in 3000, 3001) {
    $conn = Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        foreach ($c in $conn) {
            $procId = $c.OwningProcess
            if ($procId -and $procId -gt 0) {
                try {
                    $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
                    if ($p) {
                        Write-Host "  Encerrando $($p.Name) (PID $procId, porta $porta)" -ForegroundColor DarkGray
                        Stop-Process -Id $procId -Force
                        $matados++
                    }
                } catch {}
            }
        }
    }
}

# Mata tambem qualquer processo node/pnpm filho que sobrou
Get-Process | Where-Object {
    ($_.Name -in @("node", "pnpm")) -and ($_.MainModule.FileName -like "*Sankhya*" -or $_.Path -like "*Sankhya*")
} 2>$null | ForEach-Object {
    Write-Host "  Encerrando $($_.Name) PID $($_.Id)" -ForegroundColor DarkGray
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    $matados++
}

if ($matados -eq 0) {
    Write-Host "Nenhum processo do dev server encontrado." -ForegroundColor Green
} else {
    Write-Host "$matados processo(s) encerrado(s)." -ForegroundColor Green
}
Read-Host "Pressione Enter para fechar"
