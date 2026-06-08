import { Router } from "express";
import { getDb } from "../db/index.js";
import { verifyPassword } from "../auth.js";

const router = Router();

const BASE = `
  SELECT
    F.NUFALTAITEM AS id, CAB.NUNOTA AS nunota, CAB.NUNNOTA AS pedido,
    CAB.ORDEMCARGA AS embarcacao, substr(ORD.DTPREVSAIDA, 12, 5) AS horario,
    PAR.NOMEPARC AS parceiro, P.DESCRPROD AS item, P.MARCA AS marca,
    ('PRD-' || printf('%06d', F.CODPROD)) AS codigo,
    F.QTDFALTA AS qtdFalta, F.STATUS AS statusFalta,
    COALESCE((SELECT SUM(QTD) FROM AD_APANHO_REG R WHERE R.NUFALTAITEM=F.NUFALTAITEM),0) AS qtdEncontrada,
    COALESCE((SELECT SUM(QTD) FROM AD_APANHO_REG R WHERE R.NUFALTAITEM=F.NUFALTAITEM AND R.CONFERIDO=1),0) AS qtdConferida,
    (SELECT R.LAT FROM AD_APANHO_REG R WHERE R.NUFALTAITEM=F.NUFALTAITEM AND R.LAT IS NOT NULL ORDER BY R.NUREG DESC LIMIT 1) AS ultimaLat,
    (SELECT R.LNG FROM AD_APANHO_REG R WHERE R.NUFALTAITEM=F.NUFALTAITEM AND R.LNG IS NOT NULL ORDER BY R.NUREG DESC LIMIT 1) AS ultimaLng
  FROM AD_FALTAITEM F
  JOIN TGFCAB CAB ON F.NUNOTA = CAB.NUNOTA
  JOIN TGFPAR PAR ON CAB.CODPARC = PAR.CODPARC
  JOIN TGFPRO P ON F.CODPROD = P.CODPROD
  LEFT JOIN TGFORD ORD ON CAB.ORDEMCARGA = ORD.ORDEMCARGA
  WHERE F.ACAO = 'APANHO'
`;

function statusDe(r: any): string {
  if (r.qtdConferida >= r.qtdFalta && r.qtdFalta > 0) return "concluido";
  if (r.qtdEncontrada >= r.qtdFalta && r.qtdFalta > 0) return "encontrado";
  if (r.qtdEncontrada > 0) return "parcial";
  return "pendente";
}

/** GET /api/apanho — lista de itens em apanho (mobile + acompanhamento) */
router.get("/", async (req, res) => {
  const db = getDb();
  const { embarcacao } = req.query;
  let sql = BASE; const params: any[] = [];
  if (embarcacao && embarcacao !== "todas") { sql += " AND CAB.ORDEMCARGA = ?"; params.push(embarcacao); }
  sql += " ORDER BY ORD.DTPREVSAIDA, P.DESCRPROD";
  const rows = await db.prepare(sql).all(...params) as any[];
  rows.forEach((r) => { r.qtdPendente = Math.max(0, Number(r.qtdFalta) - Number(r.qtdEncontrada)); r.status = statusDe(r); });
  res.json(rows);
});

/** GET /api/apanho/embarcacoes — para filtro */
router.get("/embarcacoes", async (_req, res) => {
  const rows = await getDb().prepare(`
    SELECT DISTINCT CAB.ORDEMCARGA AS value FROM AD_FALTAITEM F
    JOIN TGFCAB CAB ON F.NUNOTA=CAB.NUNOTA WHERE F.ACAO='APANHO' AND CAB.ORDEMCARGA IS NOT NULL
    ORDER BY CAB.ORDEMCARGA
  `).all();
  res.json(rows);
});

/** GET /api/apanho/conferencia — itens com registros pendentes de conferência */
router.get("/conferencia", async (_req, res) => {
  const rows = await getDb().prepare(
    BASE + " AND EXISTS(SELECT 1 FROM AD_APANHO_REG R WHERE R.NUFALTAITEM=F.NUFALTAITEM AND R.CONFERIDO=0) ORDER BY ORD.DTPREVSAIDA",
  ).all() as any[];
  rows.forEach((r) => { r.qtdPendente = Math.max(0, Number(r.qtdFalta) - Number(r.qtdEncontrada)); r.status = statusDe(r); });
  res.json(rows);
});

