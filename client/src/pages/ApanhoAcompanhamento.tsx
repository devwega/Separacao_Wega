import { useEffect, useState, useCallback } from "react";
import { api, extractErrorMessage } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Activity, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const STATUS: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-700", parcial: "bg-sky-100 text-sky-700",
  encontrado: "bg-emerald-100 text-emerald-700", concluido: "bg-slate-100 text-slate-600",
};

export default function ApanhoAcompanhamento() {
  const [rows, setRows] = useState<any[]>([]);
  const [embs, setEmbs] = useState<{ value: string }[]>([]);
  const [emb, setEmb] = useState("todas");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get("/apanho", { params: { embarcacao: emb } }); setRows(data); }
    catch (e) { toast.error(extractErrorMessage(e, "Erro")); } finally { setLoading(false); }
  }, [emb]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get("/apanho/embarcacoes").then(({ data }) => setEmbs(data)).catch(() => {}); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Activity className="w-5 h-5" /> Apanho — Acompanhamento</h1>
          <p className="text-sm text-muted-foreground mt-1">Visibilidade em tempo real dos itens em apanho.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={emb} onValueChange={setEmb}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas embarcações</SelectItem>
              {embs.map((e) => <SelectItem key={e.value} value={e.value}>{e.value}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1" onClick={load}><RotateCcw className="w-4 h-4" /> Atualizar</Button>
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Item</TableHead><TableHead>Embarcação</TableHead>
              <TableHead className="text-center">Falta</TableHead>
              <TableHead className="text-center">Encontrado</TableHead>
              <TableHead className="text-center">Pendente</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando…</TableCell></TableRow>}
            {!loading && rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><div className="font-medium">{r.item}</div><div className="text-xs text-muted-foreground">{r.marca} · {r.pedido}</div></TableCell>
                <TableCell>{r.embarcacao} <span className="text-xs text-muted-foreground">{r.horario}h</span></TableCell>
                <TableCell className="text-center">{r.qtdFalta}</TableCell>
                <TableCell className="text-center text-emerald-700">{r.qtdEncontrada}</TableCell>
                <TableCell className="text-center text-amber-700">{r.qtdPendente}</TableCell>
                <TableCell><Badge className={STATUS[r.status]}>{r.status}</Badge></TableCell>
              </TableRow>
            ))}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum item em apanho.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
