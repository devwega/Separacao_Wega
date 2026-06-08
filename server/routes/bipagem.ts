import { Router } from "express";
import { getDb } from "../db/index.js";

const router = Router();

/**
 * POST /api/bipagem/validar-ean
 * Body: { nunota, sequencia, ean, lote?, validade? }
 */
router.post("/validar-ean", async (req, res) => {
  try {
    const db = getDb();
    const { nunota, sequencia, ean, lote, validade } = req.body as {
      nunota: number; sequencia: number; ean: string; lote?: string; validade?: string;
    };

    if (!nunota || !sequencia || !ean) {
      res.status(400).json({ error: "nunota, sequencia e ean são obrigatórios" });
      return;
    }

    const item = await db.prepare(`
      SELECT I.*, P.REFERENCIA AS eanEsperado, P.PRAZOVAL, P.DESCRPROD, P.CONTROLELOTE
      FROM TGFITE I JOIN TGFPRO P ON I.CODPROD = P.CODPROD
      WHERE I.NUNOTA = ? AND I.SEQUENCIA = ?
    `).get(nunota, sequencia) as any;

    if (!item) {
      res.status(404).json({ error: "Item do pedido não encontrado" });
      return;
    }

    let eanOk = false;
    let match: "principal" | "alternativo" | "gtinnfe" | null = null;
    let fatorConv = 1;
    let outroProduto: any = null;

    if (item.eanEsperado === ean) {
      eanOk = true; match = "principal";
    } else {
      const bar = await db.prepare(
        "SELECT CODPROD, QTDEMBALAGEM FROM TGFBAR WHERE CODBARRAS = ?",
      ).get(ean) as any;
      if (bar && bar.CODPROD === item.CODPROD) {
        eanOk = true; match = "alternativo"; fatorConv = bar.QTDEMBALAGEM;
      } else if (item.GTINNFE === ean) {
        eanOk = true; match = "gtinnfe";
      } else {
        outroProduto = await db.prepare("SELECT CODPROD, DESCRPROD FROM TGFPRO WHERE REFERENCIA = ?").get(ean);
      }
    }

    // RN-01: validade minima por parceiro (Secao 4). Fallback: padrao global / 30 dias.
    const cabRow = await db.prepare(
      "SELECT CAB.CODPARC AS codparc, V.DIASMIN AS diasMin FROM TGFITE I JOIN TGFCAB CAB ON CAB.NUNOTA=I.NUNOTA LEFT JOIN AD_VALIDADEMIN V ON V.CODPARC=CAB.CODPARC WHERE I.NUNOTA=? AND I.SEQUENCIA=?",
    ).get(nunota, sequencia) as any;
    let minParceiro = cabRow?.diasMin;
    if (minParceiro == null) {
      const g = await db.prepare("SELECT VALOR FROM AD_PARAM WHERE CHAVE='VALIDADE_MIN_GLOBAL'").get() as any;
      minParceiro = g ? Number(g.VALOR) : 30;
    }
    const minExigido = Math.max(Number(item.PRAZOVAL ?? 0), Number(minParceiro ?? 0));

    const loteOk = item.CONTROLELOTE ? !!(lote && lote.trim()) : true;

    let validadeOk = true;
    let shelfLifeOk = true;
    if (validade) {
      const dtVal = new Date(validade);
      const hoje = new Date();
      const diffDias = Math.ceil((dtVal.getTime() - hoje.getTime()) / 86400000);
      validadeOk = diffDias > 0;
      shelfLifeOk = diffDias >= minExigido;
    } else if (item.CONTROLELOTE) {
      validadeOk = false;
    }

    const equivalenciaOk = eanOk;

    res.json({
      ok: eanOk && loteOk && validadeOk && shelfLifeOk,
      match,
      fatorConv,
      outroProduto,
      motivo: !eanOk
        ? (outroProduto ? "EAN pertence a outro produto" : "EAN não encontrado")
        : !loteOk ? "Lote obrigatório para este produto"
        : !validadeOk ? "Validade obrigatória ou expirada"
        : !shelfLifeOk ? `Validade insuficiente (mínimo ${minExigido} dias para este parceiro)`
        : null,
      flags: { eanOk, loteOk, validadeOk, equivalenciaOk, shelfLifeOk },
      item: { DESCRPROD: item.DESCRPROD, CODPROD: item.CODPROD, QTDNEG: item.QTDNEG, PRAZOVAL: item.PRAZOVAL },
    });
  } catch (e: any) {
    console.error("[validar-ean] ERRO:", e?.message, e?.stack);
    res.status(500).json({ error: e?.message });
  }
});

