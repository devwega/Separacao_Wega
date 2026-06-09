import { Router } from "express";
import { getDb } from "../db/index.js";
import { STATUS_PEDIDO_SQL } from "./pedidos.js";

const router = Router();

/**
 * GET /api/pre-faturamento/:nunota — Tela 6
 * Consolida resultado final do pedido antes do faturamento
 */
router.get("/:nunota", async (req, res) => {
  const db = getDb();
  const nunota = Number(req.params.nunota);

  const cab = await db.prepare(`
    SELECT
      CAB.NUNNOTA AS id, PAR.NOMEPARC AS cliente,
      CAB.ORDEMCARGA AS embarcacao,
      substr(ORD.DTPREVSAIDA, 12, 5) AS horario,
      USU.NOMEUSU AS responsavel,
      CAB.VLRNOTA AS vlrNota, CAB.STATUSNOTA AS statusNota,
      (${STATUS_PEDIDO_SQL}) AS statusPedido,
      (SELECT COUNT(*) FROM TGFITE WHERE NUNOTA = CAB.NUNOTA) AS totalItens,
      (SELECT COUNT(*) FROM TGFITE WHERE NUNOTA = CAB.NUNOTA AND PENDENTE='N'
        AND NOT EXISTS (SELECT 1 FROM AD_TROCAITEM T WHERE T.NUNOTA=CAB.NUNOTA AND T.SEQUENCIA=TGFITE.SEQUENCIA))
        AS conformes,
      (SELECT COUNT(*) FROM AD_TROCAITEM WHERE NUNOTA = CAB.NUNOTA AND STATUS='APROVADO') AS substituidos,
      (SELECT COUNT(*) FROM AD_FALTAITEM WHERE NUNOTA = CAB.NUNOTA) AS faltas,
      (SELECT COUNT(*) FROM AD_FLUXODISTINTO WHERE NUNOTA = CAB.NUNOTA AND STATUS='APROVADO') AS fluxoDistinto,
      (
        (SELECT COUNT(*) FROM AD_TROCAITEM WHERE NUNOTA=CAB.NUNOTA AND STATUS='PENDENTE') +
        (SELECT COUNT(*) FROM AD_FALTAITEM WHERE NUNOTA=CAB.NUNOTA AND STATUS='PENDENTE') +
        (SELECT COUNT(*) FROM AD_FLUXODISTINTO WHERE NUNOTA=CAB.NUNOTA AND STATUS='PENDENTE')
      ) AS pendenciasImpeditivas
    FROM TGFCAB CAB
    JOIN TGFPAR PAR ON CAB.CODPARC = PAR.CODPARC
    LEFT JOIN TGFORD ORD ON CAB.ORDEMCARGA = ORD.ORDEMCARGA
    LEFT JOIN TSIUSU USU ON CAB.AD_CODUSUSEP = USU.CODUSU
    WHERE CAB.NUNOTA = ?
  `).get(nunota) as any;

  if (!cab) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  // Itens conformes
  const itensConformes = await db.prepare(`
    SELECT
      ('PRD-' || printf('%06d', I.CODPROD)) AS codigo,
      P.DESCRPROD AS descricao,
      P.MARCA AS marca,
      I.QTDENTREGUE AS qtd,
      I.CONTROLE AS lote,
      E.DTVAL AS validade
    FROM TGFITE I
    JOIN TGFPRO P ON I.CODPROD = P.CODPROD
    LEFT JOIN TGFEST E ON E.CODPROD = I.CODPROD AND E.CONTROLE = I.CONTROLE
    WHERE I.NUNOTA = ? AND I.PENDENTE='N'
      AND NOT EXISTS (SELECT 1 FROM AD_TROCAITEM T WHERE T.NUNOTA=I.NUNOTA AND T.SEQUENCIA=I.SEQUENCIA)
  `).all(nunota);

  // Itens substituídos
  const itensSubstituidos = await db.prepare(`
    SELECT
      ('PRD-' || printf('%06d', T.CODPRODORIG))  AS codOriginal,
      PO.DESCRPROD AS descOriginal,
      PO.MARCA AS marcaOriginal,
      ('PRD-' || printf('%06d', T.CODPRODSUBST)) AS codSubstituto,
      PS.DESCRPROD AS descSubstituto,
      COALESCE(B.MARCA, PS.MARCA) AS marcaSubstituto,
      T.QTDORIG AS qtdOriginal,
      T.QTDSUBST AS qtdSubstituta,
      T.TIPODIVERG AS tipo,
      USU.NOMEUSU AS aprovadoPor
    FROM AD_TROCAITEM T
    JOIN TGFPRO PO ON T.CODPRODORIG = PO.CODPROD
    JOIN TGFPRO PS ON T.CODPRODSUBST = PS.CODPROD
    LEFT JOIN TGFBAR B ON B.CODBARRAS = T.EANBIPADO
    LEFT JOIN TSIUSU USU ON T.CODUSUAPROV = USU.CODUSU
    WHERE T.NUNOTA = ? AND T.STATUS='APROVADO'
  `).all(nunota);

  // Itens em falta
  const itensFalta = await db.prepare(`
    SELECT
      ('PRD-' || printf('%06d', F.CODPROD)) AS codigo,
      P.DESCRPROD AS descricao,
      P.MARCA AS marca,
      I.QTDNEG AS qtdPedida,
      F.QTDFALTA AS qtdFaltante,
      CASE F.ACAO
        WHEN 'COMPRA_PADRAO' THEN 'Compra padrão'
        WHEN 'APANHO' THEN 'Apanho'
        WHEN 'CORTE' THEN 'Corte'
        ELSE 'Sem tratativa'
      END AS acao,
      COALESCE(substr(F.PRAZORETORNO, 12, 5) || 'h', '—') AS previsao
    FROM AD_FALTAITEM F
    JOIN TGFPRO P ON F.CODPROD = P.CODPROD
    LEFT JOIN TGFITE I ON I.NUNOTA = F.NUNOTA AND I.SEQUENCIA = F.SEQUENCIA
    WHERE F.NUNOTA = ?
  `).all(nunota);

  // Fluxo distinto
  const itensFluxoDistinto = await db.prepare(`
    SELECT
      ('PRD-' || printf('%06d', F.CODPRODNF)) AS codNF,
      PN.DESCRPROD AS descNF,
      PN.MARCA AS marcaNF,
      ('PRD-' || printf('%06d', F.CODPRODFISICO)) AS codFisico,
      PF.DESCRPROD AS descFisico,
      COALESCE(B.MARCA, PF.MARCA) AS marcaFisico,
      APR.NOMEUSU AS aprovadoPor,
      F.JUSTIFICATIVA AS justificativa
    FROM AD_FLUXODISTINTO F
    JOIN TGFPRO PN ON F.CODPRODNF = PN.CODPROD
    JOIN TGFPRO PF ON F.CODPRODFISICO = PF.CODPROD
    LEFT JOIN TGFBAR B ON B.CODBARRAS = F.EANFISICO
    LEFT JOIN TSIUSU APR ON F.CODUSUAPROV = APR.CODUSU
    WHERE F.NUNOTA = ? AND F.STATUS='APROVADO'
  `).all(nunota);

  // Pendências impeditivas detalhadas
  const pendencias: any[] = [];
  const trocasPend = await db.prepare(`
    SELECT P.DESCRPROD as desc, T.NUTROCAITEM
    FROM AD_TROCAITEM T JOIN TGFPRO P ON T.CODPRODORIG = P.CODPROD
    WHERE T.NUNOTA=? AND T.STATUS='PENDENTE'
  `).all(nunota) as any[];
  trocasPend.forEach((t) =>
    pendencias.push({
      tipo: "Divergência sem decisão",
      descricao: `${t.desc} — Aguardando aprovação comercial`,
      impeditiva: true,
    }),
  );
  const faltasPend = await db.prepare(`
    SELECT P.DESCRPROD as desc, F.ACAO, F.PRAZORETORNO
    FROM AD_FALTAITEM F JOIN TGFPRO P ON F.CODPROD = P.CODPROD
    WHERE F.NUNOTA=? AND F.STATUS IN ('PENDENTE','EM_TRATAMENTO')
  `).all(nunota) as any[];
  faltasPend.forEach((f) => {
    if (f.ACAO === "COMPRA_PADRAO" || f.ACAO === "APANHO") {
      pendencias.push({
        tipo: "Falta em compra",
        descricao: `${f.desc} — Aguardando retorno de ${f.ACAO === "APANHO" ? "apanho" : "compra padrão"}${f.PRAZORETORNO ? ` (prev. ${f.PRAZORETORNO.slice(11, 16)}h)` : ""}`,
        impeditiva: true,
      });
    }
  });

  res.json({
    pedidoResumo: cab,
    itensConformes,
    itensSubstituidos,
    itensFalta,
    itensFluxoDistinto,
    pendencias,
  });
});

