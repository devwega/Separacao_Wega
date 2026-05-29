import { useEffect, useState, useCallback } from "react";
import { api, extractErrorMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const PERFIS = [
  { v: "ADMINISTRADOR", l: "Administrador" },
  { v: "GERENCIA", l: "Gerência" },
  { v: "APROVADOR", l: "Aprovador (Comercial)" },
  { v: "SEPARADOR", l: "Separador" },
];

interface Usuario { codusu: number; nome: string; login: string; perfil: string; ativo: number; }

export default function Usuarios() {
  const { user } = useAuth();
  const isAdmin = user?.perfil === "ADMINISTRADOR";
  const [rows, setRows] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nome: "", login: "", senha: "", perfil: "SEPARADOR" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get("/auth/usuarios"); setRows(data); }
    catch (e) { toast.error(extractErrorMessage(e, "Erro ao carregar usuários")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/auth/usuarios", form);
      toast.success("Usuário criado");
      setForm({ nome: "", login: "", senha: "", perfil: "SEPARADOR" });
      load();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Erro ao criar usuário"));
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" /> Usuários e Perfis
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Gestão de acesso ao sistema (US-02, US-03)</p>
      </div>

      {isAdmin && (
        <form onSubmit={criar} className="bg-card border border-border rounded-lg p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div className="sm:col-span-1">
            <label className="text-xs text-muted-foreground">Nome</label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Login</label>
            <Input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} placeholder="login" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Senha</label>
            <Input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} placeholder="mín. 6 caracteres" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Perfil</label>
            <Select value={form.perfil} onValueChange={(v) => setForm({ ...form, perfil: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERFIS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="gap-2" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Criar
          </Button>
        </form>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nome</TableHead>
              <TableHead>Login</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando…
              </TableCell></TableRow>
            )}
            {!loading && rows.map((u) => (
              <TableRow key={u.codusu}>
                <TableCell className="font-medium">{u.nome}</TableCell>
                <TableCell>{u.login}</TableCell>
                <TableCell>{PERFIS.find((p) => p.v === u.perfil)?.l ?? u.perfil}</TableCell>
                <TableCell>
                  <Badge variant={u.ativo ? "default" : "secondary"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {!loading && rows.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Nenhum usuário.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
