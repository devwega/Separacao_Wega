// Entrypoint serverless do Vercel.
// Envolve o app Express existente (server/app.ts) e o expoe como Serverless Function.
// Todas as rotas /api/* sao redirecionadas para ca via vercel.json.
import path from "node:path";
import { createApiApp } from "../server/app.js";

// No Vercel o unico diretorio gravavel e /tmp.
process.env.NODE_ENV = process.env.NODE_ENV || "production";
if (!process.env.DB_PATH) {
  process.env.DB_PATH = "/tmp/sankhya.sqlite";
}
// Depois do empacotamento o __dirname do db/index.ts nao aponta mais para a pasta
// original do schema; os arquivos incluidos via vercel.json ficam relativos ao cwd.
if (!process.env.SCHEMA_PATH) {
  process.env.SCHEMA_PATH = path.join(process.cwd(), "server", "db", "schema.sql");
}

// O app Express e, ele proprio, um handler (req, res) compativel com o runtime Node do Vercel.
const app = createApiApp();

export default app;
