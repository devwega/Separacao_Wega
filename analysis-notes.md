# Análise da Especificação - Telas Identificadas

## 6 Telas a Prototipar

### 9.1 Painel de Pedidos Liberados para Separação
- **Objetivo**: Listar pedidos liberados e priorizar operação do estoque
- **Usuários**: Estoque e liderança operacional
- **Info**: pedido, cliente, embarcação, horário carregamento, status, itens, alertas validade, pendências
- **Ações**: iniciar separação, retomar separação, visualizar pendências

### 9.2 Tela BIPE de Separação
- **Objetivo**: Registrar execução física da separação item a item
- **Usuários**: Separador
- **Campos**: item pedido, EAN esperado, campo bipagem, lote, validade, qtd separada, qtd faltante, saldo reservado
- **Validações**: EAN, lote, validade, shelf life, equivalência, fator conversão
- **Ações**: confirmar item conforme, registrar divergência, registrar falta, concluir item

### 9.3 Tela de Divergências e Trocas
- **Objetivo**: Consolidar itens divergentes para decisão comercial
- **Usuários**: Comercial
- **Info**: item original, item separado, tipo divergência, homologação marca, necessidade ação cliente, qtd equivalente, motivo
- **Ações**: aprovar, reprovar, registrar info ao cliente, registrar aprovação cliente, encaminhar gestor

### 9.4 Tela de Faltas e Apanho
- **Objetivo**: Tratar indisponibilidades com foco no prazo do pedido
- **Usuários**: Compras e comercial
- **Info**: item faltante, qtd, embarcação, horário carregamento, criticidade, ação proposta, prazo retorno
- **Ações**: compra padrão, apanho, corte, informar previsão, devolver ao comercial

### 9.5 Tela de Aprovação Gerencial de Fluxo Distinto
- **Objetivo**: Controlar exceções item físico ≠ item fiscal
- **Usuários**: Supervisor ou gerente
- **Info**: item pedido/NF, item físico, justificativa, histórico, impacto operacional
- **Ações**: aprovar, reprovar, devolver para ajuste
- **Validações**: perfil gestor obrigatório, justificativa obrigatória

### 9.6 Tela Final de Conferência Pré-Faturamento
- **Objetivo**: Consolidar resultado final do pedido antes da NF
- **Usuários**: Comercial e faturamento
- **Info**: itens conformes, itens substituídos, faltas, itens fluxo distinto, pendências impeditivas
- **Ações**: liberar faturamento, bloquear faturamento, devolver para ajuste

## Status do Pedido (8 estados)
Lançado → Liberado para separação → Em separação → Aguardando decisão comercial / Com falta em análise → Aprovado com alteração / Reprovado / Aprovado em fluxo distinto → Liberado para faturamento → Faturado

## Perfis de Usuário
- Separador
- Comercial
- Compras
- Supervisor/Gerente
- Faturamento
