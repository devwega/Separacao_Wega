import { Router } from "express";
import { getDb } from "../db/index.js";

const router = Router();

/**
 * GET /api/divergencias
 * Tela 3 — Divergências e Trocas
 */
router.get("/", async (req, res) => {
  const db = getDb();
  const { tipo, status, q } = req.query;
  const wheres: string[] = ["1=1"];
  const params: any[] = [];

  if (status && status !== "todos") {
    wheres.push("LOWER(T.STATUS) = ?");
    params.push(String(status).toLowerCase());
  }
  if (tipo && tipo !== "todos") {
    wheres.push("LOWER(T.TIPODIVERG) LIKE ?");
    params.push(`%${String(tipo).toLowerCase()}%`);
  }
  if (q) {
    wheres.push("(CAB.NUNNOTA LIKE ? OR PAR.NOMEPARC LIKE ? OR PO.DESCRPROD LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const sql = `
    SELECT
      T.NUTROCAITEM AS id,
      CAB.NUNNOTA   AS pedido,
      PAR.NOMEPARC  AS cliente,
      PO.DESCRPROD  AS itemOriginal,
      ('PRD-' || printf('%06d', PO.CODPROD))  AS codOriginal,
      PS.DESCRPROD  AS itemSeparado,
      ('PRD-' || printf('%06d', PS.CODPROD))  AS codSeparado,
      T.TIPODIVERG  AS tipoDivergencia,
      T.HOMOLOGADA  AS homologada,
      T.NECESSIDADECLI AS necessidadeCliente,
      T.QTDORIG     AS qtdOriginal,
      T.QTDSUBST    AS qtdEquivalente,
      printf('%g:%g',
        CASE WHEN T.FATORCONV < 1 THEN T.FATORCONV * 10 ELSE 1 END,
        CASE WHEN T.FATORCONV < 1 THEN 10                ELSE T.FATORCONV END
      ) AS fatorConversao,
      T.MOTIVO      AS motivo,
      CASE T.STATUS
        WHEN 'APROVADO'  THEN 'conforme'
        WHEN 'REJEITADO' THEN 'bloqueado'
        WHEN 'BLOQUEADO' THEN 'bloqueado'
        ELSE 'pendente'
      END AS status,
      USU.NOMEUSU   AS aprovador,
      T.DTAPROV     AS dtAprov,
      T.DTCRIACAO   AS dtCriacao
    FROM AD_TROCAITEM T
    JOIN TGFCAB CAB ON T.NUNOTA = CAB.NUNOTA
    JOIN TGFPAR PAR ON CAB.CODPARC = PAR.CODPARC
    JOIN TGFPRO PO ON T.CODPRODORIG = PO.CODPROD
    JOIN TGFPRO PS ON T.CODPRODSUBST = PS.CODPROD
    LEFT JOIN TSIUSU USU ON T.CODUSUAPROV = USU.CODUSU
    WHERE ${wheres.join(" AND ")}
    ORDER BY T.DTCRIACAO DESC, T.NUTROCAITEM DESC
  `;
  const rows = await db.prepare(sql).all(...params) as any[];
  rows.forEach((r) => (r.homologada = !!r.homologada));
  res.json(rows);
});

/**
 * GET /api/divergencias/summary
 */
router.get("/summary", async (_req, res) => {
  const db = getDb();
  const r = await db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN HOMOLOGADA=1 THEN 1 ELSE 0 END) AS homologadas,
      SUM(CASE WHEN HOMOLOGADA=0 THEN 1 ELSE 0 END) AS naoHomologadas,
      SUM(CASE WHEN TIPEQUIV='PROPORCIONAL' THEN 1 ELSE 0 END) AS porProporcao
    FROM AD_TROCAITEM
  `).get();
  res.json(r);
});

/**
 * POST /api/divergencias/:id/decidir  { acao: 'APROVAR'|'REPROVAR', codusu }
 */
router.post("/:id/decidir", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { acao, codusu = 2 } = req.body as { acao: "APROVAR" | "REPROVAR"; codusu?: number };
  const novoStatus = acao === "APROVAR" ? "APROVADO" : "REJEITADO";

  const div = await db.prepare(
    "SELECT NUNOTA, SEQUENCIA, CODPRODSUBST, QTDSUBST FROM AD_TROCAITEM WHERE NUTROCAITEM=?",
  ).get(id) as any;
  if (!div) {
    res.status(404).json({ error: "Divergência não encontrada" });
    return;
  }

  await db.prepare(`
    UPDATE AD_TROCAITEM
       SET STATUS = ?, CODUSUAPROV = ?, DTAPROV = datetime('now','localtime')
     WHERE NUTROCAITEM = ?
  `).run(novoStatus, codusu, id);

  // RN-06: ao APROVAR, substitui o item no pedido e devolve para separacao do substituto.
  if (acao === "APROVAR") {
    await db.prepare(`
      UPDATE TGFITE
         SET CODPROD = ?, QTDNEG = ?, QTDENTREGUE = 0, QTDCONFERIDA = 0,
             PENDENTE = 'S', CONTROLE = '', STATUSLOTE = 'A'
       WHERE NUNOTA = ? AND SEQUENCIA = ?
    `).run(div.CODPRODSUBST, div.QTDSUBST, div.NUNOTA, div.SEQUENCIA);
    const prog = await db.prepare(
      "SELECT COUNT(*) AS total, SUM(CASE WHEN PENDENTE='N' THEN 1 ELSE 0 END) AS conformes FROM TGFITE WHERE NUNOTA=?",
    ).get(div.NUNOTA) as any;
    const perc = prog.total ? Math.round((prog.conformes / prog.total) * 100) : 0;
    await db.prepare("UPDATE TGFCAB SET AD_PERCPROGRESSO=?, AD_STATUSSEP=? WHERE NUNOTA=?")
      .run(perc, perc === 100 ? "CONCLUIDO" : "EM_ANDAMENTO", div.NUNOTA);
  }
  res.json({ ok: true, status: novoStatus, substituido: acao === "APROVAR" });
});

