import { Router } from "express";
import { getDb } from "../db/index.js";
import { verifyPassword } from "../auth.js";

/** RN-07: criticidade automatica pelo horario de carregamento (HH:MM). Criterio padrao. */
function criticidade(horario?: string): "critica" | "alta" | "media" | "baixa" {
  if (!horario) return "media";
  const [h, m] = String(horario).split(":").map(Number);
  if (Number.isNaN(h)) return "media";
  const now = new Date();
  const alvo = new Date(now); alvo.setHours(h, m || 0, 0, 0);
  let diffH = (alvo.getTime() - now.getTime()) / 3600000;
  if (diffH < 0) diffH += 24;
  if (diffH < 2) return "critica";
  if (diffH < 4) return "alta";
  if (diffH < 8) return "media";
  return "baixa";
}

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
        (SELECT COUNT(DISTINCT COALESCE(NULLIF(TRIM(P2.LOCALIZACAO),''),'SEM LOCAL'))
           FROM TGFITE I2 JOIN TGFPRO P2 ON I2.CODPROD=P2.CODPROD WHERE I2.NUNOTA=CAB.NUNOTA) AS totalLocais,
        (SELECT COUNT(*) FROM (
           SELECT COALESCE(NULLIF(TRIM(P3.LOCALIZACAO),''),'SEM LOCAL') AS loc,
                  COUNT(*) AS tot, SUM(CASE WHEN I3.PENDENTE='N' THEN 1 ELSE 0 END) AS sep
           FROM TGFITE I3 JOIN TGFPRO P3 ON I3.CODPROD=P3.CODPROD WHERE I3.NUNOTA=CAB.NUNOTA GROUP BY loc
         ) WHERE sep = tot) AS locaisConcluidos,
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
    rows.forEach((r) => { r.alertaValidade = !!r.alertaValidade; r.criticidade = criticidade(r.horarioCarregamento); });
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

    const localFiltro = req.query.local ? String(req.query.local) : null;
    const itens = await db.prepare(`
      SELECT
        I.SEQUENCIA AS id, I.CODPROD AS codprod, P.DESCRPROD AS descricao,
        ('PRD-' || printf('%06d', I.CODPROD)) AS codigo,
        P.REFERENCIA AS eanEsperado,
        P.MARCA AS marca,
        EXISTS(SELECT 1 FROM AD_FALTAITEM F WHERE F.NUNOTA=I.NUNOTA AND F.SEQUENCIA=I.SEQUENCIA AND F.STATUS IN ('PENDENTE','EM_TRATAMENTO')) AS temFalta,
        I.QTDNEG AS qtdPedida, I.QTDENTREGUE AS qtdSeparada,
        I.CONTROLE AS lote, I.STATUSLOTE AS statusLote,
        CASE I.PENDENTE
          WHEN 'N' THEN 'conforme'
          ELSE (CASE
            WHEN EXISTS(SELECT 1 FROM AD_TROCAITEM T WHERE T.NUNOTA=I.NUNOTA AND T.SEQUENCIA=I.SEQUENCIA AND T.STATUS='PENDENTE') THEN 'separacao'
            ELSE 'pendente' END)
        END AS status,
        -- Tratativa atual do item (divergência / fluxo distinto / falta) para o separador
        -- saber em que passo está e que o item já foi tratado (BS-2.4 / FA-5.2).
        (CASE
          WHEN EXISTS(SELECT 1 FROM AD_FLUXODISTINTO X WHERE X.NUNOTA=I.NUNOTA AND X.SEQUENCIA=I.SEQUENCIA AND X.STATUS='APROVADO') THEN 'APROVADO_FLUXO_DISTINTO'
          WHEN EXISTS(SELECT 1 FROM AD_FLUXODISTINTO X WHERE X.NUNOTA=I.NUNOTA AND X.SEQUENCIA=I.SEQUENCIA AND X.STATUS='PENDENTE') THEN 'FLUXO_DISTINTO_PENDENTE'
          WHEN EXISTS(SELECT 1 FROM AD_TROCAITEM T WHERE T.NUNOTA=I.NUNOTA AND T.SEQUENCIA=I.SEQUENCIA AND T.STATUS='BLOQUEADO') THEN 'DIVERGENCIA_ENCAMINHADA'
          WHEN EXISTS(SELECT 1 FROM AD_TROCAITEM T WHERE T.NUNOTA=I.NUNOTA AND T.SEQUENCIA=I.SEQUENCIA AND T.STATUS='PENDENTE') THEN 'EM_TRATATIVA_DIVERGENCIA'
          WHEN EXISTS(SELECT 1 FROM AD_TROCAITEM T WHERE T.NUNOTA=I.NUNOTA AND T.SEQUENCIA=I.SEQUENCIA AND T.STATUS='APROVADO') THEN 'TROCA_APROVADA'
          WHEN EXISTS(SELECT 1 FROM AD_TROCAITEM T WHERE T.NUNOTA=I.NUNOTA AND T.SEQUENCIA=I.SEQUENCIA AND T.STATUS='REJEITADO') THEN 'TROCA_REJEITADA'
          WHEN EXISTS(SELECT 1 FROM AD_FALTAITEM F WHERE F.NUNOTA=I.NUNOTA AND F.SEQUENCIA=I.SEQUENCIA AND F.STATUS='RESOLVIDO') THEN 'FALTA_RESOLVIDA'
          WHEN EXISTS(SELECT 1 FROM AD_FALTAITEM F WHERE F.NUNOTA=I.NUNOTA AND F.SEQUENCIA=I.SEQUENCIA AND F.ACAO='CORTE') THEN 'AGUARDANDO_CORTE_COMERCIAL'
          WHEN EXISTS(SELECT 1 FROM AD_FALTAITEM F WHERE F.NUNOTA=I.NUNOTA AND F.SEQUENCIA=I.SEQUENCIA AND F.ACAO='APANHO') THEN 'EM_APANHO'
          WHEN EXISTS(SELECT 1 FROM AD_FALTAITEM F WHERE F.NUNOTA=I.NUNOTA AND F.SEQUENCIA=I.SEQUENCIA AND F.ACAO='COMPRA_PADRAO') THEN 'COMPRA_PADRAO'
          WHEN EXISTS(SELECT 1 FROM AD_FALTAITEM F WHERE F.NUNOTA=I.NUNOTA AND F.SEQUENCIA=I.SEQUENCIA AND F.STATUS IN ('PENDENTE','EM_TRATAMENTO')) THEN 'FALTA_AGUARDANDO_DEFINICAO'
          ELSE NULL
        END) AS tratativa,
        I.VLRUNIT AS vlrUnit, I.VLRTOT AS vlrTot,
        COALESCE(NULLIF(TRIM(P.LOCALIZACAO),''),'SEM LOCAL') AS local
      FROM TGFITE I
      JOIN TGFPRO P ON I.CODPROD = P.CODPROD
      WHERE I.NUNOTA = ?
        AND (? IS NULL OR COALESCE(NULLIF(TRIM(P.LOCALIZACAO),''),'SEM LOCAL') = ?)
      ORDER BY I.SEQUENCIA
    `).all(nunota, localFiltro, localFiltro) as any[];

    // BS-2.2: anexa info do fluxo distinto APROVADO (item NF + item físico e status das remessas)
    for (const it of itens) {
      const fd = await db.prepare(
        "SELECT NUFLUXODIST, CODPRODNF, CODPRODFISICO FROM AD_FLUXODISTINTO WHERE NUNOTA=? AND SEQUENCIA=? AND STATUS='APROVADO' ORDER BY NUFLUXODIST DESC LIMIT 1",
      ).get(nunota, it.id) as any;
      if (fd) {
        const pn = await db.prepare("SELECT DESCRPROD, REFERENCIA, MARCA FROM TGFPRO WHERE CODPROD=?").get(fd.CODPRODNF) as any;
        const pf = await db.prepare("SELECT DESCRPROD, REFERENCIA, MARCA FROM TGFPRO WHERE CODPROD=?").get(fd.CODPRODFISICO) as any;
        const ent = await db.prepare("SELECT 1 FROM AD_FLUXOREMESSA WHERE NUFLUXODIST=? AND TIPO='ENTRADA'").get(fd.NUFLUXODIST);
        const sai = await db.prepare("SELECT 1 FROM AD_FLUXOREMESSA WHERE NUFLUXODIST=? AND TIPO='SAIDA'").get(fd.NUFLUXODIST);
        it.fluxoDistinto = {
          nufluxodist: fd.NUFLUXODIST,
          codProdNF: fd.CODPRODNF, descNF: pn?.DESCRPROD, eanNF: pn?.REFERENCIA, marcaNF: pn?.MARCA,
          codProdFisico: fd.CODPRODFISICO, descFisico: pf?.DESCRPROD, eanFisico: pf?.REFERENCIA, marcaFisico: pf?.MARCA,
          entradaOk: !!ent, saidaOk: !!sai,
        };
      }
    }

    res.json({ ...pedido, criticidade: criticidade((pedido as any).horarioCarregamento), itens });
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
 * GET /api/pedidos/:nunota/locais (PL-1.1/1.2)
 * Locais a separar (definidos pelo cadastro do item — TGFPRO.LOCALIZACAO) com progresso por local.
 */
