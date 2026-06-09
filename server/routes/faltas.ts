import { Router } from "express";
import { getDb } from "../db/index.js";

const router = Router();

/**
 * GET /api/faltas
 * Tela 4 — Faltas e Apanho
 */
router.get("/", async (req, res) => {
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
      P.MARCA       AS marca,
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
  res.json(await db.prepare(sql).all(...params));
});

/**
 * GET /api/faltas/summary
 */
router.get("/summary", async (_req, res) => {
  const db = getDb();
  const r = await db.prepare(`
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
router.post("/:id/acao", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { acao, prazoRetorno = null } = req.body as any;

  const falta = await db.prepare(
    "SELECT NUNOTA, SEQUENCIA, CODPROD, QTDFALTA FROM AD_FALTAITEM WHERE NUFALTAITEM = ?",
  ).get(id) as any;
  if (!falta) {
    res.status(404).json({ error: "Falta não encontrada" });
    return;
  }

  await db.prepare(`
    UPDATE AD_FALTAITEM
       SET ACAO = ?, STATUS = 'EM_TRATAMENTO', PRAZORETORNO = ?
     WHERE NUFALTAITEM = ?
  `).run(acao, prazoRetorno, id);

  // FA-5.1: o CORTE não é definitivo aqui — vai para Divergências/Trocas para o comercial
  // aprovar e efetuar o corte final do pedido. Criamos uma entrada de "corte" em AD_TROCAITEM
  // (produto substituto = o próprio, qtd 0) reaproveitando o fluxo de aprovação/estorno.
  if (acao === "CORTE") {
    const jaExiste = await db.prepare(`
      SELECT 1 FROM AD_TROCAITEM
       WHERE NUNOTA=? AND SEQUENCIA=? AND TIPODIVERG='Corte' AND STATUS IN ('PENDENTE','BLOQUEADO')
    `).get(falta.NUNOTA, falta.SEQUENCIA);
    if (!jaExiste) {
      await db.prepare(`
        INSERT INTO AD_TROCAITEM
          (NUNOTA, SEQUENCIA, CODPRODORIG, CODPRODSUBST, QTDORIG, QTDSUBST,
           TIPEQUIV, FATORCONV, MOTIVO, STATUS, HOMOLOGADA, NECESSIDADECLI, TIPODIVERG)
        VALUES (?, ?, ?, ?, ?, 0, 'EXATA', 1,
                'Corte solicitado a partir de falta. Aprovação e corte final pelo comercial.',
                'PENDENTE', 0, 'Aprovação obrigatória', 'Corte')
      `).run(falta.NUNOTA, falta.SEQUENCIA, falta.CODPROD, falta.CODPROD, falta.QTDFALTA);
    }
  }

  res.json({ ok: true, encaminhadoParaComercial: acao === "CORTE" });
});

/**
 * POST /api/faltas/:id/informar-previsao  { prazoRetorno: 'YYYY-MM-DD HH:MM' }
 */
router.post("/:id/informar-previsao", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { prazoRetorno } = req.body as { prazoRetorno: string };
  if (!prazoRetorno) {
    res.status(400).json({ error: "prazoRetorno é obrigatório" });
    return;
  }
  const r = await db.prepare(`
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
router.post("/:id/devolver-comercial", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const r = await db.prepare(`
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

/**
 * POST /api/faltas/:id/voltar-separacao  (Secao 8 — caminho "compra padrao")
 * Quando o item comprado entra no estoque, devolve o item para a fila de separacao
 * (PENDENTE='S') e marca a falta como RESOLVIDA.
 */
router.post("/:id/voltar-separacao", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const f = await db.prepare("SELECT NUNOTA, SEQUENCIA FROM AD_FALTAITEM WHERE NUFALTAITEM=?").get(id) as any;
  if (!f) { res.status(404).json({ error: "Falta não encontrada" }); return; }
  await db.prepare(
    "UPDATE TGFITE SET PENDENTE='S', QTDENTREGUE=0, QTDCONFERIDA=0, CONTROLE='', STATUSLOTE='A' WHERE NUNOTA=? AND SEQUENCIA=?",
  ).run(f.NUNOTA, f.SEQUENCIA);
  await db.prepare("UPDATE AD_FALTAITEM SET STATUS='RESOLVIDO' WHERE NUFALTAITEM=?").run(id);
  // reativa separacao do pedido se estava concluida
  await db.prepare("UPDATE TGFCAB SET AD_STATUSSEP='EM_ANDAMENTO' WHERE NUNOTA=? AND AD_STATUSSEP='CONCLUIDO'").run(f.NUNOTA);
  res.json({ ok: true });
});

export default router;