/**
 * POST /api/divergencias/:id/informar-cliente
 * Marca que o cliente foi informado (auditoria) — usado quando NECESSIDADECLI='Informar'
 */
router.post("/:id/informar-cliente", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const r = await db.prepare(`
    UPDATE AD_TROCAITEM
       SET MOTIVO = COALESCE(MOTIVO, '') || ' | [INFO CLIENTE em ' || datetime('now','localtime') || ']'
     WHERE NUTROCAITEM = ?
  `).run(id);
  if (r.changes === 0) {
    res.status(404).json({ error: "Divergência não encontrada" });
    return;
  }
  res.json({ ok: true, evento: "cliente_informado" });
});

/**
 * POST /api/divergencias/:id/registrar-aprov-cliente
 * Marca aprovação formal do cliente (necessária para marca não homologada)
 */
router.post("/:id/registrar-aprov-cliente", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const r = await db.prepare(`
    UPDATE AD_TROCAITEM
       SET HOMOLOGADA = 1,
           STATUS = CASE WHEN STATUS = 'BLOQUEADO' THEN 'PENDENTE' ELSE STATUS END,
           MOTIVO = COALESCE(MOTIVO, '') || ' | [APROV CLIENTE em ' || datetime('now','localtime') || ']'
     WHERE NUTROCAITEM = ?
  `).run(id);
  if (r.changes === 0) {
    res.status(404).json({ error: "Divergência não encontrada" });
    return;
  }
  res.json({ ok: true, evento: "cliente_aprovou" });
});

/**
 * POST /api/divergencias/:id/encaminhar-gestor
 * Cria registro em AD_FLUXODISTINTO referenciando a divergência
 */
router.post("/:id/encaminhar-gestor", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { codusu = 2 } = req.body ?? {};

  const div = await db.prepare(`
    SELECT NUNOTA, SEQUENCIA, CODPRODORIG, CODPRODSUBST, MOTIVO, TIPODIVERG
    FROM AD_TROCAITEM WHERE NUTROCAITEM = ?
  `).get(id) as any;
  if (!div) {
    res.status(404).json({ error: "Divergência não encontrada" });
    return;
  }

  const r = await db.prepare(`
    INSERT INTO AD_FLUXODISTINTO
      (NUNOTA, SEQUENCIA, CODPRODNF, CODPRODFISICO, TIPO, JUSTIFICATIVA, IMPACTO,
       STATUS, CODUSUSOLICIT, DTSOLICIT)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDENTE', ?, datetime('now','localtime'))
  `).run(
    div.NUNOTA, div.SEQUENCIA, div.CODPRODORIG, div.CODPRODSUBST,
    div.TIPODIVERG === "Marca não homologada" ? "MARCA_DIFERENTE" : "EMBALAGEM",
    `Encaminhado pelo comercial. Motivo original: ${div.MOTIVO}`,
    "Movimento compensatório de estoque será gerado mediante aprovação gerencial.",
    codusu,
  );

  await db.prepare(`
    INSERT INTO AD_FLUXOHIST (NUFLUXODIST, DATA, ACAO, CODUSU)
    VALUES (?, datetime('now','localtime'), 'Encaminhado pelo comercial para aprovação gerencial', ?)
  `).run(r.lastInsertRowid, codusu);

  await db.prepare(`UPDATE AD_TROCAITEM SET STATUS='BLOQUEADO' WHERE NUTROCAITEM = ?`).run(id);

  res.json({ ok: true, nufluxodist: r.lastInsertRowid });
});

export default router;
