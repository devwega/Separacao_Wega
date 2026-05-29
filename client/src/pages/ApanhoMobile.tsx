import { useEffect, useState, useCallback } from "react";
import { api, extractErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ShoppingCart, Loader2, Check, Ship, MapPin, Camera, QrCode } from "lucide-react";
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

type FormItem = { qtd: string; lote: string; validade: string; nfChave: string; foto: string | null };
const emptyForm = (): FormItem => ({ qtd: "", lote: "", validade: "", nfChave: "", foto: null });

function getGeo(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 },
    );
  });
}

async function fileToFoto(file: File): Promise<{ dataUrl: string; qr: string | null }> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file);
  });
  // downscale via canvas
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = dataUrl;
  });
  const max = 1000;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
  cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
  const small = cv.toDataURL("image/jpeg", 0.6);
  // tenta ler QR/codigo da NF (BarcodeDetector nativo, se disponivel)
  let qr: string | null = null;
  try {
    const BD = (window as any).BarcodeDetector;
    if (BD) {
      const det = new BD({ formats: ["qr_code", "code_128", "data_matrix"] });
      const codes = await det.detect(img);
      if (codes && codes[0]) qr = codes[0].rawValue;
    }
  } catch { /* sem suporte */ }
  return { dataUrl: small, qr };
}

export default function ApanhoMobile() {
  const [rows, setRows] = useState<ItemApanho[]>([]);
  const [embs, setEmbs] = useState<{ value: string }[]>([]);
  const [emb, setEmb] = useState("todas");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<number, FormItem>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get("/apanho", { params: { embarcacao: emb } }); setRows(data); }
    catch (e) { toast.error(extractErrorMessage(e, "Erro")); } finally { setLoading(false); }
  }, [emb]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get("/apanho/embarcacoes").then(({ data }) => setEmbs(data)).catch(() => {}); }, []);

  const upd = (id: number, k: keyof FormItem, v: any) => {
    setForm((f) => ({ ...f, [id]: { ...(f[id] || emptyForm()), [k]: v } }));
  };

  const onFoto = async (id: number, file?: File) => {
    if (!file) return;
    try {
      const { dataUrl, qr } = await fileToFoto(file);
      setForm((f) => ({ ...f, [id]: { ...(f[id] || emptyForm()), foto: dataUrl, nfChave: qr || (f[id]?.nfChave ?? "") } }));
      if (qr) toast.success("Chave da NF lida do QR/código");
    } catch { toast.error("Não foi possível processar a foto"); }
  };

  const registrar = async (id: number) => {
    const f = form[id] || emptyForm();
    setSaving(id);
    try {
      const geo = await getGeo();
      await api.post(`/apanho/${id}/registrar`, {
        qtd: Number(f.qtd), lote: f.lote, validade: f.validade,
        nfChave: f.nfChave, nfFoto: f.foto,
        lat: geo?.lat, lng: geo?.lng,
      });
      toast.success(geo ? "Apanho registrado (com GPS)" : "Apanho registrado");
      setForm((s) => ({ ...s, [id]: emptyForm() }));
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
        const f = form[r.id] || emptyForm();
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
              <Input placeholder="Qtd" type="number" value={f.qtd} onChange={(e) => upd(r.id, "qtd", e.target.value)} />
              <Input placeholder="Lote" value={f.lote} onChange={(e) => upd(r.id, "lote", e.target.value)} />
              <Input placeholder="Validade" type="date" value={f.validade} onChange={(e) => upd(r.id, "validade", e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Input placeholder="Chave da NF (ou leia o QR)" value={f.nfChave}
                onChange={(e) => upd(r.id, "nfChave", e.target.value)} className="flex-1" />
              <label className="shrink-0">
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => onFoto(r.id, e.target.files?.[0])} />
                <span className="flex items-center gap-1 px-3 h-9 rounded-md border border-input text-sm cursor-pointer hover:bg-accent">
                  {f.foto ? <QrCode className="w-4 h-4 text-emerald-600" /> : <Camera className="w-4 h-4" />} NF
                </span>
              </label>
            </div>
            {f.foto && <img src={f.foto} alt="NF" className="h-20 rounded border border-border object-cover" />}
            <Button className="w-full gap-2" disabled={saving === r.id || !f.qtd} onClick={() => registrar(r.id)}>
              {saving === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <MapPin className="w-3.5 h-3.5" /> Registrar apanho
            </Button>
          </div>
        );
      })}
    </div>
  );
}