/** GET /api/apanho/registros/:id — registros de um item de falta */
router.get("/registros/:id", async (req, res) => {
  const rows = await getDb().prepare(`
    SELECT R.NUREG AS id, R.QTD AS qtd, R.LOTE AS lote, R.VALIDADE AS validade,
           R.DTREG AS dtReg, R.CONFERIDO AS conferido, U.NOMEUSU AS usuario,
           R.LAT AS lat, R.LNG AS lng, R.NFCHAVE AS nfChave, R.NFFOTO AS nfFoto
    FROM AD_APANHO_REG R LEFT JOIN TSIUSU U ON U.CODUSU = R.CODUSU
    WHERE R.NUFALTAITEM = ? ORDER BY R.NUREG
  `).all(Number(req.params.id));
  res.json(rows);
});

/** POST /api/apanho/:id/registrar  { qtd, lote?, validade? } — comprador em campo */
router.post("/:id/registrar", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { qtd, lote, validade, lat, lng, nfChave, nfFoto, nusessao } = (req.body ?? {}) as any;
  if (!qtd || Number(qtd) <= 0) { res.status(400).json({ error: "Quantidade encontrada inválida" }); return; }
  const falta = await db.prepare("SELECT 1 FROM AD_FALTAITEM WHERE NUFALTAITEM=?").get(id);
  if (!falta) { res.status(404).json({ error: "Item de falta não encontrado" }); return; }
  const u = (req as any).user;
  let codusu = u?.codusu ?? null;
  if (nusessao) {
    const ses = await db.prepare("SELECT CODUSU FROM AD_APANHO_SESSAO WHERE NUSESSAO=? AND STATUS='ABERTA'").get(Number(nusessao)) as any;
    if (ses) codusu = ses.CODUSU ?? codusu;
  }
  await db.prepare(
    "INSERT INTO AD_APANHO_REG (NUFALTAITEM, QTD, LOTE, VALIDADE, DTREG, CODUSU, CONFERIDO, LAT, LNG, NFCHAVE, NFFOTO, NUSESSAO) VALUES (?,?,?,?,datetime('now','localtime'),?,0,?,?,?,?,?)",
  ).run(id, Number(qtd), lote || null, validade || null, codusu,
        (typeof lat === "number" ? lat : null), (typeof lng === "number" ? lng : null),
        nfChave || null, nfFoto || null, nusessao ? Number(nusessao) : null);
  res.json({ ok: true });
});

/** POST /api/apanho/registro/:nureg/conferir  { lote?, validade? } — conferência na base */
router.post("/registro/:nureg/conferir", async (req, res) => {
  const db = getDb();
  const nureg = Number(req.params.nureg);
  const { lote, validade } = (req.body ?? {}) as any;
  const reg = await db.prepare("SELECT NUFALTAITEM FROM AD_APANHO_REG WHERE NUREG=?").get(nureg) as any;
  if (!reg) { res.status(404).json({ error: "Registro não encontrado" }); return; }
  const u = (req as any).user;
  await db.prepare(
    "UPDATE AD_APANHO_REG SET CONFERIDO=1, LOTE=COALESCE(?,LOTE), VALIDADE=COALESCE(?,VALIDADE), DTCONF=datetime('now','localtime'), CODUSUCONF=? WHERE NUREG=?",
  ).run(lote || null, validade || null, u?.codusu ?? null, nureg);
  const f = await db.prepare(`
    SELECT F.QTDFALTA AS qtdFalta,
           (SELECT SUM(QTD) FROM AD_APANHO_REG R WHERE R.NUFALTAITEM=F.NUFALTAITEM AND R.CONFERIDO=1) AS conf
    FROM AD_FALTAITEM F WHERE F.NUFALTAITEM=?
  `).get(reg.NUFALTAITEM) as any;
  let faltaBaixada = false;
  if (f && Number(f.conf) >= Number(f.qtdFalta)) {
    await db.prepare("UPDATE AD_FALTAITEM SET STATUS='RESOLVIDO' WHERE NUFALTAITEM=?").run(reg.NUFALTAITEM);
    faltaBaixada = true;
  }
  res.json({ ok: true, faltaBaixada });
});

