/**
 * Seed do banco (libSQL) — catalogo + pedidos no estado inicial "do zero":
 * todos LIBERADOS para separacao e NAO_INICIADO, sem dados operacionais.
 * Executado em batch (transacao) no primeiro boot.
 */
import { getClient, resetDb } from "./index.js";
import { hashPassword } from "../auth.js";
import type { InStatement } from "@libsql/client";
import { LOCAIS, PRODUTOS, BARRAS, ITENS_DEMO } from "./catalogo.js";

// Versao do seed/catalogo. Ao mudar, o app recarrega o catalogo automaticamente
// no proximo boot (ensureReady), sem necessidade de reseed manual.
export const SEED_VERSION = "2026-06-08-catalogo-real-ean-v1";

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

  // Locais (reais do RELATORIO_DE_EAN)
  for (const l of LOCAIS) s("INSERT OR REPLACE INTO TGFLOC VALUES (?,?)", l);

  // Produtos (catalogo real) + estoque base por produto/local
  for (const p of PRODUTOS) {
    s(`INSERT OR REPLACE INTO TGFPRO
        (CODPROD, DESCRPROD, REFERENCIA, MARCA, CODGRUPOPROD, CODVOL, PRAZOVAL, LOCALIZACAO, ALERTAESTMIN, CONTROLELOTE)
       VALUES (?,?,?,?,?,?,?,?,?,?)`, p.slice(0, 10));
    const codlocal = p[10]; const controlelote = p[9];
    if (controlelote)
      s("INSERT OR REPLACE INTO TGFEST (CODPROD, CODLOCAL, CONTROLE, ESTOQUE, RESERVADO, DTVAL, DTFAB) VALUES (?,?,?,?,?,?,?)",
        [p[0], codlocal, `L-${p[0]}`, 100, 0, addDays(hoje, 120), addDays(hoje, -10)]);
    else
      s("INSERT OR REPLACE INTO TGFEST (CODPROD, CODLOCAL, CONTROLE, ESTOQUE, RESERVADO, DTVAL, DTFAB) VALUES (?,?,?,?,?,?,?)",
        [p[0], codlocal, "", 100, 0, null, null]);
  }

  // Codigos de barras (EANs reais)
  for (const b of BARRAS) s("INSERT OR REPLACE INTO TGFBAR (CODBARRAS, CODPROD, QTDEMBALAGEM) VALUES (?,?,?)", b);

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
  const itens: any[][] = ITENS_DEMO;
  for (const i of itens)
    s(`INSERT OR REPLACE INTO TGFITE
        (NUNOTA, SEQUENCIA, CODPROD, CODVOL, QTDNEG, QTDENTREGUE, QTDCONFERIDA, VLRUNIT, VLRTOT,
         CONTROLE, STATUSLOTE, PENDENTE, RESERVA)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, i);

  // Usuario administrador (US-03). Credenciais de login vivem no BIPE (AD_LOGIN).
  s("INSERT OR REPLACE INTO TSIUSU (CODUSU, NOMEUSU, CODGRUPO, PERFIL) VALUES (?,?,?,?)",
    [99, "Administrador", 4, "ADMINISTRADOR"]);
  s("INSERT OR REPLACE INTO AD_LOGIN (CODUSU, LOGIN, SENHA, ATIVO, DTCRIACAO) VALUES (?,?,?,1,?)",
    [99, "admin", hashPassword("admin@321321"), new Date().toISOString()]);

  for (let i = 0; i < stmts.length; i += 400) {
    await c.batch(stmts.slice(i, i + 400), "write");
  }
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
