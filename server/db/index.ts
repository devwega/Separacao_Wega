import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Em serverless (ex.: Vercel) o filesystem e somente leitura, exceto /tmp.
const DB_PATH =
  process.env.DB_PATH ||
  (process.env.VERCEL ? "/tmp/sankhya.sqlite" : path.resolve(__dirname, "sankhya.sqlite"));
// SCHEMA_PATH pode ser sobrescrito por env (necessario quando o codigo e empacotado
// e __dirname deixa de apontar para a pasta original do schema).
const SCHEMA_PATH = process.env.SCHEMA_PATH || path.resolve(__dirname, "schema.sql");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  // Aplica schema (idempotente)
  if (fs.existsSync(SCHEMA_PATH)) {
    const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
    _db.exec(schema);
  }

  return _db;
}

export function resetDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }
  // Remove arquivos WAL/SHM
  for (const suffix of ["-wal", "-shm"]) {
    const p = DB_PATH + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