/**
 * POST /api/bipagem/registrar-divergencia
 */
router.post("/registrar-divergencia", async (req, res) => {
  try {
    const db = getDb();
    const b = req.body as any;

    if (!b.codProdSubst || Number.isNaN(Number(b.codProdSubst))) {
      res.status(400).json({ error: "codProdSubst é obrigatório e numérico" });
      return;
    }

    const item = await db.prepare(
      "SELECT CODPROD, QTDNEG FROM TGFITE WHERE NUNOTA=? AND SEQUENCIA=?",
    ).get(b.nunota, b.sequencia) as any;
    if (!item) {
      res.status(404).json({ error: "Item do pedido não encontrado" });
      return;
    }

    const prodSubst = await db.prepare("SELECT CODPROD FROM TGFPRO WHERE CODPROD=?").get(Number(b.codProdSubst));
    if (!prodSubst) {
      res.status(400).json({ error: `Produto substituto ${b.codProdSubst} não cadastrado em TGFPRO` });
      return;
    }

    // HOMOLOGADA deriva do TIPO de divergência (não de um checkbox redundante):
    // "Marca não homologada" => 0; qualquer outro tipo com "homologada" => 1; demais => valor enviado.
    const tipoDiv = b.tipoDivergencia ?? "Marca homologada";
    const tipoLower = String(tipoDiv).toLowerCase();
    const homologada = /n[ãa]o homologada/.test(tipoLower)
      ? 0
      : (tipoLower.includes("homologada") ? 1 : (b.homologada ? 1 : 0));

    const r = await db.prepare(`
      INSERT INTO AD_TROCAITEM
        (NUNOTA, SEQUENCIA, CODPRODORIG, CODPRODSUBST, QTDORIG, QTDSUBST,
         TIPEQUIV, FATORCONV, MOTIVO, STATUS, HOMOLOGADA, NECESSIDADECLI, TIPODIVERG)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDENTE', ?, ?, ?)
    `).run(
      b.nunota, b.sequencia, item.CODPROD, Number(b.codProdSubst),
      item.QTDNEG, b.qtdSubst ?? item.QTDNEG,
      b.tipoEquiv ?? "EXATA", b.fatorConv ?? 1, b.motivo ?? "",
      homologada, b.necessidadeCliente ?? "Informar", tipoDiv,
    );
    res.json({ ok: true, nutrocaitem: r.lastInsertRowid });
  } catch (e: any) {
    console.error("[registrar-divergencia] ERRO:", e?.message, e?.stack);
    res.status(500).json({ error: e?.message });
  }
});

/**
 * POST /api/bipagem/registrar-falta
 */
router.post("/registrar-falta", async (req, res) => {
  try {
    const db = getDb();
    const b = req.body as any;
    const item = await db.prepare(
      "SELECT I.CODPROD, I.QTDNEG, CAB.ORDEMCARGA FROM TGFITE I JOIN TGFCAB CAB ON I.NUNOTA=CAB.NUNOTA WHERE I.NUNOTA=? AND I.SEQUENCIA=?",
    ).get(b.nunota, b.sequencia) as any;
    if (!item) {
      res.status(404).json({ error: "Item do pedido não encontrado" });
      return;
    }
    const ord = await db.prepare("SELECT DTPREVSAIDA FROM TGFORD WHERE ORDEMCARGA=?").get(item.ORDEMCARGA) as any;
    const r = await db.prepare(`
      INSERT INTO AD_FALTAITEM
        (NUNOTA, SEQUENCIA, CODPROD, QTDFALTA, TIPO, CRITICIDADE, STATUS, DTLIMITE, OBSERVACAO)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDENTE', ?, ?)
    `).run(
      b.nunota, b.sequencia, item.CODPROD,
      b.qtdFaltante, b.tipo ?? (b.qtdFaltante >= item.QTDNEG ? "total" : "parcial"),
      b.criticidade ?? "MEDIA", ord?.DTPREVSAIDA ?? null, b.observacao ?? null,
    );
    res.json({ ok: true, nufaltaitem: r.lastInsertRowid });
  } catch (e: any) {
    console.error("[registrar-falta] ERRO:", e?.message, e?.stack);
    res.status(500).json({ error: e?.message });
  }
});

/**
 * PUT /api/bipagem/conferir
 */
