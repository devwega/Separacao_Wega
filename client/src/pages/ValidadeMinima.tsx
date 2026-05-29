import { useEffect, useState, useCallback } from "react";
import { api, extractErrorMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CalendarClock, Search, Save, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface Parceiro {
  codparc: number; parceiro: string; diasMin: number | null;
  dtAlteracao: string | null; usuario: string | null;
}

export default function ValidadeMinima() {
  const { user } = useAuth();
  const podeEditar = user?.perfil === "ADMINISTRADOR" || user?.perfil === "GERENCIA";
  const [q, setQ] = useState("");
  const [global, setGlobalDias] = useState<number>(30);
  const [globalInput, setGlobalInput] = useState<string>("");
  const [rows, setRows] = useState<Parceiro[]>([]);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/validade-minima", { params: { q } });
      setGlobalDias(data.global);
      setGlobalInput(String(data.global));
      setRows(data.parceiros);
      setEdits({});
    } catch (e) { toast.error(extractErrorMessage(e, "Erro ao carregar")); }
    finally { setLoading(false); }
  }, [q]);

  useEffect(() => { load(); }, [load]);

  const salvarGlobal = async () => {
    try { await api.put("/validade-minima/global", { dias: Number(globalInput) }); toast.success("Padrão global atualizado"); load(); }
    catch (e) { toast.error(extractErrorMessage(e, "Erro")); }
  };

  const salvar = async (codparc: number) => {
    const v = edits[codparc];
    try { await api.put(`/validade-minima/${codparc}`, { dias: Number(v) }); toast.success("Validade mínima salva"); load(); }
    catch (e) { toast.error(extractErrorMessage(e, "Erro")); }
  };

  const limpar = async (codparc: number) => {
    try { await api.delete(`/validade-minima/${codparc}`); toast.success("Voltou a usar o padrão global"); load(); }
    catch (e) { toast.error(extractErrorMessage(e, "Erro")); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <CalendarClock className="w-5 h-5" /> Validade Mínima por Parceiro
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Período mínimo de validade (em dias) exigido na separação (RN-01). Específico do BIPE — não vai para o Sankhya.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Padrão global (dias)</label>
          <div className="flex items-center gap-2 mt-1">
            <Input type="number" min={0} className="w-28" value={globalInput}
              disabled={!podeEditar} onChange={(e) => setGlobalInput(e.target.value)} />
            {podeEditar && (
              <Button size="sm" variant="outline" className="gap-1" onClick={salvarGlobal}>
                <Save className="w-3.5 h-3.5" /> Salvar
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Aplicado a parceiros sem cadastro específico (CV-05).</p>
        </div>
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar parceiro ou código…" className="pl-9" value={q}
            onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[90px]">Código</TableHead>
              <TableHead>Parceiro</TableHead>
              <TableHead className="w-[200px]">Validade mínima (dias)</TableHead>
              <TableHead>Última alteração</TableHead>
              {podeEditar && <TableHead className="w-[160px] text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando…
              </TableCell></TableRow>
            )}
            {!loading && rows.map((p) => {
              const valor = edits[p.codparc] ?? (p.diasMin != null ? String(p.diasMin) : "");
              return (
                <TableRow key={p.codparc}>
                  <TableCell className="text-muted-foreground">{p.codparc}</TableCell>
                  <TableCell className="font-medium">{p.parceiro}</TableCell>
                  <TableCell>
                    <Input type="number" min={0} className="w-28 h-8" disabled={!podeEditar}
                      placeholder={`global (${global})`} value={valor}
                      onChange={(e) => setEdits({ ...edits, [p.codparc]: e.target.value })} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.dtAlteracao ? `${p.dtAlteracao}${p.usuario ? ` · ${p.usuario}` : ""}` : "—"}
                  </TableCell>
                  {podeEditar && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" className="h-7 gap-1"
                          disabled={valor === ""} onClick={() => salvar(p.codparc)}>
                          <Save className="w-3.5 h-3.5" /> Salvar
                        </Button>
                        {p.diasMin != null && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Usar padrão global"
                            onClick={() => limpar(p.codparc)}>
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {!loading && rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum parceiro.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
