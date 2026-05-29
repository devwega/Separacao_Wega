/**
 * Seed do banco (libSQL) — catalogo + pedidos no estado inicial "do zero":
 * todos LIBERADOS para separacao e NAO_INICIADO, sem dados operacionais.
 * Executado em batch (transacao) no primeiro boot.
 */
import { getClient, resetDb } from "./index.js";
import type { InStatement } from "@libsql/client";

export async function seedDemoStatusVariants() {
  // no-op — baseline limpo.
}

function addDays(base: Date, d: number) {
  const x = new Date(base);
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
}

export async function seed({ reset = false }: { reset?: boolean } = {}) {
  const c = getClient();
  if (reset) await resetDb();

  const existing = await c.execute("SELECT COUNT(*) AS c FROM TGFCAB");
  const count = Number((existing.rows[0] as any)?.c ?? 0);
  if (count > 0 && !reset) {
    console.log(`[seed] banco ja populado (${count} pedidos) — skip`);
    return;
  }

  console.log("[seed] populando banco (baseline limpo)…");
  const hoje = new Date();
  const stmts: InStatement[] = [];
  const s = (sql: string, args: any[] = []) =>
    stmts.push({ sql, args: args.map((v) => (v === undefined ? null : v)) });

  // Usuarios
  for (const u of [
    [1, "Carlos Silva", 1, "SEPARADOR"], [2, "Maria Santos", 2, "COMERCIAL"],
    [3, "Ana Oliveira", 2, "COMERCIAL"], [4, "Joao Pereira", 1, "SEPARADOR"],
    [5, "Roberto Gerente", 4, "GERENTE"], [6, "Patricia Lima", 3, "SUPERVISOR"],
  ]) s("INSERT OR REPLACE INTO TSIUSU (CODUSU, NOMEUSU, CODGRUPO, PERFIL) VALUES (?,?,?,?)", u);

  // Grupos
  for (const g of [[1, "Aves Congeladas"], [2, "Embutidos"], [3, "Bovinos"], [4, "Suinos"], [5, "Laticinios"]])
    s("INSERT OR REPLACE INTO TGFGRU (CODGRUPOPROD, DESCRGRUPOPROD) VALUES (?,?)", g);

  // Produtos
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
  for (const p of produtos)
    s(`INSERT OR REPLACE INTO TGFPRO
        (CODPROD, DESCRPROD, REFERENCIA, MARCA, CODGRUPOPROD, CODVOL, PRAZOVAL, LOCALIZACAO, ALERTAESTMIN, CONTROLELOTE)
       VALUES (?,?,?,?,?,?,?,?,?,?)`, p);

  s("INSERT OR REPLACE INTO TGFBAR (CODBARRAS, CODPROD, QTDEMBALAGEM) VALUES (?,?,?)", ["17891234567890", 1245, 10]);
  s("INSERT OR REPLACE INTO TGFBAR (CODBARRAS, CODPROD, QTDEMBALAGEM) VALUES (?,?,?)", ["17891234567892", 1300, 12]);

  // Locais
  for (const l of [[101, "Camara Fria A"], [102, "Camara Fria B"], [103, "Estoque Seco"]])
    s("INSERT OR REPLACE INTO TGFLOC VALUES (?,?)", l);

  // Estoque (sem reservas)
  const est: any[][] = [
    [1245, 101, "L2024-0451", 200, 0, addDays(hoje, 90), addDays(hoje, -10)],
    [1246, 101, "L2024-0452", 150, 0, addDays(hoje, 30), addDays(hoje, -5)],
    [1300, 102, "L2024-0500", 23, 0, addDays(hoje, 45), addDays(hoje, -15)],
    [1301, 102, "L2024-0501", 80, 0, addDays(hoje, 60), addDays(hoje, -7)],
    [1455, 103, "L2024-0700", 12, 0, addDays(hoje, 180), addDays(hoje, -20)],
    [1456, 103, "L2024-0701", 60, 0, addDays(hoje, 180), addDays(hoje, -15)],
    [1500, 102, "L2024-0900", 5, 0, addDays(hoje, 45), addDays(hoje, -30)],
    [1502, 102, "L2024-0901", 100, 0, addDays(hoje, 120), addDays(hoje, -10)],
    [1612, 102, "", 0, 0, null, null],
    [1620, 102, "L2024-1000", 30, 0, addDays(hoje, 30), addDays(hoje, -5)],
    [1700, 101, "", 0, 0, null, null],
    [1701, 101, "L2024-1100", 50, 0, addDays(hoje, 120), addDays(hoje, -10)],
    [1800, 102, "", 0, 0, null, null],
    [1900, 102, "L2024-1300", 10, 0, addDays(hoje, 90), addDays(hoje, -20)],
    [1100, 101, "L2024-0451", 200, 0, addDays(hoje, 90), addDays(hoje, -10)],
    [1101, 101, "L2024-0452", 100, 0, addDays(hoje, 30), addDays(hoje, -5)],
    [1200, 101, "L2024-0460", 80, 0, addDays(hoje, 90), addDays(hoje, -7)],
  ];
  for (const e of est)
    s("INSERT OR REPLACE INTO TGFEST (CODPROD, CODLOCAL, CONTROLE, ESTOQUE, RESERVADO, DTVAL, DTFAB) VALUES (?,?,?,?,?,?,?)", e);

  // Parceiros
  for (const p of [
    [1001, "Supermercado Bom Preco Ltda", "CLIENTE"], [1002, "Atacadao Central SA", "CLIENTE"],
    [1003, "Rede Economia - Filial 12", "CLIENTE"], [1004, "Distribuidora Norte Alimentos", "CLIENTE"],
    [1005, "Mercado Familia Feliz ME", "CLIENTE"], [1006, "Hortifruti Natural da Terra", "CLIENTE"],
    [2001, "Transportadora Rapida SA", "TRANSPORTADORA"],
  ]) s("INSERT OR REPLACE INTO TGFPAR VALUES (?,?,?)", p);

  // Vendedores
  for (const v of [[101, "Maria Santos"], [102, "Ana Oliveira"], [103, "Pedro Costa"]])
    s("INSERT OR REPLACE INTO TGFVEN VALUES (?,?)", v);

  s("INSERT OR REPLACE INTO TGFTOP VALUES (?,?,?,?)", [1100, "2026-01-01", "Venda Padrao", "V"]);

  // Ordens de carga
  s("INSERT OR REPLACE INTO TGFORD VALUES (?,?,?)", ["EMB-042", `${addDays(hoje, 0)} 06:30:00`, 2001]);
  s("INSERT OR REPLACE INTO TGFORD VALUES (?,?,?)", ["EMB-043", `${addDays(hoje, 0)} 08:00:00`, 2001]);
  s("INSERT OR REPLACE INTO TGFORD VALUES (?,?,?)", ["EMB-044", `${addDays(hoje, 0)} 10:00:00`, 2001]);

  // Pedidos — todos LIBERADOS / NAO_INICIADO
  const pedidos: any[][] = [
    [187, "PV-2024-00187", 1001, 101, 1100, "2026-01-01", addDays(hoje, -1), 12450.0, "L", null, "EMB-042", "ALTA", "NAO_INICIADO", 0, null],
    [188, "PV-2024-00188", 1002, 101, 1100, "2026-01-01", addDays(hoje, -1), 38900.0, "L", null, "EMB-042", "ALTA", "NAO_INICIADO", 0, null],
    [189, "PV-2024-00189", 1003, 102, 1100, "2026-01-01", addDays(hoje, -1), 9800.0, "L", null, "EMB-043", "MEDIA", "NAO_INICIADO", 0, null],
    [190, "PV-2024-00190", 1004, 102, 1100, "2026-01-01", addDays(hoje, -1), 25600.0, "L", null, "EMB-043", "CRITICA", "NAO_INICIADO", 0, null],
    [191, "PV-2024-00191", 1005, 103, 1100, "2026-01-01", addDays(hoje, -1), 5400.0, "L", null, "EMB-044", "BAIXA", "NAO_INICIADO", 0, null],
    [192, "PV-2024-00192", 1006, 103, 1100, "2026-01-01", addDays(hoje, -1), 18200.0, "L", null, "EMB-044", "MEDIA", "NAO_INICIADO", 0, null],
  ];
  for (const p of pedidos)
    s(`INSERT OR REPLACE INTO TGFCAB
        (NUNOTA, NUNNOTA, CODPARC, CODVEND, CODTIPOPER, DHTIPOPER, DTNEG, VLRNOTA, STATUSNOTA,
         STATUSNFE, ORDEMCARGA, AD_PRIORIDADE, AD_STATUSSEP, AD_PERCPROGRESSO, AD_CODUSUSEP)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, p);

  // Itens — todos pendentes (sem separacao)
  const itens: any[][] = [
    [187, 1, 1245, "UN", 50, 0, 0, 15.5, 775, "", "A", "S", "S"],
    [187, 2, 1246, "UN", 30, 0, 0, 12.8, 384, "", "A", "S", "S"],
    [187, 3, 1300, "UN", 20, 0, 0, 18.5, 370, "", "A", "S", "S"],
    [187, 4, 1455, "CX", 15, 0, 0, 95.0, 1425, "", "A", "S", "N"],
    [187, 5, 1500, "KG", 40, 0, 0, 22.5, 900, "", "A", "S", "N"],
    [187, 6, 1612, "KG", 10, 0, 0, 31.0, 310, "", "A", "S", "N"],
    [187, 7, 1900, "KG", 15, 0, 0, 45.0, 450, "", "A", "S", "N"],
    [188, 1, 1100, "UN", 80, 0, 0, 14.5, 1160, "", "A", "S", "S"],
    [188, 2, 1101, "UN", 30, 0, 0, 12.0, 360, "", "A", "S", "S"],
    [188, 3, 1200, "UN", 15, 0, 0, 18.0, 270, "", "A", "S", "S"],
    [189, 1, 1245, "UN", 20, 0, 0, 15.5, 310, "", "A", "S", "S"],
    [189, 2, 1246, "UN", 16, 0, 0, 12.8, 204.8, "", "A", "S", "S"],
    [190, 1, 1100, "UN", 50, 0, 0, 14.5, 725, "", "A", "S", "S"],
    [190, 2, 1101, "UN", 30, 0, 0, 12.0, 360, "", "A", "S", "S"],
    [190, 3, 1200, "UN", 40, 0, 0, 18.0, 720, "", "A", "S", "S"],
    [190, 4, 1300, "UN", 20, 0, 0, 18.5, 370, "", "A", "S", "S"],
    [190, 5, 1455, "CX", 15, 0, 0, 95.0, 1425, "", "A", "S", "N"],
    [190, 6, 1500, "KG", 40, 0, 0, 22.5, 900, "", "A", "S", "N"],
    [190, 7, 1612, "KG", 10, 0, 0, 31.0, 310, "", "A", "S", "N"],
    [190, 8, 1620, "UN", 50, 0, 0, 8.5, 425, "", "A", "S", "S"],
    [191, 1, 1100, "UN", 18, 0, 0, 14.5, 261, "", "A", "S", "S"],
    [192, 1, 1700, "KG", 8, 0, 0, 65.0, 520, "", "A", "S", "N"],
    [192, 2, 1800, "KG", 25, 0, 0, 35.0, 875, "", "A", "S", "N"],
    [192, 3, 1245, "UN", 30, 0, 0, 15.5, 465, "", "A", "S", "S"],
  ];
  for (const i of itens)
    s(`INSERT OR REPLACE INTO TGFITE
        (NUNOTA, SEQUENCIA, CODPROD, CODVOL, QTDNEG, QTDENTREGUE, QTDCONFERIDA, VLRUNIT, VLRTOT,
         CONTROLE, STATUSLOTE, PENDENTE, RESERVA)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, i);

  await c.batch(stmts, "write");
  console.log(`[seed] OK (baseline limpo) — ${stmts.length} statements`);
}

// CLI: tsx server/db/seed.ts [--reset]  (usa TURSO_DATABASE_URL/TURSO_AUTH_TOKEN se definidos)
if (import.meta.url === `file://${process.argv[1]}`) {
  const reset = process.argv.includes("--reset");
  (async () => {
    const { applySchema } = await import("./index.js");
    await applySchema();
    await seed({ reset });
  })()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