router.put("/conferir", async (req, res) => {
  try {
    const db = getDb();
    const { nunota, sequencia, qtdSeparada, lote, validade, lotes } = req.body as {
      nunota: number; sequencia: number; qtdSeparada?: number; lote?: string; validade?: string;
      lotes?: { lote?: string; validade?: string; qtd?: number }[];
    };

    const item = await db.prepare(
      "SELECT QTDNEG, CODPROD FROM TGFITE WHERE NUNOTA=? AND SEQUENCIA=?",
    ).get(nunota, sequencia) as any;
    if (!item) {
      res.status(404).json({ error: "Item não encontrado" });
      return;
    }

    // BS-2.6: múltiplos lotes/validade. Se vier `lotes`, a qtd separada é a soma e o
    // CONTROLE principal do item passa a ser o primeiro lote informado.
    const lotesValidos = Array.isArray(lotes)
      ? lotes.filter((l) => (l?.qtd ?? 0) > 0 || (l?.lote && l.lote.trim()))
      : [];
    const usaMultiplos = lotesValidos.length > 0;
    const qtdFinal = usaMultiplos
      ? lotesValidos.reduce((s, l) => s + (Number(l.qtd) || 0), 0)
      : Number(qtdSeparada);
    const lotePrincipal = usaMultiplos ? (lotesValidos[0].lote || null) : (lote || null);

    const pendente = qtdFinal >= item.QTDNEG ? "N" : "S";

    await db.prepare(`
      UPDATE TGFITE
         SET QTDENTREGUE = ?, QTDCONFERIDA = ?, CONTROLE = COALESCE(?, CONTROLE), PENDENTE = ?, STATUSLOTE='P'
       WHERE NUNOTA = ? AND SEQUENCIA = ?
    `).run(qtdFinal, qtdFinal, lotePrincipal, pendente, nunota, sequencia);

    // Regrava os lotes do item (substitui os anteriores) em AD_ITEMLOTE.
    await db.prepare("DELETE FROM AD_ITEMLOTE WHERE NUNOTA=? AND SEQUENCIA=? AND CODEMBARC IS NULL").run(nunota, sequencia);
    const linhas = usaMultiplos
      ? lotesValidos
      : (lotePrincipal || validade ? [{ lote: lotePrincipal ?? undefined, validade, qtd: qtdFinal }] : []);
    for (const l of linhas) {
      await db.prepare(
        "INSERT INTO AD_ITEMLOTE (NUNOTA, SEQUENCIA, LOTE, VALIDADE, QTD) VALUES (?, ?, ?, ?, ?)",
      ).run(nunota, sequencia, l.lote || null, l.validade || null, Number(l.qtd) || 0);
    }

    const prog = await db.prepare(`
      SELECT COUNT(*) AS total, SUM(CASE WHEN PENDENTE='N' THEN 1 ELSE 0 END) AS conformes
      FROM TGFITE WHERE NUNOTA = ?
    `).get(nunota) as any;
    const perc = prog.total ? Math.round((prog.conformes / prog.total) * 100) : 0;
    await db.prepare("UPDATE TGFCAB SET AD_PERCPROGRESSO=?, AD_STATUSSEP=? WHERE NUNOTA=?")
      .run(perc, perc === 100 ? "CONCLUIDO" : "EM_ANDAMENTO", nunota);

    await db.prepare(`
      INSERT OR REPLACE INTO AD_SEPARACAO (NUNOTA, STATUS, PERCPROGRESSO, CODUSU, DTINICIO)
      VALUES (?, ?, ?, COALESCE((SELECT CODUSU FROM AD_SEPARACAO WHERE NUNOTA=?), 1),
              COALESCE((SELECT DTINICIO FROM AD_SEPARACAO WHERE NUNOTA=?), datetime('now','localtime')))
    `).run(nunota, perc === 100 ? "CONCLUIDO" : "EM_ANDAMENTO", perc, nunota, nunota);

    res.json({ ok: true, percProgresso: perc });
  } catch (e: any) {
    console.error("[conferir] ERRO:", e?.message, e?.stack);
    res.status(500).json({ error: e?.message });
  }
});

/**
 * GET /api/bipagem/saldo/:codprod
 */
router.get("/saldo/:codprod", async (req, res) => {
  try {
    const db = getDb();
    const codprod = Number(req.params.codprod);
    const rows = await db.prepare(`
      SELECT E.CODLOCAL, L.DESCRLOCAL, E.CONTROLE AS lote, E.ESTOQUE, E.RESERVADO,
             (E.ESTOQUE - E.RESERVADO) AS disponivel, E.DTVAL AS dtVal, E.DTFAB AS dtFab
      FROM TGFEST E JOIN TGFLOC L ON E.CODLOCAL = L.CODLOCAL
      WHERE E.CODPROD = ?
    `).all(codprod);
    res.json(rows);
  } catch (e: any) {
    console.error