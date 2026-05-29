# Volta todos os pedidos para "Liberado para Separacao" e zera:
# - Divergencias e Trocas
# - Faltas e Apanho
# - Fluxo Distinto + historico
# - Separacao em andamento
# - Reservas de estoque
#
# Mantem: produtos, usuarios, locais, parceiros, ordens de carga, e a estrutura dos pedidos.
# Pre-requisito: API rodando em http://localhost:3001

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Resetando dados operacionais" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verifica se a API esta no ar
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -TimeoutSec 3
    Write-Host "[OK] API respondendo." -ForegroundColor Green
} catch {
    Write-Host "[ERRO] API nao esta no ar (http://localhost:3001)." -ForegroundColor Red
    Write-Host "Inicie com: .\iniciar-com-node22.ps1" -ForegroundColor Yellow
    Read-Host "Pressione Enter para fechar"
    exit 1
}
Write-Host ""

# 2. Confirmacao
Write-Host "Isso vai:" -ForegroundColor Yellow
Write-Host "  - Voltar TODOS os pedidos para 'Liberado para Separacao'" -ForegroundColor White
Write-Host "  - Apagar TODAS as divergencias e trocas" -ForegroundColor White
Write-Host "  - Apagar TODAS as faltas" -ForegroundColor White
Write-Host "  - Apagar TODOS os fluxos distintos + historico" -ForegroundColor White
Write-Host "  - Resetar progresso de separacao" -ForegroundColor White
Write-Host ""
Write-Host "Produtos, usuarios, locais e cadastro de pedidos sao mantidos." -ForegroundColor DarkGray
Write-Host ""
$resp = Read-Host "Confirma? [S/n]"
if ($resp -and $resp -ine "s" -and $resp -ine "y" -and $resp -ne "") {
    Write-Host "Cancelado." -ForegroundColor DarkGray
    exit 0
}
Write-Host ""

# 3. Chama o endpoint de reset
try {
    Write-Host "Chamando POST /api/_reset..." -ForegroundColor Yellow
    $r = Invoke-RestMethod -Uri "http://localhost:3001/api/_reset" -Method Post -ContentType "application/json"

    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host " $($r.mensagem)" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Estado pos-reset:" -ForegroundColor Cyan
    Write-Host "  Pedidos cadastrados:    $($r.contagens.pedidos)" -ForegroundColor White
    Write-Host "  Itens de pedido:        $($r.contagens.itens)" -ForegroundColor White
    Write-Host "  Divergencias abertas:   $($r.contagens.divergencias)" -ForegroundColor White
    Write-Host "  Faltas abertas:         $($r.contagens.faltas)" -ForegroundColor White
    Write-Host "  Fluxos distintos:       $($r.contagens.fluxos)" -ForegroundColor White
    Write-Host "  Separacoes em andam.:   $($r.contagens.separacoes)" -ForegroundColor White
    Write-Host ""
    Write-Host "Recarregue http://localhost:3000 para ver o estado inicial." -ForegroundColor Yellow
} catch {
    Write-Host "[ERRO] Reset falhou: $_" -ForegroundColor Red
}
Write-Host ""
Read-Host "Pressione Enter para fechar"