router.get("/:nunota/locais", async (req, res) => {
  try {
    const db = getDb();
    const nunota = Number(req.params.nunota);
    const rows = await db.prepare(`
      SELECT COALESCE(NULLIF(TRIM(P.LOCALIZACAO),''),'SEM LOCAL') AS local,
             COUNT(*) AS totalItens,
             SUM(CASE WHEN I.PENDENTE='N' THEN 1 ELSE 0 END) AS itensSeparados
      FROM TGFITE I JOIN TGFPRO P ON I.CODPROD = P.CODPROD
      WHERE I.NUNOTA = ?
      GROUP BY local
      ORDER BY local
    `).all(nunota) as any[];
    rows.forEach((r) => {
      r.concluido = r.totalItens > 0 && r.itensSeparados >= r.totalItens;
      r.perc = r.totalItens ? Math.round((r.itensSeparados / r.totalItens) * 100) : 0;
    });
    res.json(rows);
  } catch (e: any) {
    console.error("[locais] ERRO:", e?.message);
    res.status(500).json({ error: e?.message });
  }
});

/**
 * POST /api/pedidos/:nunota/iniciar-separacao-local (PL-1.1)
 * Inicia/retoma a separacao de um local especifico, exigindo login+senha do separador.
 */
router.post("/:nunota/iniciar-separacao-local", async (req, res) => {
  try {
    const db = getDb();
    const nunota = Number(req.params.nunota);
    const { local, login, senha } = (req.body ?? {}) as { local?: string; login?: string; senha?: string };
    if (!local) { res.status(400).json({ error: "Informe o local a separar" }); return; }
    if (!login || !senha) { res.status(400).json({ error: "Informe login e senha" }); return; }

    const cred = await db.prepare(
      "SELECT CODUSU, SENHA, ATIVO FROM AD_LOGIN WHERE LOWER(LOGIN)=LOWER(?)",
    ).get(login) as any;
    if (!cred || !cred.ATIVO || !verifyPassword(senha, cred.SENHA)) {
      res.status(401).json({ error: "Login ou senha invalidos" });
      return;
    }

    const cab = await db.prepare("SELECT AD_STATUSSEP FROM TGFCAB WHERE NUNOTA=?").get(nunota) as any;
    if (!cab) { res.status(404).json({ error: "Pedido nao encontrado" }); return; }

    await db.prepare(`
      UPDATE TGFCAB
         SET AD_STATUSSEP = 'EM_ANDAMENTO',
             AD_DTINICIOSEP = COALESCE(AD_DTINICIOSEP, datetime('now','localtime')),
             AD_CODUSUSEP = ?
       WHERE NUNOTA = ?
    `).run(cred.CODUSU, nunota);
    await db.prepare(`
      INSERT OR REPLACE INTO AD_SEPARACAO (NUNOTA, STATUS, PERCPROGRESSO, CODUSU, DTINICIO)
      VALUES (?, 'EM_ANDAMENTO',
              COALESCE((SELECT PERCPROGRESSO FROM AD_SEPARACAO WHERE NUNOTA=?), 0),
              ?,
              COALESCE((SELECT DTINICIO FROM AD_SEPARACAO WHERE NUNOTA=?), datetime('now','localtime')))
    `).run(nunota, nunota, cred.CODUSU, nunota);

    res.json({ ok: true, nunota, local, codusu: cred.CODUSU });
  } catch (e: any) {
    console.error("[iniciar-separacao-local] ERRO:", e?.message);
    res.status(500).json({ error: e?.message });
  }
});

