# Portal de Troca de Itens — Backend SQLite + API

Integração das 6 telas do portal com um banco SQLite que **espelha as tabelas do Sankhya Om 4.35b647** descritas em `docs/Mapeamento_de_Tabelas_Sankhya_Om_4.35b647.docx`.

## Como subir o ambiente local

```powershell
cd C:\Sankhya\layout-troca-itens-sankhya

# 1. Instalar as novas dependências (better-sqlite3 + concurrently)
pnpm install

# 2. Subir API (porta 3001) e frontend (porta 3000) juntos
pnpm dev:full
```

Abrir no navegador: **http://localhost:3000**

O Vite faz proxy automático de `/api/*` → `localhost:3001`, então o frontend pode usar URLs relativas (`/api/pedidos`).

### Comandos disponíveis

| Comando | Descrição |
|---|---|
| `pnpm dev:full` | API + frontend em paralelo (recomendado) |
| `pnpm dev` | Só o frontend (vite) |
| `pnpm dev:api` | Só a API (tsx watch) |
| `pnpm db:seed` | Popula o banco (idempotente) |
| `pnpm db:reset` | Apaga o `.sqlite` e recria do zero |

## Arquitetura

```
server/
├── db/
│   ├── schema.sql          ← 16 tabelas (12 Sankhya + 4 AD_*)
│   ├── index.ts            ← Conexão better-sqlite3
│   ├── seed.ts             ← Dados (idempotente)
│   └── sankhya.sqlite      ← Banco (gerado, não commitar)
├── routes/
│   ├── pedidos.ts          ← Tela 1
│   ├── bipagem.ts          ← Tela 2 (incluindo validação de EAN)
│   ├── divergencias.ts     ← Tela 3
│   ├── faltas.ts           ← Tela 4
│   ├── fluxo-distinto.ts   ← Tela 5 (com regra Supervisor/Gerente)
│   └── pre-faturamento.ts  ← Tela 6 (com regra de liberação)
├── app.ts                  ← createApiApp() — monta tudo
└── index.ts                ← Bootstrap (porta 3001)

client/src/
├── lib/api.ts              ← axios + types compartilhados
├── hooks/use-fetch.ts      ← Hook simples de fetch
└── pages/*.tsx             ← Cada page consome useFetch<Tipo>("/rota")
```

## Endpoints

| Método | Rota | Tela |
|---|---|---|
| GET  | `/api/health` | health check |
| GET  | `/api/pedidos?status=&embarcacao=&prioridade=&q=` | 1 — listagem |
| GET  | `/api/pedidos/summary` | 1 — summary cards |
| GET  | `/api/pedidos/:nunota` | 1, 2 — detalhe + itens |
| POST | `/api/bipagem/validar-ean` | 2 — `{nunota, sequencia, ean}` |
| PUT  | `/api/bipagem/conferir` | 2 — `{nunota, sequencia, qtdSeparada, lote, validade}` |
| GET  | `/api/bipagem/saldo/:codprod` | 2 — saldo de estoque |
| GET  | `/api/divergencias?tipo=&status=&q=` | 3 |
| GET  | `/api/divergencias/summary` | 3 |
| POST | `/api/divergencias/:id/decidir` | 3 — `{acao: 'APROVAR'\|'REPROVAR'}` |
| GET  | `/api/faltas?criticidade=&tipo=&acao=&q=` | 4 |
| GET  | `/api/faltas/summary` | 4 |
| POST | `/api/faltas/:id/acao` | 4 — `{acao, prazoRetorno?}` |
| GET  | `/api/fluxo-distinto` | 5 |
| POST | `/api/fluxo-distinto/:id/decidir` | 5 — `{acao, codusu}` (valida perfil) |
| GET  | `/api/pre-faturamento/:nunota` | 6 |
| POST | `/api/pre-faturamento/:nunota/liberar` | 6 — bloqueia se houver pendências |

## Mapeamento Sankhya → SQLite

Todas as tabelas seguem **fielmente** o doc de mapeamento:

**Nativas:** `TGFCAB`, `TGFITE`, `TGFTOP`, `TGFPRO`, `TGFBAR`, `TGFGRU`, `TGFEST`, `TGFLOC`, `TGFORD`, `TGFPAR`, `TGFVEN`, `TSIUSU`

**Customizadas (AD_):** `AD_SEPARACAO`, `AD_TROCAITEM`, `AD_FALTAITEM`, `AD_FLUXODISTINTO` + `AD_FLUXOHIST` (histórico do fluxo distinto)

**Campos customizados na TGFCAB:** `AD_PRIORIDADE`, `AD_STATUSSEP`, `AD_DTINICIOSEP`, `AD_DTFIMSEP`, `AD_CODUSUSEP`, `AD_PERCPROGRESSO`

### Diferenças de SQLite vs Oracle

- `NUMBER` → `INTEGER` / `REAL`
- `VARCHAR2` → `TEXT`
- `DATE DEFAULT SYSDATE` → `TEXT DEFAULT (datetime('now', 'localtime'))`
- `SEQUENCE NUMBER` → `INTEGER PRIMARY KEY AUTOINCREMENT`
- Datas armazenadas como ISO 8601 (`YYYY-MM-DD HH:MM:SS`)
- Sem PL/SQL — toda lógica de negócio fica em TypeScript

Quando migrar pro Sankhya real, os SQLs dos `routes/*.ts` precisam ser ajustados pra Oracle (sintaxe `julianday()`, `printf()`, `IF EXISTS` etc.).

## Migração para o Sankhya real

A camada de rotas Express está desenhada para ser **substituída** pelas chamadas reais à API de serviços do Sankhya (`CRUDServiceProvider.loadRecords`, `MobileLoginSP.login`).

Cada rota tem um SQL claro que documenta os JOINs necessários — basta traduzir para a chamada `loadRecords` correspondente.

## Pages que consomem cada endpoint

| Page | Endpoint primário |
|---|---|
| `PedidosLiberados.tsx` | `GET /api/pedidos` + `/summary` |
| `BipeSeparacao.tsx`, `BipeMobile.tsx` | `GET /api/pedidos/187` |
| `DivergenciasTrocas.tsx` | `GET /api/divergencias` + `/summary` |
| `FaltasApanho.tsx` | `GET /api/faltas` + `/summary` |
| `FluxoDistinto.tsx` | `GET /api/fluxo-distinto` |
| `PreFaturamento.tsx` | `GET /api/pre-faturamento/190` |

Todas as pages mantêm fallback aos mocks originais caso a API esteja offline — então o build do frontend continua funcionando sozinho.
