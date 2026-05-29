import { Router } from "express";
import { getDb } from "../db/index.js";

const router = Router();

export const STATUS_PEDIDO_SQL = `
  CASE
    WHEN CAB.STATUSNOTA = 'F' THEN 'FATURADO'
    WHEN CAB.AD_STATUSSEP = 'CONCLUIDO'
      AND NOT EXISTS(SELECT 1 FROM AD_TROCAITEM WHERE NUNOTA=CAB.NUNOTA AND STATUS IN ('PENDENTE','BLOQUEADO'))
      AND NOT EXISTS(SELECT 1 FROM AD_FALTAITEM WHERE NUNOTA=CAB.NUNOTA AND STATUS IN ('PENDENTE','EM_TRATAMENTO'))
      AND NOT EXISTS(SELECT 1 FROM AD_FLUXODISTINTO WHERE NUNOTA=CAB.NUNOTA AND STATUS='PENDENTE')
    THEN 'LIBERADO_FATURAMENTO'
    WHEN EXISTS(SELECT 1 FROM AD_FLUXODISTINTO WHERE NUNOTA=CAB.NUNOTA AND STATUS='APROVADO')
    THEN 'APROVADO_FLUXO_DISTINTO'
    WHEN EXISTS(SELECT 1 FROM AD_TROCAITEM WHERE NUNOTA=CAB.NUNOTA AND STATUS='REJEITADO')
      AND NOT EXISTS(SELECT 1 FROM AD_TROCAITEM WHERE NUNOTA=CAB.NUNOTA AND STATUS IN ('PENDENTE','BLOQUEADO'))
    THEN 'REPROVADO'
    WHEN EXISTS(SELECT 1 FROM AD_TROCAITEM WHERE NUNOTA=CAB.NUNOTA AND STATUS='APROVADO')
      AND NOT EXISTS(SELECT 1 FROM AD_TROCAITEM WHERE NUNOTA=CAB.NUNOTA AND STATUS IN ('PENDENTE','BLOQUEADO'))
      AND NOT EXISTS(SELECT 1 FROM AD_FALTAITEM WHERE NUNOTA=CAB.NUNOTA AND STATUS IN ('PENDENTE','EM_TRATAMENTO'))
    THEN 'APROVADO_ALTERACAO'
    WHEN EXISTS(SELECT 1 FROM AD_TROCAITEM WHERE NUNOTA=CAB.NUNOTA AND STATUS IN ('PENDENTE','BLOQUEADO'))
      OR EXISTS(SELECT 1 FROM AD_FLUXODISTINTO WHERE NUNOTA=CAB.NUNOTA AND STATUS='PENDENTE')
    THEN 'AGUARDANDO_DECISAO'
    WHEN EXISTS(SELECT 1 FROM AD_FALTAITEM WHERE NUNOTA=CAB.NUNOTA AND STATUS IN ('PENDENTE','EM_TRATAMENTO'))
    THEN 'COM_FALTA_ANALISE'
    WHEN CAB.AD_STATUSSEP = 'EM_ANDAMENTO' THEN 'EM_SEPARACAO'
    WHEN CAB.STATUSNOTA = 'L' AND COALESCE(CAB.AD_STATUSSEP,'NAO_INICIADO') = 'NAO_INICIADO' THEN 'LIBERADO_SEPARACAO'
    ELSE 'LANCADO'
  END
`;

/**
 * GET /api/pedidos - Listagem com filtros
 */
