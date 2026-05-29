import { Router } from "express";
import { getDb } from "../db/index.js";
import { requirePerfil } from "../auth.js";

const router = Router();
const GESTOR = ["ADMINISTRADOR", "GERENCIA"] as const;
const CHAVE_GLOBAL = "VALIDADE_MIN_GLOBAL";
const DEFAULT_GLOBAL = 30;

async function getGlobal(): Promise<number> {
  const r = await getDb().prepare("SELECT VALOR FROM AD_PARAM WHERE CHAVE=?").get(CHAVE_GLOBAL) as any;
  return r ? Number(r.VALOR) : DEFAULT_GLOBAL;
}

/** GET /api/validade-minima?q= — lista parceiros (clientes) + dias min e o padrao global */
router.get("/", async (req, res) => {
  const db = getDb();
  const { q } = req.query;
  const wheres = ["P.TIPO = 'CLIENTE'"];
  const params: any[] = [];
  if (q) { wheres.push("(P.NOMEPARC LIKE ? OR CAST(P.CODPARC AS TEXT) LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
  const parceiros = await db.prepare(`
    SELECT P.CODPARC AS codparc, P.NOMEPARC AS parceiro,
           V.DIASMIN AS diasMin, V.DTALTERACAO AS dtAlteracao, U.NOMEUSU AS usuario
    FROM TGFPAR P
    LEFT JOIN AD_VALIDADEMIN V ON V.CODPARC = P.CODPARC
    LEFT JOIN TSIUSU U ON U.CODUSU = V.CODUSU
    WHERE ${wheres.join(" AND ")}
    ORDER BY P.NOMEPARC
  `).all(...params);
  res.json({ global: await getGlobal(), parceiros });
});

router.get("/global", async (_req, res) => res.json({ dias: await getGlobal() }));

router.put("/global", requirePerfil(...GESTOR), async (req, res) => {
  const dias = Number((req.body ?? {}).dias);
  if (!Number.isFinite(dias) || dias < 0) { res.status(400).json({ error: "Informe um numero de dias valido" }); return; }
  const u = (req as any).user;
  await getDb().prepare(
    "INSERT OR REPLACE INTO AD_PARAM (CHAVE, VALOR, DTALTERACAO, CODUSU) VALUES (?, ?, datetime('now','localtime'), ?)",
  ).run(CHAVE_GLOBAL, String(dias), u?.codusu ?? null);
  res.json({ ok: true, dias });
});

router.put("/:codparc", requirePerfil(...GESTOR), async (req, res) => {
  const codparc = Number(req.params.codparc);
  const dias = Number((req.body ?? {}).dias);
  if (!Number.isFinite(dias) || dias < 0) { res.status(400).json({ error: "Informe um numero de dias valido" }); return; }
  const db = getDb();
  const ex = await db.prepare("SELECT 1 FROM TGFPAR WHERE CODPARC=?").get(codparc);
  if (!ex) { res.status(404).json({ error: "Parceiro nao encontrado" }); return; }
  const u = (req as any).user;
  await db.prepare(
    "INSERT OR REPLACE INTO AD_VALIDADEMIN (CODPARC, DIASMIN, DTALTERACAO, CODUSU) VALUES (?, ?, datetime('now','localtime'), ?)",
  ).run(codparc, dias, u?.codusu ?? null);
  await db.prepare(
    "INSERT INTO AD_VALIDADEMIN_HIST (CODPARC, DIASMIN, DTALTERACAO, CODUSU) VALUES (?, ?, datetime('now','localtime'), ?)",
  ).run(codparc, dias, u?.codusu ?? null);
  res.json({ ok: true });
});

router.delete("/:codparc", requirePerfil(...GESTOR), async (req, res) => {
  await getDb().prepare("DELETE FROM AD_VALIDADEMIN WHERE CODPARC=?").run(Number(req.params.codparc));
  res.json({ ok: true });
});

router.get("/:codparc/historico", async (req, res) => {
  const rows = await getDb().prepare(`
    SELECT H.DIASMIN AS diasMin, H.DTALTERACAO AS data, U.NOMEUSU AS usuario
    FROM AD_VALIDADEMIN_HIST H LEFT JOIN TSIUSU U ON U.CODUSU = H.CODUSU
    WHERE H.CODPARC = ? ORDER BY H.NUHIST DESC
  `).all(Number(req.params.codparc));
  res.json(rows);
});

export default router;
