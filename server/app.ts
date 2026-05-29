import "express-async-errors";
import express from "express";
import { getDb, getClient, ensureReady } from "./db/index.js";
import { requireAuth } from "./auth.js";
import authRoutes from "./routes/auth.js";
import pedidos from "./routes/pedidos.js";
import bipagem from "./routes/bipagem.js";
import divergencias from "./routes/divergencias.js";
import faltas from "./routes/faltas.js";
import fluxoDistinto from "./routes/fluxo-distinto.js";
import preFaturamento from "./routes/pre-faturamento.js";

export function createApiApp() {
  const app = express();
  app.use(express.json());

  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
    next();
  });
  app.options("*", (_req, res) => res.sendStatus(200));

  // Garante schema + seed aplicados antes de qualquer rota (cold start serverless).
  app.use(async (_req, _res, next) => {
    try { await ensureReady(); next(); } catch (e) { next(e); }
  });

  // Publicos
  app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));
  app.use("/api/auth", authRoutes); // /login e publico; /me e /usuarios sao protegidos internamente

  // A partir daqui, exige autenticacao
  app.use(requireAuth);

  // POST /api/_reset — zera dados operacionais e volta pedidos para "Liberado/Nao iniciado".
  app.post("/api/_reset", async (_req, res) => {
    const c = getClient();
    await c.batch([
      "DELETE FROM AD_FLUXOHIST",
      "DELETE FROM AD_FLUXODISTINTO",
      "DELETE FROM AD_FALTAITEM",
      "DELETE FROM AD_TROCAITEM",
      "DELETE FROM AD_SEPARACAO",
      `UPDATE TGFITE SET QTDENTREGUE = 0, QTDCONFERIDA = 0, PENDENTE = 'S', CONTROLE = '', STATUSLOTE = 'A'`,
      `UPDATE TGFCAB SET STATUSNOTA = 'L', AD_STATUSSEP = 'NAO_INICIADO', AD_PERCPROGRESSO = 0,
              AD_DTINICIOSEP = NULL, AD_DTFIMSEP = NULL, AD_CODUSUSEP = NULL, DTFATUR = NULL`,
      "UPDATE TGFEST SET RESERVADO = 0",
    ], "write");

    const cnt = await getDb().prepare(`
      SELECT
        (SELECT COUNT(*) FROM TGFCAB) AS pedidos,
        (SELECT COUNT(*) FROM TGFITE) AS itens,
        (SELECT COUNT(*) FROM AD_TROCAITEM) AS divergencias,
        (SELECT COUNT(*) FROM AD_FALTAITEM) AS faltas,
        (SELECT COUNT(*) FROM AD_FLUXODISTINTO) AS fluxos,
        (SELECT COUNT(*) FROM AD_SEPARACAO) AS separacoes
    `).get();

    res.json({
      status: "ok",
      mensagem: "Todos os pedidos voltaram para 'Liberado para Separacao' e telas operacionais zeradas.",
      contagens: cnt,
    });
  });

  app.get("/api/_debug", async (_req, res) => {
    const db = getDb();
    const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as any[];
    const counts: Record<string, number> = {};
    for (const t of tables) {
      try {
        const r = await db.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get() as any;
        counts[t.name] = r.c;
      } catch { counts[t.name] = -1; }
    }
    res.json({ status: "ok", tables: tables.map((t) => t.name), counts });
  });

  app.use("/api/pedidos", pedidos);
  app.use("/api/bipagem", bipagem);
  app.use("/api/divergencias", divergencias);
  app.use("/api/faltas", faltas);
  app.use("/api/fluxo-distinto", fluxoDistinto);
  app.use("/api/pre-faturamento", preFaturamento);

  // Middleware global de erro
  app.use((err: any, req: any, res: any, _next: any) => {
    console.error(`\n[API ERROR] ${req.method} ${req.url}`);
    console.error(err?.stack || err);
    res.status(500).json({ error: err?.message || "Erro interno", code: err?.code, path: req.url });
  });

  return app;
}
