/**
 * Seed do banco SQLite — popula com os dados que os mocks das pages mostravam,
 * agora persistidos em tabelas fiéis ao Sankhya Om.
 */
import { getDb, resetDb } from "./index.js";

/**
 * Cria/atualiza pedidos de demonstração que cobrem os 10 estados da spec seção 8.
 * Idempotente — chamado a cada boot para garantir variedade visual.
 */
export function seedDemoStatusVariants() {
  const db = getDb();
  // Só roda se já houver seed básico
  const has = db.prepare("SELECT COUNT(*) as c FROM TGFPAR WHERE CODPARC=1001").get() as any;
  if (has.c === 0) return;

  const cab = db.prepare(`
    INSERT OR IGNORE INTO TGFCAB
      (NUNOTA, NUNNOTA, CODPARC, CODVEND, CODTIPOPER, DHTIPOPER, DTNEG, VLRNOTA,
       STATUSNOTA, STATUSNFE, ORDEMCARGA, AD_PRIORIDADE, AD_STATUSSEP, AD_PERCPROGRESSO, AD_CODUSUSEP, DTFATUR)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const ite = db.prepare(`
    INSERT OR IGNORE INTO TGFITE
      (NUNOTA, SEQUENCIA, CODPROD, CODVOL, QTDNEG, QTDENTREGUE, QTDCONFERIDA, VLRUNIT, VLRTOT,
       CONTROLE, STATUSLOTE, PENDENTE, RESERVA)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const hoje = new Date().toISOString().slice(0, 10);

  // 193 — LANCADO (status nota = P, ainda não liberado)
  cab.run(193, "PV-2024-00193", 1001, 101, 1100, "2026-01-01", hoje, 3200,
    "P", null, "EMB-042", "BAIXA", "NAO_INICIADO", 0, null, null);
  ite.run(193, 1, 1245, "UN", 20, 0, 0, 15.5, 310, "", "A", "S", "N");

  // 194 — FATURADO (já saiu, com DTFATUR)
  cab.run(194, "PV-2024-00194", 1002, 102, 1100, "2026-01-01", hoje, 7800,
    "F", "A", "EMB-044", "MEDIA", "CONCLUIDO", 100, 4, `${hoje} 12:00:00`);
  ite.run(194, 1, 1100, "UN", 50, 50, 50, 14.5, 725, "L2024-0451", "P", "N", "S");
  ite.run(194, 2, 1245, "UN", 30, 30, 30, 15.5, 465, "L2024-0451", "P", "N", "S");
}

export function seed({ reset = false }: { reset?: boolean } = {}) {
  if (reset) resetDb();
  const db = getDb();

  // Idempotência: se já tem dados, não re-seedar
  const existing = db.prepare("SELECT COUNT(*) as c FROM TGFCAB").get() as { c: number };
  if (existing.c > 0 && !reset) {
    console.log(`[seed] banco já populado (${existing.c} pedidos) — skip`);
    return;
  }

  console.log("[seed] populando banco…");

  db.transaction(() => {
    // ------------------------------------------------------------ Usuários
    const insUsu = db.prepare(
      "INSERT OR REPLACE INTO TSIUSU (CODUSU, NOMEUSU, CODGRUPO, PERFIL) VALUES (?, ?, ?, ?)",
    );
    insUsu.run(1, "Carlos Silva", 1, "SEPARADOR");
    insUsu.run(2, "Maria Santos", 2, "COMERCIAL");
    insUsu.run(3, "Ana Oliveira", 2, "COMERCIAL");
    insUsu.run(4, "João Pereira", 1, "SEPARADOR");
    insUsu.run(5, "Roberto Gerente", 4, "GERENTE");
    insUsu.run(6, "Patrícia Lima", 3, "SUPERVISOR");

    // ------------------------------------------------------------ Grupos
    const insGru = db.prepare(
      "INSERT OR REPLACE INTO TGFGRU (CODGRUPOPROD, DESCRGRUPOPROD) VALUES (?, ?)",
    );
    insGru.run(1, "Aves Congeladas");
    insGru.run(2, "Embutidos");
    insGru.run(3, "Bovinos");
    insGru.run(4, "Suínos");
    insGru.run(5, "Laticínios");

    // ------------------------------------------------------------ Produtos
    const insPro = db.prepare(`
      INSERT OR REPLACE INTO TGFPRO
        (CODPROD, DESCRPROD, REFERENCIA, MARCA, CODGRUPOPROD, CODVOL, PRAZOVAL, LOCALIZACAO, ALERTAESTMIN, CONTROLELOTE)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const produtos = [
      [1245, "Filé de Frango Congelado 1kg", "7891234567890", "Sadia", 1, "UN", 90, "A-12-03", 100, 1],
      [1246, "Peito de Frango Bandeja 600g", "7891234567891", "Sadia", 1, "UN", 30, "A-12-04", 50, 1],
      [1300, "Linguiça Toscana 500g - Marca A", "7891234567892", "Aurora", 2, "UN", 60, "B-04-01", 80, 1],
      [1301, "Linguiça Toscana 500g - Marca B", "7891234567902", "Seara", 2, "UN", 60, "B-04-02", 80, 1],
      [1455, "Hambúrguer Bovino 56g cx c/36", "7891234567893", "Sadia", 3, "CX", 180, "C-08-01", 30, 1],
      [1456, "Hambúrguer Bovino 56g cx c/12", "7891234567903", "Sadia", 3, "CX", 180, "C-08-02", 30, 1],
      [1500, "Salsicha Hot Dog 3kg - Premium", "7891234567894", "Perdigão", 2, "KG", 120, "B-05-01", 60, 1],
      [1502, "Salsicha Hot Dog 3kg - Standard", "7891234567904", "Friboi", 2, "KG", 120, "B-05-02", 60, 1],
      [1612, "Mortadela Bologna 3,5kg", "7891234567895", "Sadia", 2, "KG", 90, "B-06-01", 20, 1],
      [1620, "Presunto Cozido Fatiado 200g", "7891234567896", "Seara", 2, "UN", 30, "B-07-01", 100, 1],
      [1700, "Peito de Peru Defumado 3,5kg", "7891234567897", "Aurora", 1, "KG", 120, "A-15-01", 15, 1],
      [1701, "Peito de Peru Defumado 4kg", "7891234567907", "Aurora", 1, "KG", 120, "A-15-02", 15, 1],
      [1800, "Queijo Mussarela Peça 4kg", "7891234567898", "Tirol", 5, "KG", 60, "D-01-01", 40, 1],
      [1900, "Bacon Defumado Manta 3kg", "7891234567899", "Sadia", 4, "KG", 90, "E-02-01", 25, 1],
      [1100, "Filé de Frango Congelado 1kg", "7891234567880", "Seara", 1, "UN", 90, "A-11-01", 100, 1],
      [1101, "Peito de Frango Bandeja 600g", "7891234567881", "Seara", 1, "UN", 30, "A-11-02", 50, 1],
      [1200, "Coxa de Frango Congelada 1kg", "7891234567882", "Sadia", 1, "UN", 90, "A-13-01", 80, 1],
    ];
    for (const p of produtos) insPro.run(p);

    // Códigos de barras alternativos
    const insBar = db.prepare(
      "INSERT OR REPLACE INTO TGFBAR (CODBARRAS, CODPROD, QTDEMBALAGEM) VALUES (?, ?, ?)",
    );
    insBar.run("17891234567890", 1245, 10);
    insBar.run("17891234567892", 1300, 12);

    // ------------------------------------------------------------ Locais
    const insLoc = db.prepare("INSERT OR REPLACE INTO TGFLOC VALUES (?, ?)");
    insLoc.run(101, "Câmara Fria A");
    insLoc.run(102, "Câmara Fria B");
    insLoc.run(103, "Estoque Seco");

    // ------------------------------------------------------------ Estoque
    const insEst = db.prepare(`
      INSERT OR REPLACE INTO TGFEST
        (CODPROD, CODLOCAL, CONTROLE, ESTOQUE, RESERVADO, DTVAL, DTFAB)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const hoje = new Date();
    const addDays = (d: number) => {
      const x = new Date(hoje);
      x.setDate(x.getDate() + d);
      return x.toISOString().slice(0, 10);
    };
    insEst.run(1245, 101, "L2024-0451", 200, 50, addDays(90), addDays(-10));
    insEst.run(1246, 101, "L2024-0452", 150, 30, addDays(30), addDays(-5));
    insEst.run(1300, 102, "L2024-0500", 23, 23, addDays(45), addDays(-15));
    insEst.run(1301, 102, "L2024-0501", 80, 0, addDays(60), addDays(-7));
    insEst.run(1455, 103, "L2024-0700", 12, 12, addDays(180), addDays(-20));
    insEst.run(1456, 103, "L2024-0701", 60, 0, addDays(180), addDays(-15));
    insEst.run(1500, 102, "L2024-0900", 5, 5, addDays(45), addDays(-30));
    insEst.run(1502, 102, "L2024-0901", 100, 0, addDays(120), addDays(-10));
    insEst.run(1612, 102, "", 0, 0, null, null); // Mortadela - falta total
    insEst.run(1620, 102, "L2024-1000", 30, 0, addDays(30), addDays(-5));
    insEst.run(1700, 101, "", 0, 0, null, null); // Peru 3,5kg sem estoque
    insEst.run(1701, 101, "L2024-1100", 50, 0, addDays(120), addDays(-10));
    insEst.run(1800, 102, "", 0, 0, null, null); // Mussarela sem estoque
    insEst.run(1900, 102, "L2024-1300", 10, 0, addDays(90), addDays(-20));
    insEst.run(1100, 101, "L2024-0451", 200, 100, addDays(90), addDays(-10));
    insEst.run(1101, 101, "L2024-0452", 100, 30, addDays(30), addDays(-5));
    insEst.run(1200, 101, "L2024-0460", 80, 40, addDays(90), addDays(-7));

    // ------------------------------------------------------------ Parceiros
    const insPar = db.prepare("INSERT OR REPLACE INTO TGFPAR VALUES (?, ?, ?)");
    insPar.run(1001, "Supermercado Bom Preço Ltda", "CLIENTE");
    insPar.run(1002, "Atacadão Central SA", "CLIENTE");
    insPar.run(1003, "Rede Economia - Filial 12", "CLIENTE");
    insPar.run(1004, "Distribuidora Norte Alimentos", "CLIENTE");
    insPar.run(1005, "Mercado Família Feliz ME", "CLIENTE");
    insPar.run(1006, "Hortifruti Natural da Terra", "CLIENTE");
    insPar.run(2001, "Transportadora Rápida SA", "TRANSPORTADORA");

    // ------------------------------------------------------------ Vendedores
    const insVen = db.prepare("INSERT OR REPLACE INTO TGFVEN VALUES (?, ?)");
    insVen.run(101, "Maria Santos");
    insVen.run(102, "Ana Oliveira");
    insVen.run(103, "Pedro Costa");

    // ------------------------------------------------------------ TGFTOP
    const insTop = db.prepare("INSERT OR REPLACE INTO TGFTOP VALUES (?, ?, ?, ?)");
    insTop.run(1100, "2026-01-01", "Venda Padrão", "V");

    // ------------------------------------------------------------ Ordens de carga
    const insOrd = db.prepare("INSERT OR REPLACE INTO TGFORD VALUES (?, ?, ?)");
    insOrd.run("EMB-042", `${addDays(0)} 06:30:00`, 2001);
    insOrd.run("EMB-043", `${addDays(0)} 08:00:00`, 2001);
    insOrd.run("EMB-044", `${addDays(0)} 10:00:00`, 2001);

    // ------------------------------------------------------------ Pedidos
    const insCab = db.prepare(`
      INSERT OR REPLACE INTO TGFCAB
        (NUNOTA, NUNNOTA, CODPARC, CODVEND, CODTIPOPER, DHTIPOPER, DTNEG, VLRNOTA, STATUSNOTA,
         STATUSNFE, ORDEMCARGA, AD_PRIORIDADE, AD_STATUSSEP, AD_PERCPROGRESSO, AD_CODUSUSEP)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const pedidos = [
      // nunota, nunnota, codparc, codvend, tipoper, dhtipoper, dtneg, vlrnota, status, statusnfe, ordemcarga, prioridade, statussep, progresso, codusu
      [187, "PV-2024-00187", 1001, 101, 1100, "2026-01-01", addDays(-1), 12450.0, "L", null, "EMB-042", "ALTA", "EM_ANDAMENTO", 67, 1],
      [188, "PV-2024-00188", 1002, 101, 1100, "2026-01-01", addDays(-1), 38900.0, "L", null, "EMB-042", "ALTA", "NAO_INICIADO", 0, null],
      [189, "PV-2024-00189", 1003, 102, 1100, "2026-01-01", addDays(-1), 9800.0, "L", null, "EMB-043", "MEDIA", "CONCLUIDO", 100, 4],
      [190, "PV-2024-00190", 1004, 102, 1100, "2026-01-01", addDays(-1), 25600.0, "L", null, "EMB-043", "CRITICA", "DIVERGENCIA", 76, 4],
      [191, "PV-2024-00191", 1005, 103, 1100, "2026-01-01", addDays(-1), 5400.0, "L", null, "EMB-044", "BAIXA", "NAO_INICIADO", 0, null],
      [192, "PV-2024-00192", 1006, 103, 1100, "2026-01-01", addDays(-1), 18200.0, "L", null, "EMB-044", "MEDIA", "EM_ANDAMENTO", 62, 1],
    ];
    for (const p of pedidos) insCab.run(p);

    // ------------------------------------------------------------ Itens — pedido 187 (6 itens)
    const insIte = db.prepare(`
      INSERT OR REPLACE INTO TGFITE
        (NUNOTA, SEQUENCIA, CODPROD, CODVOL, QTDNEG, QTDENTREGUE, QTDCONFERIDA, VLRUNIT, VLRTOT,
         CONTROLE, STATUSLOTE, PENDENTE, RESERVA)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const itens187 = [
      [187, 1, 1245, "UN", 50, 50, 50, 15.5, 775, "L2024-0451", "P", "N", "S"],
      [187, 2, 1246, "UN", 30, 30, 30, 12.8, 384, "L2024-0452", "P", "N", "S"],
      [187, 3, 1300, "UN", 20, 0, 0, 18.5, 370, "", "A", "S", "S"],
      [187, 4, 1455, "CX", 15, 0, 0, 95.0, 1425, "", "A", "S", "N"],
      [187, 5, 1500, "KG", 40, 0, 0, 22.5, 900, "", "A", "S", "N"],
      [187, 6, 1612, "KG", 10, 0, 0, 31.0, 310, "", "A", "S", "N"],
      [187, 7, 1900, "KG", 15, 10, 10, 45.0, 450, "L2024-1300", "P", "S", "N"], // Bacon - parcial
    ];
    for (const i of itens187) insIte.run(i);

    // Pedido 188 (125 itens — só seed mínimo de 3 itens representativos)
    const itens188 = [
      [188, 1, 1100, "UN", 80, 0, 0, 14.5, 1160, "", "A", "S", "S"],
      [188, 2, 1101, "UN", 30, 0, 0, 12.0, 360, "", "A", "S", "S"],
      [188, 3, 1200, "UN", 15, 0, 0, 18.0, 270, "", "A", "S", "S"],
    ];
    for (const i of itens188) insIte.run(i);

    // Pedido 189 (concluído)
    const itens189 = [
      [189, 1, 1245, "UN", 20, 20, 20, 15.5, 310, "L2024-0451", "P", "N", "S"],
      [189, 2, 1246, "UN", 16, 16, 16, 12.8, 204.8, "L2024-0452", "P", "N", "S"],
    ];
    for (const i of itens189) insIte.run(i);

    // Pedido 190 (com divergências e fluxo distinto)
    const itens190 = [
      [190, 1, 1100, "UN", 50, 50, 50, 14.5, 725, "L2024-0451", "P", "N", "S"],
      [190, 2, 1101, "UN", 30, 30, 30, 12.0, 360, "L2024-0452", "P", "N", "S"],
      [190, 3, 1200, "UN", 40, 40, 40, 18.0, 720, "L2024-0460", "P", "N", "S"],
      [190, 4, 1300, "UN", 20, 20, 20, 18.5, 370, "L2024-0501", "P", "N", "S"], // Linguiça A→B
      [190, 5, 1455, "CX", 15, 45, 45, 95.0, 1425, "L2024-0701", "P", "N", "S"], // Hambúrguer 1:3
      [190, 6, 1500, "KG", 40, 0, 0, 22.5, 900, "", "A", "S", "N"], // Salsicha — bloqueado
      [190, 7, 1612, "KG", 10, 0, 0, 31.0, 310, "", "A", "S", "N"], // Mortadela — falta total
      [190, 8, 1620, "UN", 50, 30, 30, 8.5, 425, "L2024-1000", "P", "S", "S"], // Presunto — parcial
    ];
    for (const i of itens190) insIte.run(i);

    // Pedido 191 (pendente)
    insIte.run(191, 1, 1100, "UN", 18, 0, 0, 14.5, 261, "", "A", "S", "S");

    // Pedido 192 (com divergência peru + Falta queijo)
    const itens192 = [
      [192, 1, 1700, "KG", 8, 0, 0, 65.0, 520, "", "A", "S", "N"], // Peru 3,5kg → 4kg
      [192, 2, 1800, "KG", 25, 0, 0, 35.0, 875, "", "A", "S", "N"], // Queijo - falta
      [192, 3, 1245, "UN", 30, 30, 30, 15.5, 465, "L2024-0451", "P", "N", "S"],
    ];
    for (const i of itens192) insIte.run(i);

    // ------------------------------------------------------------ AD_SEPARACAO
    const insSep = db.prepare(`
      INSERT OR REPLACE INTO AD_SEPARACAO (NUNOTA, STATUS, PERCPROGRESSO, CODUSU, DTINICIO)
      VALUES (?, ?, ?, ?, ?)
    `);
    insSep.run(187, "EM_ANDAMENTO", 67, 1, addDays(0));
    insSep.run(189, "CONCLUIDO", 100, 4, addDays(-1));
    insSep.run(190, "DIVERGENCIA", 76, 4, addDays(0));
    insSep.run(192, "EM_ANDAMENTO", 62, 1, addDays(0));

    // ------------------------------------------------------------ AD_TROCAITEM (Divergências)
    const insTro = db.prepare(`
      INSERT OR REPLACE INTO AD_TROCAITEM
        (NUNOTA, SEQUENCIA, CODPRODORIG, CODPRODSUBST, QTDORIG, QTDSUBST,
         TIPEQUIV, FATORCONV, MOTIVO, STATUS, HOMOLOGADA, NECESSIDADECLI, TIPODIVERG, CODUSUAPROV, DTAPROV)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insTro.run(
      187, 3, 1300, 1301, 20, 20, "EXATA", 1.0,
      "Marca A indisponível no estoque. Marca B é homologada pelo cliente.",
      "PENDENTE", 1, "Informar", "Marca homologada", null, null,
    );
    insTro.run(
      190, 5, 1455, 1456, 15, 45, "PROPORCIONAL", 3.0,
      "Embalagem cx c/36 indisponível. Substituição por 3x cx c/12 (equivalente).",
      "PENDENTE", 1, "Nenhuma", "Proporção/Porcionamento", null, null,
    );
    insTro.run(
      190, 6, 1500, 1502, 40, 40, "FUNCIONAL", 1.0,
      "Marca Premium sem estoque. Marca Standard não consta no cadastro de equivalência.",
      "BLOQUEADO", 0, "Aprovação obrigatória", "Marca não homologada", null, null,
    );
    insTro.run(
      192, 1, 1700, 1701, 8, 7, "PROPORCIONAL", 0.875,
      "Gramatura 3,5kg indisponível. Substituição por 4kg com ajuste de quantidade.",
      "APROVADO", 1, "Informar", "Gramatura", 2, addDays(0),
    );

    // ------------------------------------------------------------ AD_FALTAITEM
    const insFal = db.prepare(`
      INSERT OR REPLACE INTO AD_FALTAITEM
        (NUNOTA, SEQUENCIA, CODPROD, QTDFALTA, TIPO, CRITICIDADE, ACAO, PRAZORETORNO,
         STATUS, DTLIMITE, CODUSU, OBSERVACAO)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insFal.run(190, 7, 1612, 10, "total", "CRITICA", null, null, "PENDENTE", `${addDays(0)} 08:00`, null, null);
    insFal.run(190, 8, 1620, 20, "parcial", "ALTA", "APANHO", `${addDays(0)} 07:30`, "EM_TRATAMENTO", `${addDays(0)} 08:00`, 4, null);
    insFal.run(192, 2, 1800, 25, "total", "MEDIA", "COMPRA_PADRAO", `${addDays(0)} 09:00`, "EM_TRATAMENTO", `${addDays(0)} 10:00`, 4, null);
    insFal.run(187, 7, 1900, 5, "parcial", "CRITICA", null, null, "PENDENTE", `${addDays(0)} 06:30`, null, null);

    // ------------------------------------------------------------ AD_FLUXODISTINTO
    const insFlu = db.prepare(`
      INSERT OR REPLACE INTO AD_FLUXODISTINTO
        (NUNOTA, SEQUENCIA, CODPRODNF, CODPRODFISICO, TIPO, JUSTIFICATIVA, IMPACTO,
         STATUS, CODUSUSOLICIT, DTSOLICIT)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const f1 = insFlu.run(
      190, 4, 1300, 1301, "MARCA_DIFERENTE",
      "Marca A com estoque zerado. Marca B é equivalente homologada, porém cliente solicitou manter NF com item original para fins de contrato de fornecimento.",
      "Movimento compensatório de estoque será gerado automaticamente. Entrada para PRD-001300 (NF) e saída para PRD-001301 (físico).",
      "PENDENTE", 2, `${addDays(0)} 07:15`,
    );
    const f2 = insFlu.run(
      192, 1, 1700, 1701, "GRAMATURA",
      "Gramatura 3,5kg esgotada. Item de 4kg disponível com ajuste de quantidade (8 → 7 unidades). Cliente ciente e de acordo, porém NF deve manter item original conforme tabela de preços contratada.",
      "Diferença de gramatura gera ajuste fiscal. Movimento compensatório vinculado ao pedido e NF.",
      "PENDENTE", 3, `${addDays(0)} 08:30`,
    );

    // Histórico do fluxo distinto
    const insHis = db.prepare(`
      INSERT INTO AD_FLUXOHIST (NUFLUXODIST, DATA, ACAO, CODUSU) VALUES (?, ?, ?, ?)
    `);
    insHis.run(f1.lastInsertRowid, `${addDays(0)} 06:45`, "Divergência identificada na separação", 1);
    insHis.run(f1.lastInsertRowid, `${addDays(0)} 07:00`, "Troca aprovada pelo comercial", 2);
    insHis.run(f1.lastInsertRowid, `${addDays(0)} 07:15`, "Encaminhado para aprovação de fluxo distinto", 2);
    insHis.run(f2.lastInsertRowid, `${addDays(0)} 08:00`, "Divergência de gramatura registrada", 4);
    insHis.run(f2.lastInsertRowid, `${addDays(0)} 08:20`, "Cliente informado e aprovou substituição", 3);
    insHis.run(f2.lastInsertRowid, `${addDays(0)} 08:30`, "Encaminhado para fluxo distinto", 3);
  })();

  console.log("[seed] OK");
}

// Permite rodar via `tsx server/db/seed.ts --reset`
if (import.meta.url === `file://${process.argv[1]}`) {
  const reset = process.argv.includes("--reset");
  seed({ reset });
  process.exit(0);
}