/**
 * POST /api/pedidos/:nunota/finalizar-separacao (PL-1.3)
 */
router.post("/:nunota/finalizar-separacao", async (req, res) => {
  try {
    const db = getDb();
    const nunota = Number(req.params.nunota);
    const cab = await db.prepare("SELECT AD_STATUSSEP FROM TGFCAB WHERE NUNOTA=?").get(nunota) as any;
    if (!cab) { res.status(404).json({ error: "Pedido nao encontrado" }); return; }
    const prog = await db.prepare(
      "SELECT COUNT(*) AS total, SUM(CASE WHEN PENDENTE='N' THEN 1 ELSE 0 END) AS conformes FROM TGFITE WHERE NUNOTA=?",
    ).get(nunota) as any;
    const perc = prog.total ? Math.round((prog.conformes / prog.total) * 100) : 0;
    await db.prepare(
      "UPDATE TGFCAB SET AD_STATUSSEP='CONCLUIDO', AD_PERCPROGRESSO=?, AD_DTFIMSEP=datetime('now','localtime') WHERE NUNOTA=?",
    ).run(perc, nunota);
    await db.prepare(`
      INSERT OR REPLACE INTO AD_SEPARACAO (NUNOTA, STATUS, PERCPROGRESSO, CODUSU, DTINICIO, DTFIM)
      VALUES (?, 'CONCLUIDO', ?,
              COALESCE((SELECT CODUSU FROM AD_SEPARACAO WHERE NUNOTA=?), 1),
              COALESCE((SELECT DTINICIO FROM AD_SEPARACAO WHERE NUNOTA=?), datetime('now','localtime')),
              datetime('now','localtime'))
    `).run(nunota, perc, nunota, nunota);
    res.json({ ok: true, nunota, status: "CONCLUIDO", percProgresso: perc });
  } catch (e: any) {
    console.error("[finalizar-separacao] ERRO:", e?.message);
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
      { sql: "DELETE FROM AD_APANHO_REG WHERE NUFALTAITEM IN (SELECT NUFALTAITEM FROM AD_FALTAITEM WHERE NUNOTA=?)", args: [nunota] },
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

/**
 * POST /api/pedidos/:nunota/alterar-data  { dtEntrega }  (RN-08)
 * Altera a data de entrega e revalida a validade dos itens ja separados contra a
 * validade minima do parceiro: os que ultrapassarem o limite tem a separacao
 * estornada automaticamente (e sao sinalizados via alertaValidade na listagem).
 */
router.post("/:nunota/alterar-data", async (req, res) => {
  try {
    const db = getDb();
    const nunota = Number(req.params.nunota);
    const { dtEntrega } = req.body as any;
    if (!dtEntrega) { res.status(400).json({ error: "dtEntrega obrigatória" }); return; }
    await db.prepare("UPDATE TGFCAB SET DTNEG=? WHERE NUNOTA=?").run(dtEntrega, nunota);

    // validade minima do parceiro (ou global)
    const pc = await db.prepare(
      "SELECT CAB.CODPARC, V.DIASMIN FROM TGFCAB CAB LEFT JOIN AD_VALIDADEMIN V ON V.CODPARC=CAB.CODPARC WHERE CAB.NUNOTA=?",
    ).get(nunota) as any;
    let minDias = pc?.DIASMIN;
    if (minDias == null) {
      const g = await db.prepare("SELECT VALOR FROM AD_PARAM WHERE CHAVE='VALIDADE_MIN_GLOBAL'").get() as any;
      minDias = g ? Number(g.VALOR) : 30;
    }
    // itens separados cuja validade (DTVAL do lote em TGFEST) nao cobre o minimo a partir da nova data
    const itensRuins = await db.prepare(`
      SELECT I.SEQUENCIA FROM TGFITE I
      JOIN TGFEST E ON E.CODPROD=I.CODPROD AND E.CONTROLE=I.CONTROLE
      WHERE I.NUNOTA=? AND I.PENDENTE='N' AND E.DTVAL IS NOT NULL
        AND julianday(E.DTVAL) - julianday(?) < ?
    `).all(nunota, dtEntrega, minDias) as any[];

    for (const it of itensRuins) {
      await db.prepare(
        "UPDATE TGFITE SET PENDENTE='S', QTDENTREGUE=0, QTDCONFERIDA=0, CONTROLE='', STATUSLOTE='A' WHERE NUNOTA=? AND SEQUENCIA=?",
      ).run(nunota, it.SEQUENCIA);
    }
    if (itensRuins.length > 0) {
      const prog = await db.prepare(
        "SELECT COUNT(*) AS total, SUM(CASE WHEN PENDENTE='N' THEN 1 ELSE 0 END) AS conformes FROM TGFITE WHERE NUNOTA=?",
      ).get(nunota) as any;
      const perc = prog.total ? Math.round((prog.conformes / prog.total) * 100) : 0;
      await db.prepare("UPDATE TGFCAB SET AD_PERCPROGRESSO=?, AD_STATUSSEP=? WHERE NUNOTA=?")
        .run(perc, perc === 0 ? "NAO_INICIADO" : "EM_ANDAMENTO", nunota);
    }
    res.json({ ok: true, itensEstornados: itensRuins.length, minDias });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

export default router;
