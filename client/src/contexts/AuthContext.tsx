import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, tokenStore } from "@/lib/api";

export type Perfil = "ADMINISTRADOR" | "GERENCIA" | "APROVADOR" | "SEPARADOR";
export interface AuthUser { codusu: number; login: string; nome: string; perfil: Perfil; }

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (login: string, senha: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({
  user: null, loading: true, login: async () => {}, logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!tokenStore.get()) { setLoading(false); return; }
      try {
        const { data } = await api.get("/auth/me");
        setUser(data.user);
      } catch {
        tokenStore.clear();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (login: string, senha: string) => {
    const { data } = await api.post("/auth/login", { login, senha });
    tokenStore.set(data.token);
    setUser(data.user);
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
