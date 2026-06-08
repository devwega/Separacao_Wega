/**
 * Camada de acesso ao banco usando libSQL (@libsql/client).
 * - Local/dev: arquivo SQLite (file:).
 * - Producao: Turso quando TURSO_DATABASE_URL estiver definido (persistente).
 * - Fallback no Vercel sem Turso: /tmp (efemero) — apenas para nao quebrar o deploy.
 *
 * Mantem uma fachada com .prepare(sql).{get,all,run} (assincronos) para minimizar
 * a diferenca em relacao ao codigo antigo (better-sqlite3).
 */
import { createClient, type Client, type InValue } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "../auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHEMA_PATH = process.env.SCHEMA_PATH || path.resolve(__dirname, "schema.sql");

function resolveUrl(): string {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  const file = process.env.VERCEL ? "/tmp/sankhya.sqlite" : path.resolve(__dirname, "sankhya.sqlite");
  return `file:${file}`;
}

let _client: Client | null = null;
export function getClient(): Client {
  if (_client) return _client;
  const url = resolveUrl();
  const authToken = process.env.TURSO_AUTH_TOKEN;
  _client = createClient(authToken ? { url, authToken } : { url });
  return _client;
}

function toArgs(params: any[]): InValue[] {
  const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
  return flat.map((v) => (v === undefined ? null : v)) as InValue[];
}
function plain(rows: any[]): any[] {
  return rows.map((r) => ({ ...r }));
}

export interface Stmt {
  get<T = any>(...params: any[]): Promise<T | undefined>;
  all<T = any>(...params: any[]): Promise<T[]>;
  run(...params: any[]): Promise<{ changes: number; lastInsertRowid: number }>;
}

export interface DbFacade {
  prepare(sql: string): Stmt;
  exec(sql: string): Promise<void>;
}

export function getDb(): DbFacade {
  const c = getClient();
  return {
    prepare(sql: string): Stmt {
      return {
        async get(...p: any[]) {
          const r = await c.execute({ sql, args: toArgs(p) });
          return (plain(r.rows)[0] as any) ?? undefined;
        },
        async all(...p: any[]) {
          const r = await c.execute({ sql, args: toArgs(p) });
          return plain(r.rows) as any;
        },
        async run(...p: any[]) {
          const r = await c.execute({ sql, args: toArgs(p) });
          return {
            changes: Number(r.rowsAffected ?? 0),
            lastInsertRowid: Number(r.lastInsertRowid ?? 0),
          };
        },
      };
    },
    async exec(sql: string) {
      await c.executeMultiple(sql);
    },
  };
}

/** Aplica o schema.sql (idempotente). Necessario antes de seedar um Turso vazio. */
export async function applySchema(): Promise<void> {
  const c = getClient();
  if (fs.existsSync(SCHEMA_PATH)) {
    let schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
    // PRAGMA nao e suportado/necessario no Turso (FKs ja aplicadas).
    schema = schema.replace(/PRAGMA[^;]*;/gi, "");
    await c.executeMultiple(schema);
  }
}

/** Migracoes idempotentes (ALTER TABLE ADD COLUMN ignora se ja existe). */
async function runMigrations(): Promise<void> {
  const c = getClient();
  const alters = [
    "ALTER TABLE AD_APANHO_REG ADD COLUMN LAT REAL",
    "ALTER TABLE AD_APANHO_REG ADD COLUMN LNG REAL",
    "ALTER TABLE AD_APANHO_REG ADD COLUMN NFCHAVE TEXT",
    "ALTER TABLE AD_APANHO_REG ADD COLUMN NFFOTO TEXT",
    "ALTER TABLE AD_APANHO_REG ADD COLUMN NUSESSAO INTEGER",
  ];
  for (const a of alters) {
    try { await c.execute(a); } catch { /* coluna ja existe */ }
  }
}

// Inicializacao unica (cold start): aplica schema e roda o seed.
let _ready: Promise<void> | null = null;
export function ensureReady(): Promise<void> {
  if (!_ready) {
    _ready = (async () => {
      await applySchema();
      await runMigrations();
      const c = getClient();
      let storedVer: string | null = null;
      try {
        const r = await c.execute("SELECT VALOR FROM AD_PARAM WHERE CHAVE='SEED_VERSION'");
        storedVer = (r.rows[0] as any)?.VALOR ?? null;
      } catch { /* AD_PARAM pode nao existir ainda */ }
      const { seed, SEED_VERSION } = await import("./seed.js");
      if (storedVer !== SEED_VERSION) {
        // versao do catalogo mudou -> recarrega tudo automaticamente
        console.log(`[seed] versao ${storedVer} -> ${SEED_VERSION}: recarregando catalogo`);
        await seed({ reset: true });
        await c.execute({
          sql: "INSERT OR REPLACE INTO AD_PARAM (CHAVE, VALOR, DTALTERACAO) VALUES ('SEED_VERSION', ?, datetime('now','localtime'))",
          args: [SEED_VERSION],
        });
      } else {
        await seed();
      }
      // Garante o usuario admin mesmo quando o banco ja estava populado (seed pula).
      await ensureAdmin();
    })().catch((e) => {
      _ready = null; // permite retry no proximo request
      throw e;
    });
  }
  return _ready;
}

export async function ensureAdmin(): Promise<void> {
  const c = getClient();
  await c.execute("INSERT OR IGNORE INTO TSIUSU (CODUSU, NOMEUSU, CODGRUPO, PERFIL) VALUES (99, 'Administrador', 4, 'ADMINISTRADOR')");
  const ex = await c.execute("SELECT 1 FROM AD_LOGIN WHERE LOGIN = 'admin'");
  if (ex.rows.length === 0) {
    await c.execute({
      sql: "INSERT INTO AD_LOGIN (CODUSU, LOGIN, SENHA, ATIVO, DTCRIACAO) VALUES (99, 'admin', ?, 1, ?)",
      args: [hashPassword("admin@321321"), new Date().toISOString()],
    });
  }
}

export async function resetDb(): Promise<void> {
  const c = getClient();
  const tables = [
    "AD_APANHO_REG", "AD_APANHO_SESSAO", "AD_FLUXOREMESSA", "AD_ITEMLOTE",
    "AD_FLUXOHIST", "AD_FLUXODISTINTO", "AD_FALTAITEM", "AD_TROCAITEM", "AD_SEPARACAO",
    "TGFITE", "TGFCAB", "TGFORD", "TGFTOP", "TGFVEN", "TGFPAR", "TGFEST", "TGFLOC",
    "TGFBAR", "TGFPRO", "TGFGRU", "TSIUSU",
  ];
  for (const t of tables) {
    try { await c.execute(`DELETE FROM ${t}`); } catch { /* tabela pode nao existir ainda */ }
  }
}

export async function closeDb(): Promise<void> {
  if (_client) { _client.close(); _client = null; }
}
