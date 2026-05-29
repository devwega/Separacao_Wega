# Brainstorm de Design - Layouts Troca de Itens Sankhya

## Contexto
Sistema operacional interno para gestão de separação, trocas, faltas e faturamento no Sankhya. Público-alvo: operadores de estoque, comercial, compras, supervisores e faturamento. Necessidade de clareza, eficiência e hierarquia visual forte para tomada de decisão rápida.

---

<response>
<text>

## Ideia 1 — "Industrial Dashboard" (Design Funcionalista Operacional)

**Design Movement**: Inspirado no design de interfaces industriais e painéis de controle SCADA, com influência do Brutalism funcional aplicado a dashboards operacionais.

**Core Principles**:
1. Densidade informacional controlada — máximo de dados visíveis sem scroll desnecessário
2. Hierarquia por contraste cromático — status e alertas comunicam-se por cor, não por tamanho
3. Eficiência de clique — ações primárias sempre a 1 clique de distância
4. Legibilidade em ambientes de galpão — fontes grandes, contrastes fortes

**Color Philosophy**: Fundo cinza escuro (slate-900) com cards em slate-800, texto em slate-100. Cores de status como linguagem primária: verde-esmeralda para conforme, âmbar para pendência, vermelho-coral para bloqueio, azul-ciano para informativo. A paleta escura reduz fadiga visual em turnos longos de operação.

**Layout Paradigm**: Grid denso com sidebar fixa à esquerda para navegação entre telas. Área principal dividida em painéis redimensionáveis. Tabelas ocupam 70% do viewport. Filtros em barra horizontal superior compacta.

**Signature Elements**:
1. Status pills com glow sutil indicando urgência
2. Mini-sparklines inline nas tabelas mostrando tendência de faltas
3. Barra de progresso do pedido como timeline horizontal no topo de cada detalhe

**Interaction Philosophy**: Hover revela ações contextuais. Double-click abre detalhe inline (sem modal). Drag para reordenar prioridade de pedidos.

**Animation**: Transições mínimas (120ms). Fade-in para dados carregados. Pulse sutil em alertas críticos. Sem animações decorativas — cada movimento tem propósito funcional.

**Typography System**: JetBrains Mono para códigos/EAN/lotes. IBM Plex Sans para textos e labels. Pesos 400/500/700. Tamanho base 14px para tabelas, 16px para formulários.

</text>
<probability>0.06</probability>
</response>

---

<response>
<text>

## Ideia 2 — "Clean Enterprise" (Design Corporativo Moderno)

**Design Movement**: Enterprise SaaS moderno inspirado em Notion, Linear e Stripe Dashboard. Minimalismo funcional com toques de sofisticação.

**Core Principles**:
1. Clareza acima de tudo — cada elemento tem propósito claro e espaço para respirar
2. Consistência de padrões — mesmos componentes reutilizados em todas as telas
3. Navegação previsível — sidebar persistente com breadcrumbs contextuais
4. Feedback visual imediato — cada ação do usuário gera resposta visual clara

**Color Philosophy**: Fundo branco com leve tom quente (stone-50). Azul institucional como cor primária para ações e navegação ativa. Cinza neutro para textos secundários. Sistema de badges coloridos para status: verde-sage para conforme, amarelo-mostarda para atenção, vermelho-terracota para bloqueio, roxo-lavanda para fluxo distinto. A paleta clara transmite profissionalismo e confiança.

**Layout Paradigm**: Sidebar colapsável à esquerda com ícones + labels. Área de conteúdo com max-width de 1280px centralizado. Cards com sombras suaves agrupam informações relacionadas. Tabelas com linhas alternadas e headers sticky. Formulários em layout de 2 colunas com labels acima dos campos.

**Signature Elements**:
1. Breadcrumb trail mostrando contexto do pedido em todas as telas
2. Summary cards no topo de cada tela com KPIs relevantes (total itens, pendências, % conclusão)
3. Timeline vertical do pedido como componente lateral reutilizável

**Interaction Philosophy**: Hover com elevação sutil em cards. Modais para confirmações críticas (aprovar/reprovar). Toasts para feedback de ações. Filtros como chips removíveis.

**Animation**: Ease-out suave (200ms) para transições de página. Stagger de 40ms em listas. Scale(0.98) em botões ao clicar. Skeleton loading para dados assíncronos.

**Typography System**: DM Sans para headings (600/700). Inter para body text (400/500). Tamanho base 14px para tabelas, 15px para body, 24-32px para títulos de página.

</text>
<probability>0.08</probability>
</response>

---

<response>
<text>

## Ideia 3 — "Operational Command Center" (Centro de Comando Operacional)

**Design Movement**: Inspirado em interfaces de centros de controle logístico e mission control, com influência de design de aviação (glass cockpit) adaptado para web.

**Core Principles**:
1. Visão panorâmica — dashboards que mostram o estado geral antes do detalhe
2. Codificação visual por urgência — a interface "grita" o que precisa de atenção
3. Fluxo de trabalho guiado — wizard-like para processos sequenciais (separação)
4. Zero ambiguidade — labels explícitos, tooltips contextuais, confirmações claras

**Color Philosophy**: Fundo slate-950 quase preto com cards em slate-900/800. Azul-elétrico como cor de destaque primária. Sistema de alertas com gradiente de urgência: verde-neon para OK, amarelo-elétrico para atenção, laranja para urgente, vermelho-vivo para crítico. Bordas sutis em slate-700 delimitam zonas. A estética escura evoca ambiente de controle 24/7.

**Layout Paradigm**: Layout full-viewport sem scroll na visão principal. Sidebar estreita com ícones à esquerda. Área principal com grid de 12 colunas. Painéis de resumo no topo (20% altura). Tabela/lista principal no centro (60%). Painel de ações/detalhes na base ou lateral direita (20%).

**Signature Elements**:
1. Indicador de urgência pulsante nos pedidos com prazo crítico
2. Mapa de calor visual na lista de pedidos (faixa colorida lateral indicando criticidade)
3. Painel de ações flutuante que acompanha o item selecionado

**Interaction Philosophy**: Seleção por clique único revela painel de detalhes lateral. Ações rápidas via menu de contexto (right-click). Atalhos de teclado para operações frequentes. Confirmação em 2 etapas para ações irreversíveis.

**Animation**: Transições rápidas (150ms). Glow pulse em elementos críticos. Slide-in para painéis laterais. Contadores animados nos KPIs. Reduzido em prefers-reduced-motion.

**Typography System**: Space Grotesk para headings (500/700). Geist Sans para body (400/500). Monospace (Geist Mono) para códigos e EAN. Tamanho base 13px para dados densos, 15px para labels, 20-28px para títulos.

</text>
<probability>0.04</probability>
</response>

---

## Decisão

Escolho a **Ideia 2 — "Clean Enterprise"** por ser a mais adequada ao contexto:
- Sistema interno corporativo que precisa ser acessível a diferentes perfis de usuário
- Paleta clara e profissional alinhada ao uso institucional (azul como cor principal conforme preferência)
- Padrões de UI reconhecíveis que reduzem curva de aprendizado
- Boa legibilidade e hierarquia visual para tomada de decisão
- Componentes reutilizáveis que facilitam o desenvolvimento real no Sankhya
