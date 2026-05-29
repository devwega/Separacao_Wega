import { Router } from "express";
import { getDb } from "../db/index.js";

const router = Router();

/**
 * GET /api/faltas
 * Tela 4 — Faltas e Apanho
 */
router.get("/", (req, res) => {
  const db = getDb();
  const { criticidade, tipo, acao, q } = req.query;
  const wheres: string[] = ["1=1"];
  const params: any[] = [];

  if (criticidade && criticidade !== "todas") {
    wheres.push("LOWER(F.CRITICIDADE) = ?");
    params.push(String(criticidade).toLowerCase());
  }
  if (tipo && tipo !== "todos") {
    wheres.push("F.TIPO = ?");
    params.push(tipo);
  }
  if (acao && acao !== "todas") {
    if (acao === "sem-acao") {
      wheres.push("F.ACAO IS NULL");
    } else {
      wheres.push("LOWER(F.ACAO) LIKE ?");
      params.push(`%${String(acao).toLowerCase()}%`);
    }
  }
  if (q) {
    wheres.push("(CAB.NUNNOTA LIKE ? OR P.DESCRPROD LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }

  const sql = `
    SELECT
      F.NUFALTAITEM AS id,
      CAB.NUNNOTA   AS pedido,
      PAR.NOMEPARC  AS cliente,
      P.DESCRPROD   AS item,
      ('PRD-' || printf('%06d', P.CODPROD)) AS codigo,
      I.QTDNEG      AS qtdPedida,
      F.QTDFALTA    AS qtdFaltante,
      F.TIPO        AS tipo,
      CAB.ORDEMCARGA AS embarcacao,
      substr(ORD.DTPREVSAIDA, 12, 5) AS horarioCarregamento,
      LOWER(F.CRITICIDADE) AS criticidade,
      CASE
        WHEN F.ACAO = 'APANHO'        THEN 'apanho'
        WHEN F.ACAO = 'COMPRA_PADRAO' THEN 'compra'
        WHEN F.ACAO = 'CORTE'         THEN 'corte'
        ELSE NULL
      END           AS acaoProposta,
      substr(F.PRAZORETORNO, 12, 5) AS prazoRetorno,
      F.STATUS      AS status,
      F.DTLIMITE    AS dtLimite,
      -- tempo restante simplificado
      CASE
        WHEN F.DTLIMITE IS NULL THEN 'sem prazo'
        WHEN julianday(F.DTLIMITE) - julianday('now','localtime') < 0 THEN 'expirado'
        WHEN (julianday(F.DTLIMITE) - julianday('now','localtime')) * 24 < 1 THEN
          CAST(ROUND((julianday(F.DTLIMITE) - julianday('now','localtime')) * 24 * 60) AS TEXT) || 'min'
        ELSE
          CAST(CAST((julianday(F.DTLIMITE) - julianday('now','localtime')) * 24 AS INTEGER) AS TEXT) || 'h ' ||
          CAST(CAST(((julianday(F.DTLIMITE) - julianday('now','localtime')) * 24 - CAST((julianday(F.DTLIMITE) - julianday('now','localtime')) * 24 AS INTEGER)) * 60 AS INTEGER) AS TEXT) || 'min'
      END AS tempoRestante
    FROM AD_FALTAITEM F
    JOIN TGFCAB CAB ON F.NUNOTA = CAB.NUNOTA
    JOIN TGFPAR PAR ON CAB.CODPARC = PAR.CODPARC
    JOIN TGFPRO P   ON F.CODPROD = P.CODPROD
    LEFT JOIN TGFITE I ON I.NUNOTA = F.NUNOTA AND I.SEQUENCIA = F.SEQUENCIA
    LEFT JOIN TGFORD ORD ON CAB.ORDEMCARGA = ORD.ORDEMCARGA
    WHERE ${wheres.join(" AND ")}
    ORDER BY
      CASE F.CRITICIDADE WHEN 'CRITICA' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 ELSE 4 END,
      F.DTLIMITE
  `;
  res.json(db.prepare(sql).all(...params));
});

/**
 * GET /api/faltas/summary
 */
router.get("/summary", (_req, res) => {
  const db = getDb();
  const r = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN TIPO='total' THEN 1 ELSE 0 END) AS totais,
      SUM(CASE WHEN TIPO='parcial' THEN 1 ELSE 0 END) AS parciais,
      SUM(CASE WHEN ACAO='APANHO' THEN 1 ELSE 0 END) AS apanhoAtivo,
      SUM(CASE WHEN ACAO='COMPRA_PADRAO' THEN 1 ELSE 0 END) AS compraPadrao,
      SUM(CASE WHEN ACAO IS NULL THEN 1 ELSE 0 END) AS semTratativa
    FROM AD_FALTAITEM
  `).get();
  res.json(r);
});

/**
 * POST /api/faltas/:id/acao  { acao: 'APANHO'|'COMPRA_PADRAO'|'CORTE', prazoRetorno?: string }
 */
router.post("/:id/acao", (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { acao, prazoRetorno = null } = req.body as any;

  const r = db.prepare(`
    UPDATE AD_FALTAITEM
       SET ACAO = ?, STATUS = 'EM_TRATAMENTO', PRAZORETORNO = ?
     WHERE NUFALTAITEM = ?
  `).run(acao, prazoRetorno, id);

  if (r.changes === 0) {
    res.status(404).json({ error: "Falta não encontrada" });
    return;
  }
  res.json({ ok: true });
});

/**
 * POST /api/faltas/:id/informar-previsao  { prazoRetorno: 'YYYY-MM-DD HH:MM' }
 */
router.post("/:id/informar-previsao", (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { prazoRetorno } = req.body as { prazoRetorno: string };
  if (!prazoRetorno) {
    res.status(400).json({ error: "prazoRetorno é obrigatório" });
    return;
  }
  const r = db.prepare(`
    UPDATE AD_FALTAITEM
       SET PRAZORETORNO = ?, STATUS = 'EM_TRATAMENTO'
     WHERE NUFALTAITEM = ?
  `).run(prazoRetorno, id);
  if (r.changes === 0) {
    res.status(404).json({ error: "Falta não encontrada" });
    return;
  }
  res.json({ ok: true });
});

/**
 * POST /api/faltas/:id/devolver-comercial
 */
router.post("/:id/devolver-comercial", (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const r = db.prepare(`
    UPDATE AD_FALTAITEM
       SET ACAO = NULL, STATUS = 'PENDENTE',
           OBSERVACAO = COALESCE(OBSERVACAO, '') || ' | Devolvido ao comercial em ' || datetime('now','localtime')
     WHERE NUFALTAITEM = ?
  `).run(id);
  if (r.changes === 0) {
    res.status(404).json({ error: "Falta não encontrada" });
    return;
  }
  res.json({ ok: true });
});

export default router;