/** GET /api/apanho/resumo — totais para a tela inicial (Secao 5.2) */
router.get("/resumo", async (_req, res) => {
  const r = await getDb().prepare(`
    SELECT COUNT(*) AS totalItens,
           COUNT(DISTINCT CAB.ORDEMCARGA) AS totalEmbarcacoes,
           COALESCE(SUM(F.QTDFALTA),0) AS totalUnidades
    FROM AD_FALTAITEM F JOIN TGFCAB CAB ON F.NUNOTA=CAB.NUNOTA
    WHERE F.ACAO='APANHO' AND F.STATUS <> 'RESOLVIDO'
  `).get();
  res.json(r);
});

/** GET /api/apanho/agrupado — itens agrupados por produto, com quebra por embarcacao (5.4/6.3) */
router.get("/agrupado", async (req, res) => {
  const db = getDb();
  const prods = await db.prepare(`
    SELECT P.CODPROD AS codprod, P.DESCRPROD AS item, P.MARCA AS marca, P.CONTROLELOTE AS controleLote,
           SUM(F.QTDFALTA) AS qtdFaltaTotal
    FROM AD_FALTAITEM F JOIN TGFPRO P ON F.CODPROD=P.CODPROD
    WHERE F.ACAO='APANHO' AND F.STATUS <> 'RESOLVIDO'
    GROUP BY P.CODPROD ORDER BY P.DESCRPROD
  `).all() as any[];
  const brkStmt = db.prepare(`
    SELECT F.NUFALTAITEM AS nufaltaitem, F.NUNOTA AS nunota, CAB.ORDEMCARGA AS embarcacao,
           PAR.NOMEPARC AS parceiro, F.QTDFALTA AS qtdFalta,
           COALESCE((SELECT SUM(QTD) FROM AD_APANHO_REG R WHERE R.NUFALTAITEM=F.NUFALTAITEM),0) AS qtdEncontrada
    FROM AD_FALTAITEM F JOIN TGFCAB CAB ON F.NUNOTA=CAB.NUNOTA JOIN TGFPAR PAR ON CAB.CODPARC=PAR.CODPARC
    WHERE F.ACAO='APANHO' AND F.STATUS <> 'RESOLVIDO' AND F.CODPROD=? ORDER BY CAB.ORDEMCARGA
  `);
  for (const p of prods) {
    p.embarcacoes = await brkStmt.all(p.codprod);
    p.qtdEncontradaTotal = (p.embarcacoes as any[]).reduce((a, e) => a + Number(e.qtdEncontrada || 0), 0);
    p.qtdPendenteTotal = Math.max(0, Number(p.qtdFaltaTotal) - p.qtdEncontradaTotal);
  }
  res.json(prods);
});

/** POST /api/apanho/sessao/iniciar { mercado, login, senha, lat, lng } (5.2) */
router.post("/sessao/iniciar", async (req, res) => {
  const db = getDb();
  const { mercado, login, senha, lat, lng } = (req.body ?? {}) as any;
  if (!mercado || String(mercado).trim().length < 2) { res.status(400).json({ error: "Informe o mercado/local da compra" }); return; }
  if (!login || !senha) { res.status(400).json({ error: "Informe login e senha" }); return; }
  const cred = await db.prepare(
    "SELECT L.CODUSU, L.SENHA, L.ATIVO, U.NOMEUSU FROM AD_LOGIN L JOIN TSIUSU U ON U.CODUSU=L.CODUSU WHERE LOWER(L.LOGIN)=LOWER(?)",
  ).get(login) as any;
  if (!cred || !cred.ATIVO || !verifyPassword(senha, cred.SENHA)) {
    res.status(401).json({ error: "Login ou senha invalidos" });
    return;
  }
  const r = await db.prepare(
    "INSERT INTO AD_APANHO_SESSAO (CODUSU, COMPRADOR, MERCADO, STATUS, LAT, LNG, DTINICIO, DTALTERLOC) VALUES (?,?,?,'ABERTA',?,?,datetime('now','localtime'),datetime('now','localtime'))",
  ).run(cred.CODUSU, cred.NOMEUSU, String(mercado).trim(),
        (typeof lat === "number" ? lat : null), (typeof lng === "number" ? lng : null));
  res.json({ ok: true, nusessao: r.lastInsertRowid, comprador: cred.NOMEUSU });
});

