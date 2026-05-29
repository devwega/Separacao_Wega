import { Router } from "express";
import { getDb } from "../db/index.js";

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
  const { qtd, lote, validade, lat, lng, nfChave, nfFoto } = (req.body ?? {}) as any;
  if (!qtd || Number(qtd) <= 0) { res.status(400).json({ error: "Quantidade encontrada inválida" }); return; }
  const falta = await db.prepare("SELECT 1 FROM AD_FALTAITEM WHERE NUFALTAITEM=?").get(id);
  if (!falta) { res.status(404).json({ error: "Item de falta não encontrado" }); return; }
  const u = (req as any).user;
  await db.prepare(
    "INSERT INTO AD_APANHO_REG (NUFALTAITEM, QTD, LOTE, VALIDADE, DTREG, CODUSU, CONFERIDO, LAT, LNG, NFCHAVE, NFFOTO) VALUES (?,?,?,?,datetime('now','localtime'),?,0,?,?,?,?)",
  ).run(id, Number(qtd), lote || null, validade || null, u?.codusu ?? null,
        (typeof lat === "number" ? lat : null), (typeof lng === "number" ? lng : null),
        nfChave || null, nfFoto || null);
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

export default router;
