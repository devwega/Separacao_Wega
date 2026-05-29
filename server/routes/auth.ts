import { Router } from "express";
import { getDb } from "../db/index.js";
import { hashPassword, verifyPassword, signToken, requireAuth, requirePerfil } from "../auth.js";

const router = Router();

const PERFIS = ["ADMINISTRADOR", "GERENCIA", "APROVADOR", "SEPARADOR"];

/** POST /api/auth/login  { login, senha } */
router.post("/login", async (req, res) => {
  const { login, senha } = (req.body ?? {}) as { login?: string; senha?: string };
  if (!login || !senha) {
    res.status(400).json({ error: "Informe login e senha" });
    return;
  }
  const db = getDb();
  const row = await db.prepare(`
    SELECT L.CODUSU, L.LOGIN, L.SENHA, L.ATIVO, U.NOMEUSU, U.PERFIL
    FROM AD_LOGIN L JOIN TSIUSU U ON U.CODUSU = L.CODUSU
    WHERE LOWER(L.LOGIN) = LOWER(?)
  `).get(login) as any;

  if (!row || !row.ATIVO || !verifyPassword(senha, row.SENHA)) {
    res.status(401).json({ error: "Login ou senha invalidos" });
    return;
  }
  const user = { codusu: row.CODUSU, login: row.LOGIN, nome: row.NOMEUSU, perfil: row.PERFIL };
  const token = signToken(user);
  res.json({ token, user });
});

/** GET /api/auth/me */
router.get("/me", requireAuth, (req, res) => {
  const u = (req as any).user;
  res.json({ user: { codusu: u.codusu, login: u.login, nome: u.nome, perfil: u.perfil } });
});

/** GET /api/auth/usuarios  (admin/gerencia) */
router.get("/usuarios", requireAuth, requirePerfil("ADMINISTRADOR", "GERENCIA"), async (_req, res) => {
  const db = getDb();
  const rows = await db.prepare(`
    SELECT U.CODUSU AS codusu, U.NOMEUSU AS nome, U.PERFIL AS perfil,
           L.LOGIN AS login, COALESCE(L.ATIVO,1) AS ativo, L.DTCRIACAO AS dtCriacao
    FROM TSIUSU U LEFT JOIN AD_LOGIN L ON L.CODUSU = U.CODUSU
    WHERE L.LOGIN IS NOT NULL
    ORDER BY U.NOMEUSU
  `).all();
  res.json(rows);
});

/** POST /api/auth/usuarios  (admin) — cria usuario com login */
router.post("/usuarios", requireAuth, requirePerfil("ADMINISTRADOR"), async (req, res) => {
  const { nome, login, senha, perfil } = (req.body ?? {}) as any;
  if (!nome || String(nome).trim().length < 2) { res.status(400).json({ error: "Nome obrigatorio" }); return; }
  if (!login || String(login).trim().length < 3) { res.status(400).json({ error: "Login deve ter ao menos 3 caracteres" }); return; }
  if (!senha || String(senha).length < 6) { res.status(400).json({ error: "Senha deve ter ao menos 6 caracteres" }); return; }
  if (!PERFIS.includes(perfil)) { res.status(400).json({ error: "Perfil invalido" }); return; }

  const db = getDb();
  const ex = await db.prepare("SELECT 1 FROM AD_LOGIN WHERE LOWER(LOGIN)=LOWER(?)").get(login);
  if (ex) { res.status(409).json({ error: "Login ja existe" }); return; }

  const next = await db.prepare("SELECT COALESCE(MAX(CODUSU),0)+1 AS n FROM TSIUSU").get() as any;
  const codusu = Number(next.n);
  const grupo = perfil === "ADMINISTRADOR" ? 4 : perfil === "GERENCIA" ? 4 : perfil === "APROVADOR" ? 2 : 1;
  await db.prepare("INSERT OR REPLACE INTO TSIUSU (CODUSU, NOMEUSU, CODGRUPO, PERFIL) VALUES (?,?,?,?)")
    .run(codusu, String(nome).trim(), grupo, perfil);
  await db.prepare("INSERT INTO AD_LOGIN (CODUSU, LOGIN, SENHA, ATIVO, DTCRIACAO) VALUES (?,?,?,1,datetime('now','localtime'))")
    .run(codusu, String(login).trim(), hashPassword(String(senha)));
  res.json({ ok: true, codusu });
});

/** PUT /api/auth/usuarios/:codusu  (admin) — atualiza nome/perfil/ativo/senha */
router.put("/usuarios/:codusu", requireAuth, requirePerfil("ADMINISTRADOR"), async (req, res) => {
  const codusu = Number(req.params.codusu);
  const { nome, perfil, ativo, senha } = (req.body ?? {}) as any;
  const db = getDb();
  if (nome) await db.prepare("UPDATE TSIUSU SET NOMEUSU=? WHERE CODUSU=?").run(String(nome).trim(), codusu);
  if (perfil && PERFIS.includes(perfil)) await db.prepare("UPDATE TSIUSU SET PERFIL=? WHERE CODUSU=?").run(perfil, codusu);
  if (typeof ativo === "boolean") await db.prepare("UPDATE AD_LOGIN SET ATIVO=? WHERE CODUSU=?").run(ativo ? 1 : 0, codusu);
  if (senha && String(senha).length >= 6) await db.prepare("UPDATE AD_LOGIN SET SENHA=? WHERE CODUSU=?").run(hashPassword(String(senha)), codusu);
  res.json({ ok: true });
});

export default router;
