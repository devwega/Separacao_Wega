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

/**
 * GET /api/apanho/sessoes-conferencia — conferência consolidada POR SESSÃO.
 * Sessões com registros pendentes de conferência + itens de cada sessão
 * (separados por embarcação no frontend). Registros sem sessão vêm em `avulsos`.
 */
router.get("/sessoes-conferencia", async (_req, res) => {
  const db = getDb();
  const sessoes = await db.prepare(`
    SELECT S.NUSESSAO AS nusessao, S.COMPRADOR AS comprador, S.MERCADO AS mercado,
           S.STATUS AS statusSessao, S.NFCHAVE AS nfChave, S.NFFOTO AS nfFoto,
           S.DTINICIO AS dtInicio, S.DTFIM AS dtFim
    FROM AD_APANHO_SESSAO S
    WHERE EXISTS(SELECT 1 FROM AD_APANHO_REG R WHERE R.NUSESSAO=S.NUSESSAO AND R.CONFERIDO=0)
    ORDER BY S.DTINICIO DESC
  `).all() as any[];
  const itensStmt = db.prepare(`
    SELECT R.NUREG AS nureg, R.QTD AS qtd, R.LOTE AS lote, R.VALIDADE AS validade, R.DTREG AS dtReg,
           F.NUFALTAITEM AS nufaltaitem, F.NUNOTA AS nunota, F.SEQUENCIA AS sequencia,
           F.CODPROD AS codprod, F.QTDFALTA AS qtdFalta,
           CAB.ORDEMCARGA AS embarcacao, CAB.NUNNOTA AS pedido, PAR.NOMEPARC AS parceiro,
           P.DESCRPROD AS item, P.MARCA AS marca, P.REFERENCIA AS ean
    FROM AD_APANHO_REG R
    JOIN AD_FALTAITEM F ON R.NUFALTAITEM = F.NUFALTAITEM
    JOIN TGFCAB CAB ON F.NUNOTA = CAB.NUNOTA
    JOIN TGFPAR PAR ON CAB.CODPARC = PAR.CODPARC
    JOIN TGFPRO P ON F.CODPROD = P.CODPROD
    WHERE R.CONFERIDO = 0 AND R.NUSESSAO IS ?
    ORDER BY CAB.ORDEMCARGA, P.DESCRPROD, R.NUREG
  `);
  for (const s of sessoes) s.itens = await itensStmt.all(s.nusessao);
  const avulsos = await itensStmt.all(null);
  res.json({ sessoes, avulsos });
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

/**
 * POST /api/apanho/registro/:nureg/conferir  { qtd?, lote?, validade?, substituir? }
 * Conferência na base. Quando `substituir=true`, os valores informados na conferência
 * SUBSTITUEM os digitados pelo comprador em campo. A conferência atualiza o item do
 * pedido (TGFITE/AD_ITEMLOTE) — refletido na tela BIPE Separação como
 * "Separado e conferido por apanho".
 */
router.post("/registro/:nureg/conferir", async (req, res) => {
  const db = getDb();
  const nureg = Number(req.params.nureg);
  const { qtd, lote, validade, substituir } = (req.body ?? {}) as any;
  const reg = await db.prepare(
    "SELECT NUFALTAITEM, QTD, LOTE, VALIDADE, CONFERIDO FROM AD_APANHO_REG WHERE NUREG=?",
  ).get(nureg) as any;
  if (!reg) { res.status(404).json({ error: "Registro não encontrado" }); return; }
  if (reg.CONFERIDO) { res.status(409).json({ error: "Registro já conferido" }); return; }
  const u = (req as any).user;

  // substituir=true: valores da conferência sobrescrevem o registro do comprador
  const qtdFinal = substituir && Number(qtd) > 0 ? Number(qtd) : Number(reg.QTD);
  const loteFinal = substituir ? (lote || null) : (reg.LOTE ?? lote ?? null);
  const valFinal = substituir ? (validade || null) : (reg.VALIDADE ?? validade ?? null);

  await db.prepare(`
    UPDATE AD_APANHO_REG
       SET CONFERIDO=1, QTD=?, LOTE=?, VALIDADE=?,
           DTCONF=datetime('now','localtime'), CODUSUCONF=?
     WHERE NUREG=?
  `).run(qtdFinal, loteFinal, valFinal, u?.codusu ?? null, nureg);

  const f = await db.prepare(`
    SELECT F.NUNOTA, F.SEQUENCIA, F.QTDFALTA AS qtdFalta,
           (SELECT SUM(QTD) FROM AD_APANHO_REG R WHERE R.NUFALTAITEM=F.NUFALTAITEM AND R.CONFERIDO=1) AS conf
    FROM AD_FALTAITEM F WHERE F.NUFALTAITEM=?
  `).get(reg.NUFALTAITEM) as any;

  // Atualiza o item do pedido (campos visíveis no BIPE): quantidade conferida, lote e
  // o detalhamento por lote em AD_ITEMLOTE.
  await db.prepare(
    "INSERT INTO AD_ITEMLOTE (NUNOTA, SEQUENCIA, LOTE, VALIDADE, QTD) VALUES (?, ?, ?, ?, ?)",
  ).run(f.NUNOTA, f.SEQUENCIA, loteFinal, valFinal, qtdFinal);
  await db.prepare(`
    UPDATE TGFITE
       SET QTDENTREGUE = QTDENTREGUE + ?, QTDCONFERIDA = QTDCONFERIDA + ?,
           CONTROLE = COALESCE(NULLIF(?, ''), CONTROLE), STATUSLOTE='P'
     WHERE NUNOTA = ? AND SEQUENCIA = ?
  `).run(qtdFinal, qtdFinal, loteFinal, f.NUNOTA, f.SEQUENCIA);

  let faltaBaixada = false;
  if (f && Number(f.conf) >= Number(f.qtdFalta)) {
    // Apanho concluído: marca o horário da conferência (DTRESOLUCAO) — o item sai da
    // tela de Faltas e Apanho e fica disponível apenas via filtro "Concluídos".
    await db.prepare(
      "UPDATE AD_FALTAITEM SET STATUS='RESOLVIDO', DTRESOLUCAO=datetime('now','localtime') WHERE NUFALTAITEM=?",
    ).run(reg.NUFALTAITEM);
    await db.prepare("UPDATE TGFITE SET PENDENTE='N' WHERE NUNOTA=? AND SEQUENCIA=?").run(f.NUNOTA, f.SEQUENCIA);
    const prog = await db.prepare(
      "SELECT COUNT(*) AS total, SUM(CASE WHEN PENDENTE='N' THEN 1 ELSE 0 END) AS conformes FROM TGFITE WHERE NUNOTA=?",
    ).get(f.NUNOTA) as any;
    const perc = prog.total ? Math.round((prog.conformes / prog.total) * 100) : 0;
    await db.prepare("UPDATE TGFCAB SET AD_PERCPROGRESSO=?, AD_STATUSSEP=? WHERE NUNOTA=?")
      .run(perc, perc === 100 ? "CONCLUIDO" : "EM_ANDAMENTO", f.NUNOTA);
    faltaBaixada = true;
  }
  res.json({ ok: true, faltaBaixada, substituido: !!substituir });
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
    SELECT F.NUFALTAITEM AS nufaltaitem, F.NUNOTA AS nunota, F.SEQUENCIA AS sequencia,
           CAB.ORDEMCARGA AS embarcacao,
           PAR.NOMEPARC AS parceiro, F.QTDFALTA AS qtdFalta,
           substr(F.PRAZORETORNO, 12, 5) AS previsao,
           COALESCE((SELECT SUM(QTD) FROM AD_APANHO_REG R WHERE R.NUFALTAITEM=F.NUFALTAITEM),0) AS qtdEncontrada
    FROM AD_FALTAITEM F JOIN TGFCAB CAB ON F.NUNOTA=CAB.NUNOTA JOIN TGFPAR PAR ON CAB.CODPARC=PAR.CODPARC
    WHERE F.ACAO='APANHO' AND F.STATUS <> 'RESOLVIDO' AND F.CODPROD=? ORDER BY CAB.ORDEMCARGA
  `);
  const lotesStmt = db.prepare(
    "SELECT LOTE AS lote, VALIDADE AS validade, QTD AS qtd FROM AD_APANHO_REG WHERE NUFALTAITEM=? ORDER BY NUREG",
  );
  for (const p of prods) {
    p.embarcacoes = await brkStmt.all(p.codprod) as any[];
    for (const e of p.embarcacoes as any[]) e.lotes = await lotesStmt.all(e.nufaltaitem);
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

/** POST /api/apanho/sessao/:id/finalizar { nfChave, nfFoto? } — exige NF cobrindo a sessao (5.3) */
router.post("/sessao/:id/finalizar", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { nfChave, nfFoto } = (req.body ?? {}) as any;
  if (!nfChave || String(nfChave).trim().length < 3) { res.status(400).json({ error: "Informe a NF/cupom fiscal da sessao" }); return; }
  const ses = await db.prepare("SELECT 1 FROM AD_APANHO_SESSAO WHERE NUSESSAO=? AND STATUS='ABERTA'").get(id);
  if (!ses) { res.status(404).json({ error: "Sessao aberta nao encontrada" }); return; }
  await db.prepare("UPDATE AD_APANHO_REG SET NFCHAVE=COALESCE(NFCHAVE,?), NFFOTO=COALESCE(NFFOTO,?) WHERE NUSESSAO=?")
    .run(String(nfChave).trim(), nfFoto || null, id);
  await db.prepare("UPDATE AD_APANHO_SESSAO SET STATUS='FINALIZADA', NFCHAVE=?, NFFOTO=?, DTFIM=datetime('now','localtime') WHERE NUSESSAO=?")
    .run(String(nfChave).trim(), nfFoto || null, id);
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
