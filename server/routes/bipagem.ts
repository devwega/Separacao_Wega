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
    const { nunota, sequencia, ean, lote, validade, codprod } = req.body as {
      nunota: number; sequencia: number; ean: string; lote?: string; validade?: string; codprod?: number;
    };

    if (!nunota || !sequencia || !ean) {
      res.status(400).json({ error: "nunota, sequencia e ean são obrigatórios" });
      return;
    }

    const item = await db.prepare(`
      SELECT I.*, P.REFERENCIA AS eanEsperado, P.PRAZOVAL, P.DESCRPROD, P.CONTROLELOTE, P.LOCALIZACAO, P.MARCA
      FROM TGFITE I JOIN TGFPRO P ON I.CODPROD = P.CODPROD
      WHERE I.NUNOTA = ? AND I.SEQUENCIA = ?
    `).get(nunota, sequencia) as any;

    if (!item) {
      res.status(404).json({ error: "Item do pedido não encontrado" });
      return;
    }

    // Item 5 (BS-2.2): no fluxo distinto, a remessa de SAÍDA valida o item FÍSICO
    // (codprod override), não o item da linha do pedido. Sem override, valida a própria linha.
    let alvo: any = {
      CODPROD: item.CODPROD, eanEsperado: item.eanEsperado, PRAZOVAL: item.PRAZOVAL,
      CONTROLELOTE: item.CONTROLELOTE, LOCALIZACAO: item.LOCALIZACAO, DESCRPROD: item.DESCRPROD, MARCA: item.MARCA,
    };
    if (codprod && Number(codprod) !== item.CODPROD) {
      const po = await db.prepare(
        "SELECT CODPROD, REFERENCIA AS eanEsperado, PRAZOVAL, CONTROLELOTE, LOCALIZACAO, DESCRPROD, MARCA FROM TGFPRO WHERE CODPROD = ?",
      ).get(Number(codprod)) as any;
      if (po) alvo = po;
    }

    let eanOk = false;
    let match: "principal" | "alternativo" | "gtinnfe" | null = null;
    let fatorConv = 1;
    let outroProduto: any = null;
    // RN-marca: o EAN bipado tem que corresponder ao item E à MARCA solicitada.
    // A marca só existe no nível do produto (TGFPRO), e o EAN principal (REFERENCIA) é o
    // da marca cadastrada. EANs alternativos (TGFBAR) costumam ser de OUTRAS marcas — por
    // isso só são conformes se o comercial já aprovou a divergência de marca para o item.
    let marcaOk = true;

    if (alvo.eanEsperado === ean) {
      eanOk = true; match = "principal";
    } else if (item.GTINNFE === ean) {
      eanOk = true; match = "gtinnfe";
    } else {
      const bar = await db.prepare(
        "SELECT CODPROD, QTDEMBALAGEM FROM TGFBAR WHERE CODBARRAS = ?",
      ).get(ean) as any;
      if (bar && bar.CODPROD === alvo.CODPROD) {
        // Marca diferente já aprovada para este item: troca aprovada pelo comercial OU
        // fluxo distinto aprovado pelo gestor com este produto como item físico (BS-2.2).
        const aprov = await db.prepare(
          "SELECT 1 FROM AD_TROCAITEM WHERE NUNOTA=? AND SEQUENCIA=? AND CODPRODSUBST=? AND STATUS='APROVADO'",
        ).get(nunota, sequencia, alvo.CODPROD)
          ?? await db.prepare(
            "SELECT 1 FROM AD_FLUXODISTINTO WHERE NUNOTA=? AND SEQUENCIA=? AND CODPRODFISICO=? AND STATUS='APROVADO'",
          ).get(nunota, sequencia, alvo.CODPROD);
        if (aprov) {
          eanOk = true; match = "alternativo"; fatorConv = bar.QTDEMBALAGEM;
        } else {
          // marca/variação diferente da solicitada → divergência para aprovação comercial
          marcaOk = false; fatorConv = bar.QTDEMBALAGEM;
          outroProduto = { CODPROD: alvo.CODPROD, DESCRPROD: alvo.DESCRPROD, MARCA: alvo.MARCA, alternativo: true };
        }
      } else if (bar) {
        // EAN cadastrado para OUTRO produto (item/marca diferente) → divergência
        outroProduto = await db.prepare("SELECT CODPROD, DESCRPROD, MARCA FROM TGFPRO WHERE CODPROD = ?").get(bar.CODPROD);
      } else {
        outroProduto = await db.prepare("SELECT CODPROD, DESCRPROD, MARCA FROM TGFPRO WHERE REFERENCIA = ?").get(ean);
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
    const minExigido = Math.max(Number(alvo.PRAZOVAL ?? 0), Number(minParceiro ?? 0));

    const loteOk = alvo.CONTROLELOTE ? !!(lote && lote.trim()) : true;

    // Item 4: itens do LOCAL FLV (10400000) não têm validação de validade / shelf life.
    const isFLV = String(alvo.LOCALIZACAO ?? "").trim().toUpperCase() === "FLV";

    let validadeOk = true;
    let shelfLifeOk = true;
    if (!isFLV) {
      if (validade) {
        const dtVal = new Date(validade);
        const hoje = new Date();
        const diffDias = Math.ceil((dtVal.getTime() - hoje.getTime()) / 86400000);
        validadeOk = diffDias > 0;
        shelfLifeOk = diffDias >= minExigido;
      } else if (alvo.CONTROLELOTE) {
        validadeOk = false;
      }
      // Item 3: se já existe uma exceção de validade APROVADA pelo comercial para este
      // item, libera o shelf life abaixo do mínimo (evita reenvio em loop após aprovação).
      if (shelfLifeOk === false) {
        const ex = await db.prepare(
          "SELECT 1 FROM AD_TROCAITEM WHERE NUNOTA=? AND SEQUENCIA=? AND STATUS='APROVADO' AND LOWER(TIPODIVERG) LIKE '%validade%'",
        ).get(nunota, sequencia);
        if (ex) shelfLifeOk = true;
      }
    }

    const equivalenciaOk = eanOk;

    res.json({
      ok: eanOk && marcaOk && loteOk && validadeOk && shelfLifeOk,
      match,
      flv: isFLV,
      fatorConv,
      outroProduto,
      motivo: !marcaOk
        ? "EAN de marca diferente da solicitada — registre divergência para aprovação"
        : !eanOk
        ? (outroProduto ? "EAN pertence a outro produto" : "EAN não encontrado")
        : !loteOk ? "Lote obrigatório para este produto"
        : !validadeOk ? "Validade obrigatória ou expirada"
        : !shelfLifeOk ? `Validade insuficiente (mínimo ${minExigido} dias para este parceiro)`
        : null,
      flags: { eanOk, marcaOk, loteOk, validadeOk, equivalenciaOk, shelfLifeOk },
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
    const { nunota, sequencia, qtdSeparada, lote, validade, lotes } = req.body as any;

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

    // AH-02: rejeita quantidade nula ou <= 0 (considerando a soma dos lotes).
    if (qtdFinal == null || Number.isNaN(Number(qtdFinal)) || Number(qtdFinal) <= 0) {
      res.status(400).json({ error: "qtdSeparada deve ser maior que zero" });
      return;
    }

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
    console.error("[saldo] ERRO:", e?.message, e?.stack);
    res.status(500).json({ error: e?.message });
  }
});

/**
 * POST /api/bipagem/estornar-item  { nunota, sequencia }  (BS-12)
 * Estorna a separacao de UM item: volta para pendente e recalcula o progresso.
 */
router.post("/estornar-item", async (req, res) => {
  try {
    const db = getDb();
    const { nunota, sequencia } = req.body as any;
    const r = await db.prepare(
      "UPDATE TGFITE SET QTDENTREGUE=0, QTDCONFERIDA=0, PENDENTE='S', CONTROLE='', STATUSLOTE='A' WHERE NUNOTA=? AND SEQUENCIA=?",
    ).run(nunota, sequencia);
    if (r.changes === 0) { res.status(404).json({ error: "Item não encontrado" }); return; }
    const prog = await db.prepare(
      "SELECT COUNT(*) AS total, SUM(CASE WHEN PENDENTE='N' THEN 1 ELSE 0 END) AS conformes FROM TGFITE WHERE NUNOTA=?",
    ).get(nunota) as any;
    const perc = prog.total ? Math.round((prog.conformes / prog.total) * 100) : 0;
    await db.prepare("UPDATE TGFCAB SET AD_PERCPROGRESSO=?, AD_STATUSSEP=? WHERE NUNOTA=?")
      .run(perc, perc === 0 ? "NAO_INICIADO" : (perc === 100 ? "CONCLUIDO" : "EM_ANDAMENTO"), nunota);
    res.json({ ok: true, percProgresso: perc });
  } catch (e: any) {
    console.error("[estornar-item] ERRO:", e?.message);
    res.status(500).json({ error: e?.message });
  }
});

/**
 * POST /api/bipagem/registrar-remessa-fluxo  (BS-2.2)
 * Registra a bipagem de uma das remessas do fluxo distinto:
 *   tipo=ENTRADA -> item do pedido/NF (simples remessa de entrada)
 *   tipo=SAIDA   -> item físico enviado (simples remessa de saída)
 * Quando ENTRADA e SAIDA estão registradas, o item do pedido é dado como conferido.
 */
router.post("/registrar-remessa-fluxo", async (req, res) => {
  try {
    const db = getDb();
    const b = req.body as any;
    const tipo = b.tipo === "SAIDA" ? "SAIDA" : "ENTRADA";
    if (!b.nufluxodist) { res.status(400).json({ error: "nufluxodist obrigatório" }); return; }
    const fd = await db.prepare(
      "SELECT NUNOTA, SEQUENCIA, CODPRODNF, CODPRODFISICO FROM AD_FLUXODISTINTO WHERE NUFLUXODIST=?",
    ).get(Number(b.nufluxodist)) as any;
    if (!fd) { res.status(404).json({ error: "Fluxo distinto não encontrado" }); return; }
    const qtd = Number(b.qtd) || 0;
    if (qtd <= 0) { res.status(400).json({ error: "Quantidade deve ser maior que zero" }); return; }
    const codprod = tipo === "ENTRADA" ? fd.CODPRODNF : fd.CODPRODFISICO;

    await db.prepare("DELETE FROM AD_FLUXOREMESSA WHERE NUFLUXODIST=? AND TIPO=?").run(Number(b.nufluxodist), tipo);
    await db.prepare(`
      INSERT INTO AD_FLUXOREMESSA (NUFLUXODIST, TIPO, CODPROD, EAN, LOTE, VALIDADE, QTD, CODUSU)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(Number(b.nufluxodist), tipo, codprod, b.ean || null, b.lote || null, b.validade || null, qtd, b.codusu ?? null);

    const ent = await db.prepare("SELECT QTD FROM AD_FLUXOREMESSA WHERE NUFLUXODIST=? AND TIPO='ENTRADA'").get(Number(b.nufluxodist)) as any;
    const sai = await db.prepare("SELECT QTD FROM AD_FLUXOREMESSA WHERE NUFLUXODIST=? AND TIPO='SAIDA'").get(Number(b.nufluxodist)) as any;
    let itemConferido = false;
    if (ent && sai) {
      await db.prepare(
        "UPDATE TGFITE SET QTDENTREGUE=?, QTDCONFERIDA=?, PENDENTE='N', STATUSLOTE='P' WHERE NUNOTA=? AND SEQUENCIA=?",
      ).run(ent.QTD, ent.QTD, fd.NUNOTA, fd.SEQUENCIA);
      const prog = await db.prepare(
        "SELECT COUNT(*) AS total, SUM(CASE WHEN PENDENTE='N' THEN 1 ELSE 0 END) AS conformes FROM TGFITE WHERE NUNOTA=?",
      ).get(fd.NUNOTA) as any;
      const perc = prog.total ? Math.round((prog.conformes / prog.total) * 100) : 0;
      await db.prepare("UPDATE TGFCAB SET AD_PERCPROGRESSO=?, AD_STATUSSEP=? WHERE NUNOTA=?")
        .run(perc, perc === 100 ? "CONCLUIDO" : "EM_ANDAMENTO", fd.NUNOTA);
      itemConferido = true;
    }
    res.json({ ok: true, tipo, itemConferido });
  } catch (e: any) {
    console.error("[registrar-remessa-fluxo] ERRO:", e?.message, e?.stack);
    res.status(500).json({ error: e?.message });
  }
});

export default router;
