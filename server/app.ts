import express from "express";
import { getDb } from "./db/index.js";
import { seed, seedDemoStatusVariants } from "./db/seed.js";
import pedidos from "./routes/pedidos.js";
import bipagem from "./routes/bipagem.js";
import divergencias from "./routes/divergencias.js";
import faltas from "./routes/faltas.js";
import fluxoDistinto from "./routes/fluxo-distinto.js";
import preFaturamento from "./routes/pre-faturamento.js";

export function createApiApp() {
  getDb();
  seed();
  seedDemoStatusVariants();

  const app = express();
  app.use(express.json());

  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
  });
  app.options("*", (_req, res) => res.sendStatus(200));

  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", ts: new Date().toISOString() }),
  );

  // POST /api/_reset
  // Zera todos os dados operacionais e volta os pedidos para "Liberado para Separacao".
  // Mantem: produtos, usuarios, locais, estoque, parceiros, ordens de carga, pedidos (cabec e itens).
  // Limpa:  divergencias, faltas, fluxos distintos, historico, separacao em andamento.
  app.post("/api/_reset", (_req, res) => {
    try {
      const db = getDb();
      const tx = db.transaction(() => {
        // 1) Limpa tabelas operacionais
        db.exec("DELETE FROM AD_FLUXOHIST");
        db.exec("DELETE FROM AD_FLUXODISTINTO");
        db.exec("DELETE FROM AD_FALTAITEM");
        db.exec("DELETE FROM AD_TROCAITEM");
        db.exec("DELETE FROM AD_SEPARACAO");

        // 2) Reseta itens: zera quantidades entregues, marca pendente novamente
        db.exec(`
          UPDATE TGFITE
             SET QTDENTREGUE = 0,
                 QTDCONFERIDA = 0,
                 PENDENTE = 'S',
                 CONTROLE = '',
                 STATUSLOTE = 'A'
        `);

        // 3) Reseta cabecalho dos pedidos: volta status para 'Liberado'
        db.exec(`
          UPDATE TGFCAB
             SET STATUSNOTA = 'L',
                 AD_STATUSSEP = 'NAO_INICIADO',
                 AD_PERCPROGRESSO = 0,
                 AD_DTINICIOSEP = NULL,
                 AD_DTFIMSEP = NULL,
                 AD_CODUSUSEP = NULL,
                 DTFATUR = NULL
        `);

        // 4) Libera reservas de estoque (zera campo RESERVADO)
        db.exec("UPDATE TGFEST SET RESERVADO = 0");
      });
      tx();

      // Conta pedidos pos-reset para confirmar
      const cnt = db.prepare(`
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
    } catch (e: any) {
      console.error("[POST /api/_reset] ERRO:", e?.message, e?.stack);
      res.status(500).json({ error: e?.message });
    }
  });

  // Endpoint de diagnostico
  app.get("/api/_debug", (_req, res) => {
    try {
      const db = getDb();
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      ).all() as any[];
      const counts: Record<string, number> = {};
      for (const t of tables) {
        try {
          const r = db.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get() as any;
          counts[t.name] = r.c;
        } catch {
          counts[t.name] = -1;
        }
      }
      res.json({ status: "ok", tables: tables.map((t) => t.name), counts });
    } catch (e: any) {
      res.status(500).json({ error: e?.message, stack: e?.stack });
    }
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
    res.status(500).json({
      error: err?.message || "Erro interno",
      code: err?.code,
      path: req.url,
    });
  });

  return app;
}
