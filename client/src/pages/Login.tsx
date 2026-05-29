import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Loader2, LogIn } from "lucide-react";
import { extractErrorMessage } from "@/lib/api";

export default function Login() {
  const { login } = useAuth();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    try {
      await login(usuario.trim(), senha);
    } catch (err: any) {
      setErro(extractErrorMessage(err, "Falha no login"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-3">
            <Package className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-bold text-foreground">WEGA Marine</h1>
          <p className="text-sm text-muted-foreground">Separação · Troca · Faltas · Apanho</p>
        </div>
        <form onSubmit={submit} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Usuário</label>
            <Input className="mt-1" value={usuario} autoFocus
              onChange={(e) => setUsuario(e.target.value)} placeholder="seu login" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Senha</label>
            <Input className="mt-1" type="password" value={senha}
              onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
          </div>
          {erro && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{erro}</div>
          )}
          <Button type="submit" className="w-full gap-2" disabled={loading || !usuario || !senha}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
