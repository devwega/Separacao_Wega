import { useEffect, useState, useCallback } from "react";
import { api, extractErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ShoppingCart, Loader2, Check, Ship } from "lucide-react";
import { toast } from "sonner";

interface ItemApanho {
  id: number; pedido: string; embarcacao: string; horario: string; parceiro: string;
  item: string; marca: string; codigo: string; qtdFalta: number; qtdEncontrada: number;
  qtdPendente: number; status: string;
}
const STATUS: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-700", parcial: "bg-sky-100 text-sky-700",
  encontrado: "bg-emerald-100 text-emerald-700", concluido: "bg-slate-100 text-slate-600",
};

export default function ApanhoMobile() {
  const [rows, setRows] = useState<ItemApanho[]>([]);
  const [embs, setEmbs] = useState<{ value: string }[]>([]);
  const [emb, setEmb] = useState("todas");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<number, { qtd: string; lote: string; validade: string }>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/apanho", { params: { embarcacao: emb } });
      setRows(data);
    } catch (e) { toast.error(extractErrorMessage(e, "Erro")); } finally { setLoading(false); }
  }, [emb]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get("/apanho/embarcacoes").then(({ data }) => setEmbs(data)).catch(() => {}); }, []);

  const registrar = async (id: number) => {
    const f = form[id] || { qtd: "", lote: "", validade: "" };
    setSaving(id);
    try {
      await api.post(`/apanho/${id}/registrar`, { qtd: Number(f.qtd), lote: f.lote, validade: f.validade });
      toast.success("Apanho registrado");
      setForm({ ...form, [id]: { qtd: "", lote: "", validade: "" } });
      load();
    } catch (e) { toast.error(extractErrorMessage(e, "Erro ao registrar")); } finally { setSaving(null); }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Apanho (campo)</h1>
        <Select value={emb} onValueChange={setEmb}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas embarcações</SelectItem>
            {embs.map((e) => <SelectItem key={e.value} value={e.value}>{e.value}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading && <div className="text-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando…</div>}
      {!loading && rows.length === 0 && <div className="text-center py-10 text-muted-foreground">Nenhum item em apanho.</div>}

      {rows.map((r) => {
        const f = form[r.id] || { qtd: "", lote: "", validade: "" };
        const upd = (k: string, v: string) => setForm({ ...form, [r.id]: { ...f, [k]: v } });
        return (
          <div key={r.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{r.item}</p>
                <p className="text-xs text-muted-foreground">{r.marca} · {r.codigo}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Ship className="w-3 h-3" /> {r.embarcacao} · {r.horario}h · {r.parceiro}</p>
              </div>
              <Badge className={STATUS[r.status]}>{r.status}</Badge>
            </div>
            <div className="flex gap-3 text-sm">
              <span>Falta: <b>{r.qtdFalta}</b></span>
              <span className="text-emerald-700">Encontrado: <b>{r.qtdEncontrada}</b></span>
              <span className="text-amber-700">Pendente: <b>{r.qtdPendente}</b></span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Qtd" type="number" value={f.qtd} onChange={(e) => upd("qtd", e.target.value)} />
              <Input placeholder="Lote" value={f.lote} onChange={(e) => upd("lote", e.target.value)} />
              <Input placeholder="Validade" type="date" value={f.validade} onChange={(e) => upd("validade", e.target.value)} />
            </div>
            <Button className="w-full gap-2" disabled={saving === r.id || !f.qtd} onClick={() => registrar(r.id)}>
              {saving === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Registrar apanho
            </Button>
          </div>
        );
      })}
    </div>
  );
}
