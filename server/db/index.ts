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

// Inicializacao unica (cold start): aplica schema e roda o seed.
let _ready: Promise<void> | null = null;
export function ensureReady(): Promise<void> {
  if (!_ready) {
    _ready = (async () => {
      const c = getClient();
      if (fs.existsSync(SCHEMA_PATH)) {
        let schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
        // PRAGMA nao e suportado/necessario no Turso (FKs ja aplicadas).
        schema = schema.replace(/PRAGMA[^;]*;/gi, "");
        await c.executeMultiple(schema);
      }
      const { seed } = await import("./seed.js");
      await seed();
    })().catch((e) => {
      _ready = null; // permite retry no proximo request
      throw e;
    });
  }
  return _ready;
}

export async function resetDb(): Promise<void> {
  const c = getClient();
  const tables = [
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
