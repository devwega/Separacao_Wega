# Deploy no Vercel + Persistência (Turso/libSQL)

App full-stack: **frontend Vite/React** + **backend Express** com banco **libSQL** (`@libsql/client`).
- **Local/dev:** arquivo SQLite (`server/db/sankhya.sqlite`).
- **Produção (Vercel):** **Turso** quando as variáveis de ambiente estiverem definidas (persistente).
- **Fallback** no Vercel sem Turso: `/tmp` (efêmero — só para não quebrar o deploy).

## Arquivos de configuração
- `vercel.json` — `buildCommand: vite build`, saída `dist/public`, função serverless `api/index.ts`, rewrites `/api/*` + SPA.
- `api/index.ts` — embrulha o app Express; define `SCHEMA_PATH`.
- `server/db/index.ts` — cliente libSQL + fachada `.prepare().{get,all,run}` (async), `applySchema()`, `ensureReady()`.

## Persistência com Turso (passos manuais)
1. Crie conta e banco em https://turso.tech (ex.: database `separacao-wega`).
2. Obtenha a **Database URL** (`libsql://...`) e um **Auth Token**.
3. No Vercel → **Settings → Environment Variables** (Production e Preview):
   - `TURSO_DATABASE_URL` = `libsql://...`
   - `TURSO_AUTH_TOKEN` = `<token>`
4. **Redeploy**. No primeiro acesso, `ensureReady()` aplica o schema e roda o seed automaticamente no Turso.
   A partir daí os dados **persistem** entre cold starts.

## Resetar / popular o banco manualmente
Rode localmente apontando para o Turso (ou sem as envs para usar o arquivo local):

```bash
# zera tudo e repõe o baseline limpo (pedidos sem separação)
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... pnpm db:reset

# só popula se estiver vazio
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... pnpm db:seed
```

Em produção também há `POST /api/_reset` (zera dados operacionais e volta os pedidos para "Liberado/Não iniciado").

## Settings do Vercel
- Framework Preset: **Other** (deixe o `vercel.json` mandar).
- Root Directory: raiz do repo. Node.js: 22.x (fixado em `engines`).

## Observações
- O dialeto é SQLite (libSQL), então `schema.sql` e as queries continuam iguais.
- `PRAGMA` é removido ao aplicar o schema (Turso já aplica FKs).