/**
 * POST /api/pre-faturamento/:nunota/liberar
 * Libera o pedido para faturamento (só se não houver pendências)
 */
router.post("/:nunota/liberar", async (req, res) => {
  const db = getDb();
  const nunota = Number(req.params.nunota);

  const pend = await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM AD_TROCAITEM WHERE NUNOTA=? AND STATUS='PENDENTE') +
      (SELECT COUNT(*) FROM AD_FALTAITEM WHERE NUNOTA=? AND STATUS='PENDENTE') +
      (SELECT COUNT(*) FROM AD_FLUXODISTINTO WHERE NUNOTA=? AND STATUS='PENDENTE')
      AS pendencias
  `).get(nunota, nunota, nunota) as any;

  if (pend.pendencias > 0) {
    res.status(422).json({
      error: `Existem ${pend.pendencias} pendências impeditivas. Resolva-as antes de liberar.`,
    });
    return;
  }

  await db.prepare(`
    UPDATE TGFCAB
       SET STATUSNOTA='F', DTFATUR=datetime('now','localtime')
     WHERE NUNOTA=?
  `).run(nunota);
  res.json({ ok: true });
});

/**
 * GET /api/pre-faturamento — Lista pedidos disponíveis para conferência
 */
router.get("/", async (_req, res) => {
  const db = getDb();
  const rows = await db.prepare(`
    SELECT CAB.NUNOTA AS nunota, CAB.NUNNOTA AS id, PAR.NOMEPARC AS cliente,
           CAB.AD_STATUSSEP AS statusSep, CAB.STATUSNOTA AS statusNota,
           (${STATUS_PEDIDO_SQL}) AS statusPedido,
           (SELECT COUNT(*) FROM AD_TROCAITEM WHERE NUNOTA=CAB.NUNOTA AND STATUS='PENDENTE') +
           (SELECT COUNT(*) FROM AD_FALTAITEM WHERE NUNOTA=CAB.NUNOTA AND STATUS='PENDENTE') +
           (SELECT COUNT(*) FROM AD_FLUXODISTINTO WHERE NUNOTA=CAB.NUNOTA AND STATUS='PENDENTE')
             AS pendencias
    FROM TGFCAB CAB JOIN TGFPAR PAR ON CAB.CODPARC = PAR.CODPARC
    WHERE CAB.STATUSNOTA IN ('L','F','P')
    ORDER BY CAB.NUNOTA
  `).all();
  res.json(rows);
});

/**
 * POST /api/pre-faturamento/:nunota/devolver-ajuste
 */
router.post("/:nunota/devolver-ajuste", async (req, res) => {
  const db = getDb();
  const nunota = Number(req.params.nunota);
  const { motivo = "Devolvido pelo faturamento" } = req.body ?? {};
  const r = await db.prepare(`
    UPDATE TGFCAB SET AD_STATUSSEP = 'NAO_INICIADO' WHERE NUNOTA = ?
  `).run(nunota);
  if (r.changes === 0) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }
  res.json({ ok: true, motivo });
});

export default router;