router.get("/", async (req, res) => {
  try {
    const db = getDb();
    const { status, embarcacao, prioridade, q } = req.query;

    const wheres: string[] = ["CAB.STATUSNOTA IN ('L','F','P')"];
    const params: any[] = [];

    if (status && status !== "todos") {
      wheres.push(`((${STATUS_PEDIDO_SQL}) = ? OR (
        CASE WHEN COALESCE(CAB.AD_STATUSSEP,'NAO_INICIADO')='NAO_INICIADO' THEN 'pendente'
             WHEN CAB.AD_STATUSSEP='EM_ANDAMENTO' THEN 'separacao'
             WHEN CAB.AD_STATUSSEP='CONCLUIDO' THEN 'conforme'
             WHEN CAB.AD_STATUSSEP='DIVERGENCIA' THEN 'bloqueado' END
      ) = ?)`);
      params.push(String(status).toUpperCase(), String(status));
    }
    if (embarcacao && embarcacao !== "todas") {
      wheres.push("CAB.ORDEMCARGA = ?");
      params.push(embarcacao);
    }
    if (prioridade && prioridade !== "todas") {
      wheres.push("LOWER(CAB.AD_PRIORIDADE) = ?");
      params.push(String(prioridade).toLowerCase());
    }
    if (q) {
      wheres.push("(CAB.NUNNOTA LIKE ? OR PAR.NOMEPARC LIKE ? OR CAB.ORDEMCARGA LIKE ? OR CAST(CAB.NUNOTA AS TEXT) LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const sql = `
      SELECT
        CAB.NUNOTA            AS nunota,
        CAB.NUNNOTA           AS id,
        PAR.NOMEPARC          AS cliente,
        CAB.ORDEMCARGA        AS embarcacao,
        substr(ORD.DTPREVSAIDA, 12, 5) AS horarioCarregamento,
        LOWER(CAB.AD_PRIORIDADE) AS prioridade,
        CASE
          WHEN CAB.AD_STATUSSEP = 'NAO_INICIADO'  THEN 'pendente'
          WHEN CAB.AD_STATUSSEP = 'EM_ANDAMENTO'  THEN 'separacao'
          WHEN CAB.AD_STATUSSEP = 'CONCLUIDO'     THEN 'conforme'
          WHEN CAB.AD_STATUSSEP = 'DIVERGENCIA'   THEN 'bloqueado'
          ELSE 'pendente'
        END AS status,
        (SELECT COUNT(*) FROM TGFITE WHERE NUNOTA = CAB.NUNOTA) AS totalItens,
        (SELECT COUNT(*) FROM TGFITE WHERE NUNOTA = CAB.NUNOTA AND PENDENTE = 'N') AS itensSeparados,
        (SELECT COUNT(*) FROM AD_TROCAITEM T WHERE T.NUNOTA = CAB.NUNOTA AND T.STATUS = 'PENDENTE')
          + (SELECT COUNT(*) FROM AD_FALTAITEM F WHERE F.NUNOTA = CAB.NUNOTA AND F.STATUS = 'PENDENTE')
          AS pendencias,
        (SELECT COUNT(*) FROM TGFITE I
          JOIN TGFEST E ON E.CODPROD = I.CODPROD AND E.CONTROLE = I.CONTROLE
          WHERE I.NUNOTA = CAB.NUNOTA
            AND E.DTVAL IS NOT NULL
            AND julianday(E.DTVAL) - julianday('now') < 30) AS alertaValidade,
        CAB.VLRNOTA  AS vlrNota,
        CAB.AD_PERCPROGRESSO AS percProgresso,
        (${STATUS_PEDIDO_SQL}) AS statusPedido
      FROM TGFCAB CAB
      INNER JOIN TGFPAR PAR ON CAB.CODPARC = PAR.CODPARC
      LEFT JOIN TGFORD ORD ON CAB.ORDEMCARGA = ORD.ORDEMCARGA
      WHERE ${wheres.join(" AND ")}
      ORDER BY ORD.DTPREVSAIDA ASC,
        CASE CAB.AD_PRIORIDADE WHEN 'CRITICA' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 ELSE 4 END
    `;

    const rows = await db.prepare(sql).all(...params) as any[];
    rows.forEach((r) => (r.alertaValidade = !!r.alertaValidade));
    res.json(rows);
  } catch (e: any) {
    console.error("[GET /api/pedidos] ERRO:", e?.message);
    console.error("Query:", req.query);
    console.error(e?.stack);
    res.status(500).json({ error: e?.message, code: e?.code });
  }
});

/**
 * GET /api/pedidos/embarcacoes
 */
router.get("/embarcacoes", async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db.prepare(`
      SELECT DISTINCT ORDEMCARGA AS value
      FROM TGFCAB WHERE STATUSNOTA='L' AND ORDEMCARGA IS NOT NULL
      ORDER BY ORDEMCARGA
    `).all();
    res.json(rows);
  } catch (e: any) {
    console.error("[embarcacoes] ERRO:", e?.message);
    res.status(500).json({ error: e?.message });
  }
});

/**
 * GET /api/pedidos/summary
 */
router.get("/summary", async (_req, res) => {
  try {
    const db = getDb();
    const sql = `
      SELECT
        COUNT(*) AS totalPedidos,
        SUM(CASE WHEN AD_STATUSSEP='EM_ANDAMENTO' THEN 1 ELSE 0 END) AS emSeparacao,
        SUM(CASE WHEN AD_STATUSSEP='DIVERGENCIA' OR EXISTS (
          SELECT 1 FROM AD_TROCAITEM T WHERE T.NUNOTA=CAB.NUNOTA AND T.STATUS='PENDENTE'
        ) OR EXISTS (
          SELECT 1 FROM AD_FALTAITEM F WHERE F.NUNOTA=CAB.NUNOTA AND F.STATUS='PENDENTE'
        ) THEN 1 ELSE 0 END) AS comPendencias,
        SUM(CASE WHEN AD_STATUSSEP='CONCLUIDO' THEN 1 ELSE 0 END) AS concluidos
      FROM TGFCAB CAB
      WHERE STATUSNOTA IN ('L','F','P')
    `;
    res.json(await db.prepare(sql).get());
  } catch (e: any) {
    console.error("[summary] ERRO:", e?.message);
    res.status(500).json({ error: e?.message });
  }
});

/**
 * GET /api/pedidos/status-distribution
 */
router.get("/status-distribution", async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db.prepare(`
      SELECT (${STATUS_PEDIDO_SQL}) AS status, COUNT(*) AS count
      FROM TGFCAB CAB
      WHERE STATUSNOTA IN ('L','F','P')
      GROUP BY (${STATUS_PEDIDO_SQL})
      ORDER BY count DESC
    `).all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

/**
 * GET /api/pedidos/:nunota
 */
router.get("/:nunota", async (req, res) => {
  try {
    const db = getDb();
    const nunota = Number(req.params.nunota);

    const pedido = await db.prepare(`
      SELECT
        CAB.NUNOTA, CAB.NUNNOTA, PAR.NOMEPARC AS cliente, CAB.ORDEMCARGA AS embarcacao,
        substr(ORD.DTPREVSAIDA, 12, 5) AS horarioCarregamento,
        VEN.APELIDO AS vendedor,
        USU.NOMEUSU AS separador,
        CAB.AD_PRIORIDADE AS prioridade,
        CAB.AD_STATUSSEP AS statusSeparacao,
        CAB.AD_PERCPROGRESSO AS percProgresso,
        CAB.VLRNOTA AS vlrNota,
        CAB.STATUSNOTA AS statusNota,
        (${STATUS_PEDIDO_SQL}) AS statusPedido
      FROM TGFCAB CAB
      JOIN TGFPAR PAR ON CAB.CODPARC = PAR.CODPARC
      LEFT JOIN TGFVEN VEN ON CAB.CODVEND = VEN.CODVEND
      LEFT JOIN TGFORD ORD ON CAB.ORDEMCARGA = ORD.ORDEMCARGA
      LEFT JOIN TSIUSU USU ON CAB.AD_CODUSUSEP = USU.CODUSU
      WHERE CAB.NUNOTA = ?
    `).get(nunota);

    if (!pedido) {
      res.status(404).json({ error: "Pedido não encontrado" });
      return;
    }

    const itens = await db.prepare(`
      SELECT
        I.SEQUENCIA AS id, I.CODPROD AS codprod, P.DESCRPROD AS descricao,
        ('PRD-' || printf('%06d', I.CODPROD)) AS codigo,
        P.REFERENCIA AS eanEsperado,
        I.QTDNEG AS qtdPedida, I.QTDENTREGUE AS qtdSeparada,
        I.CONTROLE AS lote, I.STATUSLOTE AS statusLote,
        CASE I.PENDENTE
          WHEN 'N' THEN 'conforme'
          ELSE (CASE
            WHEN EXISTS(SELECT 1 FROM AD_TROCAITEM T WHERE T.NUNOTA=I.NUNOTA AND T.SEQUENCIA=I.SEQUENCIA AND T.STATUS='PENDENTE') THEN 'separacao'
            ELSE 'pendente' END)
        END AS status,
        I.VLRUNIT AS vlrUnit, I.VLRTOT AS vlrTot
      FROM TGFITE I
      JOIN TGFPRO P ON I.CODPROD = P.CODPROD
      WHERE I.NUNOTA = ?
      ORDER BY I.SEQUENCIA
    `).all(nunota);

    res.json({ ...pedido, itens });
  } catch (e: any) {
    console.error("[GET pedido] ERRO:", e?.message, e?.stack);
    res.status(500).json({ error: e?.message });
  }
});

/**
 * POST /api/pedidos/:nunota/iniciar-separacao
 */
router.post("/:nunota/iniciar-separacao", async (req, res) => {
  try {
    const db = getDb();
    const nunota = Number(req.params.nunota);
    const { codusu = 1 } = req.body ?? {};

    const cab = await db.prepare("SELECT AD_STATUSSEP FROM TGFCAB WHERE NUNOTA=?").get(nunota) as any;
    if (!cab) {
      res.status(404).json({ error: "Pedido não encontrado" });
      return;
    }

    await db.prepare(`
      UPDATE TGFCAB
         SET AD_STATUSSEP = 'EM_ANDAMENTO',
             AD_DTINICIOSEP = COALESCE(AD_DTINICIOSEP, datetime('now','localtime')),
             AD_CODUSUSEP = ?
       WHERE NUNOTA = ?
    `).run(codusu, nunota);

    await db.prepare(`
      INSERT OR REPLACE INTO AD_SEPARACAO (NUNOTA, STATUS, PERCPROGRESSO, CODUSU, DTINICIO)
      VALUES (?, 'EM_ANDAMENTO',
              COALESCE((SELECT PERCPROGRESSO FROM AD_SEPARACAO WHERE NUNOTA=?), 0),
              ?,
              COALESCE((SELECT DTINICIO FROM AD_SEPARACAO WHERE NUNOTA=?), datetime('now','localtime')))
    `).run(nunota, nunota, codusu, nunota);

    res.json({ ok: true, nunota, status: "EM_ANDAMENTO" });
  } catch (e: any) {
    console.error("[iniciar-separacao] ERRO:", e?.message);
    res.status(500).json({ error: e?.message });
  }
});

/**
 * POST /api/pedidos/:nunota/devolver-ajuste
 */
router.post("/:nunota/devolver-ajuste", async (req, res) => {
  try {
    const db = getDb();
    const nunota = Number(req.params.nunota);
    const { motivo = "Devolvido para ajuste" } = req.body ?? {};

    const r = await db.prepare(`
      UPDATE TGFCAB SET AD_STATUSSEP = 'NAO_INICIADO' WHERE NUNOTA = ?
    `).run(nunota);
    if (r.changes === 0) {
      res.status(404).json({ error: "Pedido não encontrado" });
      return;
    }
    res.json({ ok: true, motivo });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

/**
 * GET /api/pedidos/:nunota/auditoria
 */
router.get("/:nunota/auditoria", async (req, res) => {
  try {
    const db = getDb();
    const nunota = Number(req.params.nunota);

    const eventos: { data: string; tipo: string; descricao: string; usuario?: string }[] = [];

    const sep = await db.prepare(`
      SELECT S.DTINICIO, S.DTFIM, S.STATUS, U.NOMEUSU
      FROM AD_SEPARACAO S LEFT JOIN TSIUSU U ON S.CODUSU = U.CODUSU
      WHERE NUNOTA = ?
    `).get(nunota) as any;
    if (sep?.DTINICIO) eventos.push({
      data: sep.DTINICIO, tipo: "SEPARACAO", usuario: sep.NOMEUSU,
      descricao: `Separação iniciada — ${sep.STATUS}`,
    });
    if (sep?.DTFIM) eventos.push({
      data: sep.DTFIM, tipo: "SEPARACAO", usuario: sep.NOMEUSU,
      descricao: `Separação concluída`,
    });

    const trocas = await db.prepare(`
      SELECT T.DTCRIACAO, T.DTAPROV, T.STATUS, T.MOTIVO, U.NOMEUSU,
             PO.DESCRPROD AS po, PS.DESCRPROD AS ps
      FROM AD_TROCAITEM T
      JOIN TGFPRO PO ON T.CODPRODORIG = PO.CODPROD
      JOIN TGFPRO PS ON T.CODPRODSUBST = PS.CODPROD
      LEFT JOIN TSIUSU U ON T.CODUSUAPROV = U.CODUSU
      WHERE T.NUNOTA = ?
    `).all(nunota) as any[];
    trocas.forEach((t) => {
      eventos.push({
        data: t.DTCRIACAO, tipo: "DIVERGENCIA",
        descricao: `Divergência registrada: ${t.po} → ${t.ps}`,
      });
      if (t.DTAPROV) eventos.push({
        data: t.DTAPROV, tipo: "DIVERGENCIA", usuario: t.NOMEUSU,
        descricao: `Divergência ${t.STATUS.toLowerCase()}: ${t.po}`,
      });
    });

    const faltas = await db.prepare(`
      SELECT F.DTCRIACAO, F.DTRESOLUCAO, F.STATUS, F.ACAO, P.DESCRPROD
      FROM AD_FALTAITEM F JOIN TGFPRO P ON F.CODPROD = P.CODPROD
      WHERE F.NUNOTA = ?
    `).all(nunota) as any[];
    faltas.forEach((f) => {
      eventos.push({
        data: f.DTCRIACAO, tipo: "FALTA",
        descricao: `Falta registrada: ${f.DESCRPROD}` + (f.ACAO ? ` (ação: ${f.ACAO})` : ""),
      });
    });

    const fluxos = await db.prepare(`
      SELECT H.DATA, H.ACAO, U.NOMEUSU, F.NUFLUXODIST
      FROM AD_FLUXOHIST H
      JOIN AD_FLUXODISTINTO F ON H.NUFLUXODIST = F.NUFLUXODIST
      LEFT JOIN TSIUSU U ON H.CODUSU = U.CODUSU
      WHERE F.NUNOTA = ?
    `).all(nunota) as any[];
    fluxos.forEach((f) => {
      eventos.push({
        data: f.DATA, tipo: "FLUXO_DISTINTO", usuario: f.NOMEUSU,
        descricao: f.ACAO,
      });
    });

    const cab = await db.prepare("SELECT DTFATUR FROM TGFCAB WHERE NUNOTA=?").get(nunota) as any;
    if (cab?.DTFATUR) eventos.push({
      data: cab.DTFATUR, tipo: "FATURAMENTO", descricao: "Pedido faturado",
    });

    eventos.sort((a, b) => (a.data > b.data ? 1 : -1));
    res.json(eventos);
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

/**
 * POST /api/pedidos/:nunota/estornar-separacao  (PL-07)
 * Estorna toda a separacao do pedido: limpa divergencias, faltas, fluxos e separacao,
 * volta itens para pendente e o cabecalho para NAO_INICIADO.
 */
router.post("/:nunota/estornar-separacao", async (req, res) => {
  try {
    const { getClient } = await import("../db/index.js");
    const c = getClient();
    const nunota = Number(req.params.nunota);
    await c.batch([
      { sql: "DELETE FROM AD_FLUXOHIST WHERE NUFLUXODIST IN (SELECT NUFLUXODIST FROM AD_FLUXODISTINTO WHERE NUNOTA=?)", args: [nunota] },
      { sql: "DELETE FROM AD_FLUXODISTINTO WHERE NUNOTA=?", args: [nunota] },
      { sql: "DELETE FROM AD_FALTAITEM WHERE NUNOTA=?", args: [nunota] },
      { sql: "DELETE FROM AD_TROCAITEM WHERE NUNOTA=?", args: [nunota] },
      { sql: "DELETE FROM AD_SEPARACAO WHERE NUNOTA=?", args: [nunota] },
      { sql: "UPDATE TGFITE SET QTDENTREGUE=0, QTDCONFERIDA=0, PENDENTE='S', CONTROLE='', STATUSLOTE='A' WHERE NUNOTA=?", args: [nunota] },
      { sql: "UPDATE TGFCAB SET STATUSNOTA='L', AD_STATUSSEP='NAO_INICIADO', AD_PERCPROGRESSO=0, AD_DTINICIOSEP=NULL, AD_DTFIMSEP=NULL, AD_CODUSUSEP=NULL, DTFATUR=NULL WHERE NUNOTA=?", args: [nunota] },
    ], "write");
    res.json({ ok: true, nunota, status: "NAO_INICIADO" });
  } catch (e: any) {
    console.error("[estornar-separacao] ERRO:", e?.message);
    res.status(500).json({ error: e?.message });
  }
});

export default router;
