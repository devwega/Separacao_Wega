/**
 * Seed do banco SQLite — popula com catalogo (produtos, clientes, estoque) e os
 * pedidos no estado inicial "do zero": todos LIBERADOS para separacao e NAO_INICIADO,
 * sem nenhum dado operacional (sem separacoes, divergencias, faltas ou fluxos distintos).
 */
import { getDb, resetDb } from "./index.js";

/**
 * Mantido por compatibilidade de import. Intencionalmente NAO cria mais variantes
 * de status (em andamento / faturado), para que o baseline fique sempre limpo.
 */
export function seedDemoStatusVariants() {
  // no-op — baseline limpo: nenhum pedido pre-separado/faturado.
}

export function seed({ reset = false }: { reset?: boolean } = {}) {
  if (reset) resetDb();
  const db = getDb();

  // Idempotencia: se ja tem dados, nao re-seedar
  const existing = db.prepare("SELECT COUNT(*) as c FROM TGFCAB").get() as { c: number };
  if (existing.c > 0 && !reset) {
    console.log(`[seed] banco ja populado (${existing.c} pedidos) — skip`);
    return;
  }

  console.log("[seed] populando banco (baseline limpo)…");

  db.transaction(() => {
    // ------------------------------------------------------------ Usuarios
    const insUsu = db.prepare(
      "INSERT OR REPLACE INTO TSIUSU (CODUSU, NOMEUSU, CODGRUPO, PERFIL) VALUES (?, ?, ?, ?)",
    );
    insUsu.run(1, "Carlos Silva", 1, "SEPARADOR");
    insUsu.run(2, "Maria Santos", 2, "COMERCIAL");
    insUsu.run(3, "Ana Oliveira", 2, "COMERCIAL");
    insUsu.run(4, "Joao Pereira", 1, "SEPARADOR");
    insUsu.run(5, "Roberto Gerente", 4, "GERENTE");
    insUsu.run(6, "Patricia Lima", 3, "SUPERVISOR");

    // ------------------------------------------------------------ Grupos
    const insGru = db.prepare(
      "INSERT OR REPLACE INTO TGFGRU (CODGRUPOPROD, DESCRGRUPOPROD) VALUES (?, ?)",
    );
    insGru.run(1, "Aves Congeladas");
    insGru.run(2, "Embutidos");
    insGru.run(3, "Bovinos");
    insGru.run(4, "Suinos");
    insGru.run(5, "Laticinios");

    // ------------------------------------------------------------ Produtos
    const insPro = db.prepare(`
      INSERT OR REPLACE INTO TGFPRO
        (CODPROD, DESCRPROD, REFERENCIA, MARCA, CODGRUPOPROD, CODVOL, PRAZOVAL, LOCALIZACAO, ALERTAESTMIN, CONTROLELOTE)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const produtos = [
      [1245, "File de Frango Congelado 1kg", "7891234567890", "Sadia", 1, "UN", 90, "A-12-03", 100, 1],
      [1246, "Peito de Frango Bandeja 600g", "7891234567891", "Sadia", 1, "UN", 30, "A-12-04", 50, 1],
      [1300, "Linguica Toscana 500g - Marca A", "7891234567892", "Aurora", 2, "UN", 60, "B-04-01", 80, 1],
      [1301, "Linguica Toscana 500g - Marca B", "7891234567902", "Seara", 2, "UN", 60, "B-04-02", 80, 1],
      [1455, "Hamburguer Bovino 56g cx c/36", "7891234567893", "Sadia", 3, "CX", 180, "C-08-01", 30, 1],
      [1456, "Hamburguer Bovino 56g cx c/12", "7891234567903", "Sadia", 3, "CX", 180, "C-08-02", 30, 1],
      [1500, "Salsicha Hot Dog 3kg - Premium", "7891234567894", "Perdigao", 2, "KG", 120, "B-05-01", 60, 1],
      [1502, "Salsicha Hot Dog 3kg - Standard", "7891234567904", "Friboi", 2, "KG", 120, "B-05-02", 60, 1],
      [1612, "Mortadela Bologna 3,5kg", "7891234567895", "Sadia", 2, "KG", 90, "B-06-01", 20, 1],
      [1620, "Presunto Cozido Fatiado 200g", "7891234567896", "Seara", 2, "UN", 30, "B-07-01", 100, 1],
      [1700, "Peito de Peru Defumado 3,5kg", "7891234567897", "Aurora", 1, "KG", 120, "A-15-01", 15, 1],
      [1701, "Peito de Peru Defumado 4kg", "7891234567907", "Aurora", 1, "KG", 120, "A-15-02", 15, 1],
      [1800, "Queijo Mussarela Peca 4kg", "7891234567898", "Tirol", 5, "KG", 60, "D-01-01", 40, 1],
      [1900, "Bacon Defumado Manta 3kg", "7891234567899", "Sadia", 4, "KG", 90, "E-02-01", 25, 1],
      [1100, "File de Frango Congelado 1kg", "7891234567880", "Seara", 1, "UN", 90, "A-11-01", 100, 1],
      [1101, "Peito de Frango Bandeja 600g", "7891234567881", "Seara", 1, "UN", 30, "A-11-02", 50, 1],
      [1200, "Coxa de Frango Congelada 1kg", "7891234567882", "Sadia", 1, "UN", 90, "A-13-01", 80, 1],
    ];
    for (const p of produtos) insPro.run(p);

    // Codigos de barras alternativos
    const insBar = db.prepare(
      "INSERT OR REPLACE INTO TGFBAR (CODBARRAS, CODPROD, QTDEMBALAGEM) VALUES (?, ?, ?)",
    );
    insBar.run("17891234567890", 1245, 10);
    insBar.run("17891234567892", 1300, 12);

    // ------------------------------------------------------------ Locais
    const insLoc = db.prepare("INSERT OR REPLACE INTO TGFLOC VALUES (?, ?)");
    insLoc.run(101, "Camara Fria A");
    insLoc.run(102, "Camara Fria B");
    insLoc.run(103, "Estoque Seco");

    // ------------------------------------------------------------ Estoque (sem reservas — do zero)
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
    insEst.run(1245, 101, "L2024-0451", 200, 0, addDays(90), addDays(-10));
    insEst.run(1246, 101, "L2024-0452", 150, 0, addDays(30), addDays(-5));
    insEst.run(1300, 102, "L2024-0500", 23, 0, addDays(45), addDays(-15));
    insEst.run(1301, 102, "L2024-0501", 80, 0, addDays(60), addDays(-7));
    insEst.run(1455, 103, "L2024-0700", 12, 0, addDays(180), addDays(-20));
    insEst.run(1456, 103, "L2024-0701", 60, 0, addDays(180), addDays(-15));
    insEst.run(1500, 102, "L2024-0900", 5, 0, addDays(45), addDays(-30));
    insEst.run(1502, 102, "L2024-0901", 100, 0, addDays(120), addDays(-10));
    insEst.run(1612, 102, "", 0, 0, null, null);
    insEst.run(1620, 102, "L2024-1000", 30, 0, addDays(30), addDays(-5));
    insEst.run(1700, 101, "", 0, 0, null, null);
    insEst.run(1701, 101, "L2024-1100", 50, 0, addDays(120), addDays(-10));
    insEst.run(1800, 102, "", 0, 0, null, null);
    insEst.run(1900, 102, "L2024-1300", 10, 0, addDays(90), addDays(-20));
    insEst.run(1100, 101, "L2024-0451", 200, 0, addDays(90), addDays(-10));
    insEst.run(1101, 101, "L2024-0452", 100, 0, addDays(30), addDays(-5));
    insEst.run(1200, 101, "L2024-0460", 80, 0, addDays(90), addDays(-7));

    // ------------------------------------------------------------ Parceiros
    const insPar = db.prepare("INSERT OR REPLACE INTO TGFPAR VALUES (?, ?, ?)");
    insPar.run(1001, "Supermercado Bom Preco Ltda", "CLIENTE");
    insPar.run(1002, "Atacadao Central SA", "CLIENTE");
    insPar.run(1003, "Rede Economia - Filial 12", "CLIENTE");
    insPar.run(1004, "Distribuidora Norte Alimentos", "CLIENTE");
    insPar.run(1005, "Mercado Familia Feliz ME", "CLIENTE");
    insPar.run(1006, "Hortifruti Natural da Terra", "CLIENTE");
    insPar.run(2001, "Transportadora Rapida SA", "TRANSPORTADORA");

    // ------------------------------------------------------------ Vendedores
    const insVen = db.prepare("INSERT OR REPLACE INTO TGFVEN VALUES (?, ?)");
    insVen.run(101, "Maria Santos");
    insVen.run(102, "Ana Oliveira");
    insVen.run(103, "Pedro Costa");

    // ------------------------------------------------------------ TGFTOP
    const insTop = db.prepare("INSERT OR REPLACE INTO TGFTOP VALUES (?, ?, ?, ?)");
    insTop.run(1100, "2026-01-01", "Venda Padrao", "V");

    // ------------------------------------------------------------ Ordens de carga
    const insOrd = db.prepare("INSERT OR REPLACE INTO TGFORD VALUES (?, ?, ?)");
    insOrd.run("EMB-042", `${addDays(0)} 06:30:00`, 2001);
    insOrd.run("EMB-043", `${addDays(0)} 08:00:00`, 2001);
    insOrd.run("EMB-044", `${addDays(0)} 10:00:00`, 2001);

    // ------------------------------------------------------------ Pedidos (todos LIBERADOS, NAO_INICIADO)
    const insCab = db.prepare(`
      INSERT OR REPLACE INTO TGFCAB
        (NUNOTA, NUNNOTA, CODPARC, CODVEND, CODTIPOPER, DHTIPOPER, DTNEG, VLRNOTA, STATUSNOTA,
         STATUSNFE, ORDEMCARGA, AD_PRIORIDADE, AD_STATUSSEP, AD_PERCPROGRESSO, AD_CODUSUSEP)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const pedidos = [
      [187, "PV-2024-00187", 1001, 101, 1100, "2026-01-01", addDays(-1), 12450.0, "L", null, "EMB-042", "ALTA", "NAO_INICIADO", 0, null],
      [188, "PV-2024-00188", 1002, 101, 1100, "2026-01-01", addDays(-1), 38900.0, "L", null, "EMB-042", "ALTA", "NAO_INICIADO", 0, null],
      [189, "PV-2024-00189", 1003, 102, 1100, "2026-01-01", addDays(-1), 9800.0, "L", null, "EMB-043", "MEDIA", "NAO_INICIADO", 0, null],
      [190, "PV-2024-00190", 1004, 102, 1100, "2026-01-01", addDays(-1), 25600.0, "L", null, "EMB-043", "CRITICA", "NAO_INICIADO", 0, null],
      [191, "PV-2024-00191", 1005, 103, 1100, "2026-01-01", addDays(-1), 5400.0, "L", null, "EMB-044", "BAIXA", "NAO_INICIADO", 0, null],
      [192, "PV-2024-00192", 1006, 103, 1100, "2026-01-01", addDays(-1), 18200.0, "L", null, "EMB-044", "MEDIA", "NAO_INICIADO", 0, null],
    ];
    for (const p of pedidos) insCab.run(p);

    // ------------------------------------------------------------ Itens (todos pendentes, sem separacao)
    const insIte = db.prepare(`
      INSERT OR REPLACE INTO TGFITE
        (NUNOTA, SEQUENCIA, CODPROD, CODVOL, QTDNEG, QTDENTREGUE, QTDCONFERIDA, VLRUNIT, VLRTOT,
         CONTROLE, STATUSLOTE, PENDENTE, RESERVA)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const itens: any[][] = [
      // 187
      [187, 1, 1245, "UN", 50, 0, 0, 15.5, 775, "", "A", "S", "S"],
      [187, 2, 1246, "UN", 30, 0, 0, 12.8, 384, "", "A", "S", "S"],
      [187, 3, 1300, "UN", 20, 0, 0, 18.5, 370, "", "A", "S", "S"],
      [187, 4, 1455, "CX", 15, 0, 0, 95.0, 1425, "", "A", "S", "N"],
      [187, 5, 1500, "KG", 40, 0, 0, 22.5, 900, "", "A", "S", "N"],
      [187, 6, 1612, "KG", 10, 0, 0, 31.0, 310, "", "A", "S", "N"],
      [187, 7, 1900, "KG", 15, 0, 0, 45.0, 450, "", "A", "S", "N"],
      // 188
      [188, 1, 1100, "UN", 80, 0, 0, 14.5, 1160, "", "A", "S", "S"],
      [188, 2, 1101, "UN", 30, 0, 0, 12.0, 360, "", "A", "S", "S"],
      [188, 3, 1200, "UN", 15, 0, 0, 18.0, 270, "", "A", "S", "S"],
      // 189
      [189, 1, 1245, "UN", 20, 0, 0, 15.5, 310, "", "A", "S", "S"],
      [189, 2, 1246, "UN", 16, 0, 0, 12.8, 204.8, "", "A", "S", "S"],
      // 190
      [190, 1, 1100, "UN", 50, 0, 0, 14.5, 725, "", "A", "S", "S"],
      [190, 2, 1101, "UN", 30, 0, 0, 12.0, 360, "", "A", "S", "S"],
      [190, 3, 1200, "UN", 40, 0, 0, 18.0, 720, "", "A", "S", "S"],
      [190, 4, 1300, "UN", 20, 0, 0, 18.5, 370, "", "A", "S", "S"],
      [190, 5, 1455, "CX", 15, 0, 0, 95.0, 1425, "", "A", "S", "N"],
      [190, 6, 1500, "KG", 40, 0, 0, 22.5, 900, "", "A", "S", "N"],
      [190, 7, 1612, "KG", 10, 0, 0, 31.0, 310, "", "A", "S", "N"],
      [190, 8, 1620, "UN", 50, 0, 0, 8.5, 425, "", "A", "S", "S"],
      // 191
      [191, 1, 1100, "UN", 18, 0, 0, 14.5, 261, "", "A", "S", "S"],
      // 192
      [192, 1, 1700, "KG", 8, 0, 0, 65.0, 520, "", "A", "S", "N"],
      [192, 2, 1800, "KG", 25, 0, 0, 35.0, 875, "", "A", "S", "N"],
      [192, 3, 1245, "UN", 30, 0, 0, 15.5, 465, "", "A", "S", "S"],
    ];
    for (const i of itens) insIte.run(i);

    // Sem dados operacionais (AD_SEPARACAO / AD_TROCAITEM / AD_FALTAITEM /
    // AD_FLUXODISTINTO / AD_FLUXOHIST) — baseline "do zero".
  })();

  console.log("[seed] OK (baseline limpo)");
}

// Permite rodar via `tsx server/db/seed.ts --reset`
if (import.meta.url === `file://${process.argv[1]}`) {
  const reset = process.argv.includes("--reset");
  seed({ reset });
  process.exit(0);
}
