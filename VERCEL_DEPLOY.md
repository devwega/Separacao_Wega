# Deploy no Vercel

Este projeto é full-stack: **frontend Vite/React** + **backend Express** com banco **SQLite (better-sqlite3)**.
Os arquivos `vercel.json` e `api/index.ts` configuram o deploy no Vercel.

## Como funciona a configuração

- `vercel.json`
  - `buildCommand: vite build` — builda só o frontend (saída em `dist/public`).
  - `outputDirectory: dist/public` — arquivos estáticos servidos pelo CDN do Vercel.
  - `functions` — empacota `api/index.ts` como Serverless Function e inclui `server/db/schema.sql`.
  - `rewrites` — `/api/*` vai para a função; qualquer outra rota cai no `index.html` (SPA).
- `api/index.ts` — importa o app Express (`server/app.ts`) e o expõe como função serverless. Define `DB_PATH=/tmp/sankhya.sqlite` e `SCHEMA_PATH` automaticamente.

## Settings a conferir no painel do Vercel

1. **Framework Preset:** `Other` (deixe o `vercel.json` no comando, não sobrescreva Build/Output no painel).
2. **Root Directory:** raiz do repositório (`./`).
3. **Install Command:** automático (o `pnpm-lock.yaml` faz o Vercel usar pnpm).
4. **Node.js Version:** 22.x (já fixado em `engines` no `package.json`).
5. **Environment Variables:** nenhuma obrigatória. Opcionais:
   - `DB_PATH` — caminho do SQLite (padrão `/tmp/sankhya.sqlite`).
   - As `VITE_*` que o frontend usa (Google Maps etc.), se aplicável, em *Production/Preview*.

Depois de conferir, faça **Redeploy**.

## ⚠️ Limitação importante: SQLite em serverless

No Vercel o filesystem é efêmero (só `/tmp` é gravável, e some entre cold starts).
O banco é recriado e populado (schema + seed) a cada início de função. Consequências:

- Leitura funciona (dados do seed).
- **Escritas não persistem** entre requisições/instâncias — bom para demo, não para produção.

### Para produção
Migrar o `better-sqlite3` para um banco gerenciado, por exemplo **Vercel Postgres / Neon**,
ajustando `server/db/index.ts` e as queries. Posso fazer essa migração quando quiser.

## Pontos de atenção que podem quebrar o build

- **better-sqlite3 (módulo nativo):** o Vercel precisa compilar/baixar o binário no build (Linux).
  Normalmente funciona via pnpm + `onlyBuiltDependencies`. Se a função falhar com erro de binário
  `.node`, é aqui que olhamos primeiro (logs do deploy).
- Se o build do frontend falhar, verifique se as devDependencies de build (plugins do Vite) foram instaladas.
