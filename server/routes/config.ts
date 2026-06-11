/**
 * Configurações de conexão com APIs (gateway) — restrito ao perfil ADMINISTRADOR
 * (gate aplicado no app.ts). Valores persistidos em AD_PARAM com auditoria
 * (DTALTERACAO + CODUSU).
 */
import { Router } from "express";
import { getDb } from "../db/index.js";

const router = Router();

// Chaves em AD_PARAM
const KEYS = {
  baseUrl: "API_GATEWAY_BASEURL",
  clientId: "API_CLIENT_ID",
  clientSecret: "API_CLIENT_SECRET",
  xToken: "API_XTOKEN",
} as const;
type CfgField = keyof typeof KEYS;

/** GET /api/config/api — valores atuais + última alteração */
router.get("/api", async (_req, res) => {
  const db = getDb();
  const rows = await db.prepare(`
    SELECT P.CHAVE AS chave, P.VALOR AS valor, P.DTALTERACAO AS dtAlteracao, U.NOMEUSU AS alteradoPor
    FROM AD_PARAM P LEFT JOIN TSIUSU U ON U.CODUSU = P.CODUSU
    WHERE P.CHAVE IN ('API_GATEWAY_BASEURL','API_CLIENT_ID','API_CLIENT_SECRET','API_XTOKEN')
  `).all() as any[];
  const byKey = Object.fromEntries(rows.map((r) => [r.chave, r]));
  const out: any = {};
  for (const [field, chave] of Object.entries(KEYS)) out[field] = byKey[chave]?.valor ?? "";
  const ult = rows
    .filter((r) => r.dtAlteracao)
    .sort((a, b) => (a.dtAlteracao > b.dtAlteracao ? -1 : 1))[0];
  res.json({ ...out, dtAlteracao: ult?.dtAlteracao ?? null, alteradoPor: ult?.alteradoPor ?? null });
});

/** PUT /api/config/api — salva os valores informados */
router.put("/api", async (req, res) => {
  const db = getDb();
  const b = (req.body ?? {}) as Partial<Record<CfgField, string>>;
  const u = (req as any).user;

  if (b.baseUrl && !/^https?:\/\/.+/i.test(String(b.baseUrl).trim())) {
    res.status(400).json({ error: "BASE URL inválida — informe uma URL http(s) completa." });
    return;
  }

  let salvos = 0;
  for (const [field, chave] of Object.entries(KEYS) as [CfgField, string][]) {
    if (b[field] === undefined) continue;
    await db.prepare(
      "INSERT OR REPLACE INTO AD_PARAM (CHAVE, VALOR, DTALTERACAO, CODUSU) VALUES (?, ?, datetime('now','localtime'), ?)",
    ).run(chave, String(b[field] ?? "").trim(), u?.codusu ?? null);
    salvos++;
  }
  if (salvos === 0) {
    res.status(400).json({ error: "Nenhum campo informado." });
    return;
  }
  res.json({ ok: true, salvos });
});

/** POST /api/config/api/testar — testa a conexão com o gateway (chamada server-side) */
router.post("/api/testar", async (req, res) => {
  const db = getDb();
  const b = (req.body ?? {}) as Partial<Record<CfgField, string>>;
  // usa os valores enviados (teste antes de salvar) ou os persistidos
  const getVal = async (field: CfgField) => {
    if (b[field] !== undefined) return String(b[field] ?? "").trim();
    const r = await db.prepare("SELECT VALOR FROM AD_PARAM WHERE CHAVE=?").get(KEYS[field]) as any;
    return String(r?.VALOR ?? "").trim();
  };
  const baseUrl = await getVal("baseUrl");
  if (!baseUrl || !/^https?:\/\/.+/i.test(baseUrl)) {
    res.status(400).json({ error: "Configure a BASE URL do gateway antes de testar." });
    return;
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  const clientId = await getVal("clientId");
  const clientSecret = await getVal("clientSecret");
  const xToken = await getVal("xToken");
  if (clientId) headers["client_id"] = clientId;
  if (clientSecret) headers["client_secret"] = clientSecret;
  if (xToken) headers["X-Token"] = xToken;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  const inicio = Date.now();
  try {
    const resp = await fetch(baseUrl, { method: "GET", headers, signal: ctrl.signal });
    res.json({
      ok: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      tempoMs: Date.now() - inicio,
    });
  } catch (e: any) {
    res.json({
      ok: false,
      status: 0,
      erro: e?.name === "AbortError" ? "Timeout (8s) ao conectar no gateway" : (e?.message ?? "Falha de conexão"),
      tempoMs: Date.now() - inicio,
    });
  } finally {
    clearTimeout(timer);
  }
});

export default router;