/** POST /api/apanho/sessao/:id/local { lat, lng } — heartbeat de localizacao (6.1) */
router.post("/sessao/:id/local", async (req, res) => {
  const { lat, lng } = (req.body ?? {}) as any;
  const r = await getDb().prepare(
    "UPDATE AD_APANHO_SESSAO SET LAT=?, LNG=?, DTALTERLOC=datetime('now','localtime') WHERE NUSESSAO=? AND STATUS='ABERTA'",
  ).run((typeof lat === "number" ? lat : null), (typeof lng === "number" ? lng : null), Number(req.params.id));
  res.json({ ok: r.changes > 0 });
});

/** POST /api/apanho/sessao/:id/finalizar { nfChave } — exige NF cobrindo a sessao (5.3) */
router.post("/sessao/:id/finalizar", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { nfChave } = (req.body ?? {}) as any;
  if (!nfChave || String(nfChave).trim().length < 3) { res.status(400).json({ error: "Informe a NF/cupom fiscal da sessao" }); return; }
  const ses = await db.prepare("SELECT 1 FROM AD_APANHO_SESSAO WHERE NUSESSAO=? AND STATUS='ABERTA'").get(id);
  if (!ses) { res.status(404).json({ error: "Sessao aberta nao encontrada" }); return; }
  await db.prepare("UPDATE AD_APANHO_REG SET NFCHAVE=COALESCE(NFCHAVE,?) WHERE NUSESSAO=?").run(String(nfChave).trim(), id);
  await db.prepare("UPDATE AD_APANHO_SESSAO SET STATUS='FINALIZADA', NFCHAVE=?, DTFIM=datetime('now','localtime') WHERE NUSESSAO=?").run(String(nfChave).trim(), id);
  res.json({ ok: true });
});

/** GET /api/apanho/compradores — sessoes abertas (localizacao + itens em sessao) p/ acompanhamento (6.1/6.2) */
router.get("/compradores", async (_req, res) => {
  const db = getDb();
  const sessoes = await db.prepare(`
    SELECT S.NUSESSAO AS nusessao, S.COMPRADOR AS comprador, S.MERCADO AS mercado,
           S.LAT AS lat, S.LNG AS lng, S.DTINICIO AS dtInicio, S.DTALTERLOC AS dtAlterLoc
    FROM AD_APANHO_SESSAO S WHERE S.STATUS='ABERTA' ORDER BY S.DTINICIO DESC
  `).all() as any[];
  const itStmt = db.prepare(`
    SELECT DISTINCT P.DESCRPROD AS item, P.MARCA AS marca
    FROM AD_APANHO_REG R JOIN AD_FALTAITEM F ON R.NUFALTAITEM=F.NUFALTAITEM JOIN TGFPRO P ON F.CODPROD=P.CODPROD
    WHERE R.NUSESSAO=? ORDER BY P.DESCRPROD
  `);
  for (const s of sessoes) s.itens = await itStmt.all(s.nusessao);
  // itens em apanho ainda nao encontrados (sem nenhum registro)
  const naoEncontrados = await db.prepare(`
    SELECT P.DESCRPROD AS item, P.MARCA AS marca, CAB.ORDEMCARGA AS embarcacao, F.QTDFALTA AS qtdFalta
    FROM AD_FALTAITEM F JOIN TGFCAB CAB ON F.NUNOTA=CAB.NUNOTA JOIN TGFPRO P ON F.CODPROD=P.CODPROD
    WHERE F.ACAO='APANHO' AND F.STATUS <> 'RESOLVIDO'
      AND NOT EXISTS(SELECT 1 FROM AD_APANHO_REG R WHERE R.NUFALTAITEM=F.NUFALTAITEM)
    ORDER BY P.DESCRPROD
  `).all();
  res.json({ sessoes, naoEncontrados });
});

export default router;
