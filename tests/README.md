# Ambiente de Testes — layout-troca-itens-sankhya

Ambiente de testes do protótipo de **Troca de Itens (Sankhya ERP)**.
Cobre dois níveis:

| Nível | Ferramenta | O que testa | Onde fica |
| --- | --- | --- | --- |
| Unitário / componente | **Vitest + Testing Library + jsdom** | utilitários, componentes isolados, páginas (render) | `tests/unit/` |
| End-to-end | **Playwright** | navegação, fluxos de tela inteiros no navegador real | `tests/e2e/` |

> Nenhuma tela existente foi modificada. Todo o ambiente é aditivo (configurações + arquivos de teste novos).

---

## 📁 Estrutura

```
tests/
├── README.md                       ← este arquivo
├── unit/
│   ├── setup.ts                    ← jest-dom + stubs (matchMedia, ResizeObserver, IntersectionObserver)
│   ├── lib/
│   │   └── utils.test.ts           ← testa cn() (clsx + tailwind-merge)
│   ├── components/
│   │   ├── StatusBadge.test.tsx
│   │   └── SummaryCard.test.tsx
│   └── pages/
│       └── PedidosLiberados.test.tsx
└── e2e/
    ├── fixtures.ts                 ← helpers e mapa de rotas
    ├── smoke.spec.ts               ← carregamento básico e fallback 404
    ├── navigation.spec.ts          ← sidebar e rotas
    ├── pedidos-liberados.spec.ts   ← tela 9.1
    ├── telas-funcionais.spec.ts    ← telas 9.2 a 9.6 (smoke por tela)
    └── mobile/
        └── bipe-mobile.spec.ts     ← rota /bipe-mobile (iPhone 13 viewport)
```

Arquivos de configuração na raiz:
- `vitest.config.ts` — config dos unit tests (separado do `vite.config.ts` para não afetar a build da UI)
- `playwright.config.ts` — config E2E, sobe `pnpm dev` automaticamente
- `tsconfig.test.json` — tipos para os testes (não substitui o `tsconfig.json` da app)

---

## 🚀 Como instalar e rodar

As dependências já estão no `package.json` em `devDependencies` mas ainda **não foram instaladas**. Primeiro:

```bash
pnpm install
# Para o Playwright também é necessário baixar os browsers:
pnpm exec playwright install
```

### Testes unitários (Vitest)

```bash
pnpm test                # modo watch
pnpm test:run            # roda uma vez (uso em CI)
pnpm test:ui             # abre UI interativa do Vitest
pnpm test:coverage       # gera relatório de cobertura em ./coverage/
```

### Testes E2E (Playwright)

```bash
pnpm test:e2e            # roda headless
pnpm test:e2e:headed     # abre os navegadores
pnpm test:e2e:ui         # UI interativa do Playwright
pnpm test:e2e:report     # abre o último HTML report
```

O `playwright.config.ts` já tem `webServer` configurado para subir o dev server (`pnpm dev`) automaticamente em `http://localhost:3000`. Se quiser apontar para outra URL:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:5173 pnpm test:e2e
```

---

## ✏️ Escrevendo novos testes

### Unit — componente React

```tsx
// tests/unit/components/MeuComp.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MeuComp from "@/components/MeuComp";

describe("<MeuComp />", () => {
  it("renderiza o label", () => {
    render(<MeuComp label="oi" />);
    expect(screen.getByText("oi")).toBeInTheDocument();
  });
});
```

> Componentes que usam `<Tooltip>` precisam ser envolvidos em `<TooltipProvider>` no teste (ver `PedidosLiberados.test.tsx` como exemplo).

### E2E — fluxo de tela

```ts
// tests/e2e/minha-tela.spec.ts
import { expect, test } from "./fixtures";

test("nova tela carrega", async ({ page }) => {
  await page.goto("/minha-rota");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
```

---

## 🧭 Mapa de telas testadas

| Rota | Tela | Cobertura |
| --- | --- | --- |
| `/` | 9.1 Pedidos Liberados | unit (página) + E2E (`pedidos-liberados.spec.ts`) |
| `/bipe` | 9.2 BIPE Separação | E2E (`telas-funcionais.spec.ts`) |
| `/divergencias` | 9.3 Divergências e Trocas | E2E (smoke) |
| `/faltas` | 9.4 Faltas e Apanho | E2E (smoke) |
| `/fluxo-distinto` | 9.5 Fluxo Distinto | E2E (smoke) |
| `/pre-faturamento` | 9.6 Pré-Faturamento | E2E (smoke) |
| `/bipe-mobile` | BIPE Mobile (fullscreen) | E2E mobile (iPhone 13) |

---

## 🔒 Garantias de não-regressão

- ✅ `vite.config.ts` **não foi modificado** — a build da UI continua idêntica.
- ✅ `tsconfig.json` **não foi modificado** — o `check` script segue funcionando.
- ✅ Nenhum arquivo em `client/src/` foi alterado — só lidos.
- ✅ Os testes só **renderizam** os componentes; não fazem mocks que modifiquem comportamento de produção.
