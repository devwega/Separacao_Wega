/**
 * Autenticacao do BIPE (US-01..03). Dados de login vivem no BIPE (tabela AD_LOGIN),
 * nao no Sankhya. Sem dependencias externas: hash via scrypt e token via HMAC-SHA256.
 */
import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const SECRET = process.env.AUTH_SECRET || "wega-bipe-dev-secret-troque-em-producao";

export type Perfil = "ADMINISTRADOR" | "GERENCIA" | "APROVADOR" | "SEPARADOR";
export interface TokenPayload { codusu: number; login: string; nome: string; perfil: Perfil; exp?: number; }

export function hashPassword(senha: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(senha, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(senha: string, stored: string): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const calc = crypto.scryptSync(senha, salt, 64).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(calc, "hex"));
  } catch {
    return false;
  }
}

function b64url(s: string | Buffer): string {
  return Buffer.from(s).toString("base64url");
}

export function signToken(payload: TokenPayload, ttlSec = 60 * 60 * 12): string {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec };
  const data = b64url(JSON.stringify(body));
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  if (sig !== expected) return null;
  try {
    const body = JSON.parse(Buffer.from(data, "base64url").toString()) as TokenPayload;
    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch {
    return null;
  }
}

function bearer(req: Request): string {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}

/** Middleware: exige token valido. Anexa req.user. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const payload = verifyToken(bearer(req));
  if (!payload) {
    res.status(401).json({ error: "Nao autenticado" });
    return;
  }
  (req as any).user = payload;
  next();
}

/** Middleware factory: exige um dos perfis informados. */
export function requirePerfil(...perfis: Perfil[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const u = (req as any).user as TokenPayload | undefined;
    if (!u) { res.status(401).json({ error: "Nao autenticado" }); return; }
    if (!perfis.includes(u.perfil)) {
      res.status(403).json({ error: "Acesso negado para o seu perfil" });
      return;
    }
    next();
  };
}
