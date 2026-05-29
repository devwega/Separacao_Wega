import { useEffect, useState, useCallback } from "react";
import { api, extractErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Loader2, Check, QrCode, MapPin } from "lucide-react";
import { toast } from "sonner";

interface Reg { id: number; qtd: number; lote: string | null; validade: string | null; dtReg: string; conferido: number; usuario: string | null; lat: number | null; lng: number | null; nfChave: string | null; nfFoto: string | null; }

function ItemConf({ item, onChange }: { item: any; onChange: () => void }) {
  const [regs, setRegs] = useState<Reg[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const carregar = async () => {
    setLoading(true);
    try { const { data } = await api.get(`/apanho/registros/${item.id}`); setRegs(data); }
    finally { setLoading(false); }
  };
  const toggle = () => { const n = !open; setOpen(n); if (n) carregar(); };
  const conferir = async (nureg: number) => {
    try {
      const { data } = await api.post(`/apanho/registro/${nureg}/conferir`, {});
      toast.success(data.faltaBaixada ? "Conferido — falta baixada e item incluído no pedido!" : "Registro conferido");
      carregar(); onChange();
    } catch (e) { toast.error(extractErrorMessage(e, "Erro")); }
  };
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between cursor-pointer" onClick={toggle}>
        <div>
          <p className="font-medium">{item.item} <span className="text-xs text-muted-foreground">{item.marca}</span></p>
          <p className="text-xs text-muted-foreground">{item.embarcacao} · {item.parceiro} · falta {item.qtdFalta}, encontrado {item.qtdEncontrada}</p>
        </div>
        <Badge variant="secondary">{open ? "ocultar" : "conferir"}</Badge>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          {loading && <div className="text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Carregando…</div>}
          {regs.map((r) => (
            <div key={r.id} className="border border-border rounded-md px-3 py-2 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span>Qtd <b>{r.qtd}</b>{r.lote ? ` · lote ${r.lote}` : ""}{r.validade ? ` · val ${r.validade}` : ""} <span className="text-xs text-muted-foreground">({r.usuario ?? "—"})</span></span>
                {r.conferido ? <Badge className="bg-emerald-100 text-emerald-700">conferido</Badge>
                  : <Button size="sm" className="h-7 gap-1" onClick={() => conferir(r.id)}><Check className="w-3.5 h-3.5" /> Conferir</Button>}
              </div>
              {(r.nfChave || (r.lat != null && r.lng != null) || r.nfFoto) && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  {r.nfChave && <span className="flex items-center gap-1"><QrCode className="w-3 h-3" /> {r.nfChave}</span>}
                  {(r.lat != null && r.lng != null) && (
                    <a className="flex items-center gap-1 text-sky-600 hover:underline" target="_blank" rel="noreferrer"
                       href={`https://www.google.com/maps?q=${r.lat},${r.lng}`}><MapPin className="w-3 h-3" /> local do apanho</a>
                  )}
                  {r.nfFoto && <a href={r.nfFoto} target="_blank" rel="noreferrer"><img src={r.nfFoto} alt="NF" className="h-12 rounded border border-border" /></a>}
                </div>
              )}
            </div>
          ))}
          {!loading && regs.length === 0 && <p className="text-sm text-muted-foreground">Sem registros.</p>}
        </div>
      )}
    </div>
  );
}

export default function ApanhoConferencia() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get("/apanho/conferencia"); setRows(data); }
    catch (e) { toast.error(extractErrorMessage(e, "Erro")); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><ClipboardCheck className="w-5 h-5" /> Conferência de Apanho</h1>
        <p className="text-sm text-muted-foreground mt-1">Valida os itens trazidos do apanho; ao conferir, a falta é baixada e o item entra no pedido.</p>
      </div>
      {loading && <div className="text-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando…</div>}
      {!loading && rows.length === 0 && <div className="text-center py-10 text-muted-foreground">Nada a conferir.</div>}
      {rows.map((it) => <ItemConf key={it.id} item={it} onChange={load} />)}
    </div>
  );
}
