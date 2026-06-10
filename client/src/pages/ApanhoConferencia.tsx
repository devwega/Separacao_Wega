/**
 * Conferência de Apanho — consolidada POR SESSÃO.
 * O conferente escolhe a sessão (card no modelo de "compradores em campo" + NF/cupom),
 * vê os itens separados por embarcação e confere item a item num modal com as mesmas
 * validações do BIPE Separação (EAN, lote, validade, equivalência).
 * Conferência divergente do digitado pelo comprador → pergunta "substituir informações
 * do apanho pela conferência?". Ao conferir, o item do pedido é atualizado e fica
 * marcado como "SEPARADO E CONFERIDO POR APANHO" no BIPE.
 */
import { useEffect, useState, useCallback } from "react";
import { api, extractErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  ClipboardCheck, Loader2, Check, QrCode, User, Store, Clock, Ship, ArrowLeft,
  ScanBarcode, Package, XCircle, Layers, Calendar, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ItemConf = {
  nureg: number; qtd: number; lote: string | null; validade: string | null; dtReg: string;
  nufaltaitem: number; nunota: number; sequencia: number; codprod: number; qtdFalta: number;
  embarcacao: string; pedido: string; parceiro: string; item: string; marca: string | null; ean: string | null;
};
type SessaoConf = {
  nusessao: number; comprador: string; mercado: string; statusSessao: string;
  nfChave: string | null; nfFoto: string | null; dtInicio: string; dtFim: string | null;
  itens: ItemConf[];
};
type Validacao = {
  ok: boolean; match?: string; motivo?: string;
  flags?: { eanOk: boolean; marcaOk?: boolean; loteOk: boolean; validadeOk: boolean; equivalenciaOk: boolean; shelfLifeOk: boolean };
};

const norm = (s: any) => String(s ?? "").trim().toUpperCase();

export default function ApanhoConferencia() {
  const [sessoes, setSessoes] = useState<SessaoConf[]>([]);
  const [avulsos, setAvulsos] = useState<ItemConf[]>([]);
  const [loading, setLoading] = useState(true);
  const [selSessao, setSelSessao] = useState<number | null>(null);

  // Modal de conferência do item
  const [confItem, setConfItem] = useState<ItemConf | null>(null);
  const [ean, setEan] = useState("");
  const [lote, setLote] = useState("");
  const [validade, setValidade] = useState("");
  const [qtd, setQtd] = useState("");
  const [validacao, setValidacao] = useState<Validacao | null>(null);
  const [validando, setValidando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  // Confirmação de substituição (conferência diferente do digitado pelo comprador)
  const [substituirOpen, setSubstituirOpen] = useState(false);

  const load = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get("/apanho/sessoes-conferencia");
      setSessoes(data.sessoes ?? []);
      setAvulsos(data.avulsos ?? []);
    } catch (e) { if (!silent) toast.error(extractErrorMessage(e, "Erro ao carregar")); }
    finally { if (!silent) setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const hora = (s?: string | null) => {
    if (!s) return "—";
    const d = new Date(String(s).replace(" ", "T"));
    return isNaN(+d) ? s : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const sessaoAtual = sessoes.find((s) => s.nusessao === selSessao) ?? null;
  const itensAtuais: ItemConf[] = selSessao === -1 ? avulsos : (sessaoAtual?.itens ?? []);
  const porEmbarcacao = itensAtuais.reduce<Record<string, ItemConf[]>>((acc, it) => {
    (acc[it.embarcacao] ??= []).push(it);
    return acc;
  }, {});

  const abrirConferencia = (it: ItemConf) => {
    setConfItem(it);
    setEan(""); setValidacao(null);
    // pré-preenche com o que o comprador digitou — o conferente confirma ou corrige
    setLote(it.lote ?? "");
    setValidade(it.validade ?? "");
    setQtd(String(it.qtd ?? ""));
  };

  const validarEan = async () => {
    if (!confItem) return;
    if (!ean.trim()) { toast.error("Bipe ou digite o EAN."); return; }
    setValidando(true);
    try {
      const { data } = await api.post<Validacao>("/bipagem/validar-ean", {
        nunota: confItem.nunota, sequencia: confItem.sequencia, ean: ean.trim(), lote, validade,
      });
      setValidacao(data);
    } catch (e) { toast.error(extractErrorMessage(e, "Erro ao validar EAN")); }
    finally { setValidando(false); }
  };

  const conferenciaIgual = () => {
    if (!confItem) return false;
    return Number(qtd) === Number(confItem.qtd)
      && norm(lote) === norm(confItem.lote)
      && norm(validade) === norm(confItem.validade);
  };

  const enviarConferencia = async (substituir: boolean) => {
    if (!confItem) return;
    setConfirmando(true);
    try {
      const { data } = await api.post(`/apanho/registro/${confItem.nureg}/conferir`,
        substituir ? { qtd: Number(qtd), lote, validade, substituir: true } : {});
      toast.success(data.faltaBaixada
        ? "Apanho concluído — item atualizado no BIPE como SEPARADO E CONFERIDO POR APANHO"
        : "Registro conferido — item atualizado no BIPE");
      setSubstituirOpen(false);
      setConfItem(null);
      await load(true);
    } catch (e) { toast.error(extractErrorMessage(e, "Erro ao conferir")); }
    finally { setConfirmando(false); }
  };

  const confirmarConferencia = () => {
    if (!confItem) return;
    if (!validacao) { toast.error("Bipe e valide o EAN antes de confirmar."); return; }
    if (!validacao.ok) { toast.error("Resolva os erros de validação antes de confirmar."); return; }
    if (!Number(qtd) || Number(qtd) <= 0) { toast.error("Informe a quantidade conferida."); return; }
    if (conferenciaIgual()) {
      enviarConferencia(false);
    } else {
      // diferente do digitado pelo comprador → pergunta se substitui
      setSubstituirOpen(true);
    }
  };

  // ---------- Lista de sessões ----------
  if (selSessao == null) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ClipboardCheck className="w-5 h-5" /> Conferência de Apanho</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conferência consolidada por sessão de apanho. Escolha a sessão para conferir os itens por embarcação.
          </p>
        </div>
        {loading && <div className="text-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando…</div>}
        {!loading && sessoes.length === 0 && avulsos.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">Nada a conferir.</div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sessoes.map((s) => (
            <div key={s.nusessao} className="bg-card border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm flex items-center gap-1"><User className="w-3.5 h-3.5" /> {s.comprador}</span>
                <Badge className={cn("text-[10px]",
                  s.statusSessao === "FINALIZADA"
                    ? "bg-slate-100 text-slate-700 border-slate-200"
                    : "bg-emerald-100 text-emerald-700 border-emerald-200")}>
                  {s.statusSessao === "FINALIZADA" ? "finalizada" : "em sessão"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Store className="w-3 h-3" /> {s.mercado}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> início {hora(s.dtInicio)}{s.dtFim ? ` · fim ${hora(s.dtFim)}` : ""}
              </p>
              <p className="text-xs flex items-center gap-1">
                <QrCode className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">NF/Cupom:</span>
                <span className="font-mono font-medium text-foreground">{s.nfChave ?? "—"}</span>
              </p>
              {s.nfFoto && (
                <a href={s.nfFoto} target="_blank" rel="noreferrer">
                  <img src={s.nfFoto} alt="NF da sessão" className="h-14 rounded border border-border" />
                </a>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">{s.itens.length} registro(s) a conferir</span>
                <Button size="sm" className="h-8 gap-1.5" onClick={() => setSelSessao(s.nusessao)}>
                  <ClipboardCheck className="w-3.5 h-3.5" /> Conferir sessão
                </Button>
              </div>
            </div>
          ))}
          {avulsos.length > 0 && (
            <div className="bg-card border border-dashed border-border rounded-lg p-4 space-y-2">
              <span className="font-medium text-sm flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Registros avulsos</span>
              <p className="text-xs text-muted-foreground">Apanhos registrados fora de sessão.</p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">{avulsos.length} registro(s) a conferir</span>
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setSelSessao(-1)}>
                  <ClipboardCheck className="w-3.5 h-3.5" /> Conferir
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- Itens da sessão (por embarcação) ----------
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1"
            onClick={() => setSelSessao(null)}>
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar às sessões
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            {selSessao === -1 ? "Registros avulsos" : `Sessão de ${sessaoAtual?.comprador ?? "—"}`}
          </h1>
          {sessaoAtual && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {sessaoAtual.mercado} · NF/Cupom: <span className="font-mono">{sessaoAtual.nfChave ?? "—"}</span>
            </p>
          )}
        </div>
      </div>

      {itensAtuais.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          Todos os registros desta sessão foram conferidos. <button className="text-primary hover:underline" onClick={() => setSelSessao(null)}>Voltar</button>
        </div>
      )}

      {Object.entries(porEmbarcacao).map(([emb, itens]) => (
        <div key={emb} className="bg-card border border-border rounded-lg p-4 space-y-2">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Ship className="w-4 h-4 text-primary" /> {emb}
            <span className="text-xs text-muted-foreground font-normal">· {itens[0]?.parceiro} · {itens[0]?.pedido}</span>
          </p>
          <div className="divide-y divide-border">
            {itens.map((it) => (
              <div key={it.nureg} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{it.item}</p>
                  <p className="text-xs text-muted-foreground">
                    Marca: <span className="font-medium text-foreground">{it.marca ?? "—"}</span>
                    {" · "}Comprador registrou: <b>{it.qtd}</b> un
                    {it.lote ? ` · lote ${it.lote}` : ""}{it.validade ? ` · val ${it.validade}` : ""}
                  </p>
                </div>
                <Button size="sm" className="h-8 gap-1.5 shrink-0" onClick={() => abrirConferencia(it)}>
                  <Check className="w-3.5 h-3.5" /> Conferir
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Modal — conferência do item (mesmos campos/validações do BIPE Separação) */}
      <Dialog open={!!confItem} onOpenChange={(o) => { if (!o) setConfItem(null); }}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanBarcode className="w-5 h-5 text-primary" /> Conferir item do apanho
            </DialogTitle>
            <DialogDescription>
              {confItem?.item} — {confItem?.embarcacao} · {confItem?.pedido}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Digitado pelo comprador:</span>{" "}
              {confItem?.qtd} un{confItem?.lote ? ` · lote ${confItem.lote}` : ""}{confItem?.validade ? ` · validade ${confItem.validade}` : ""}
              {" · "}Marca: {confItem?.marca ?? "—"}
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1 mb-1.5">
                <ScanBarcode className="w-3.5 h-3.5 text-primary" /> Leitura do EAN (bipe e pressione Enter)
              </Label>
              <Input
                placeholder="Bipe ou digite o código EAN…"
                className="h-10 text-sm font-mono border-2 border-primary/30 focus:border-primary"
                value={ean}
                onChange={(e) => { setEan(e.target.value); setValidacao(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") validarEan(); }}
                autoFocus
              />
              {validacao && (
                <div className={cn("mt-1.5 text-xs px-3 py-1.5 rounded-md border",
                  validacao.ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200")}>
                  {validacao.ok ? `✓ EAN válido (match: ${validacao.match})` : `✗ ${validacao.motivo}`}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Layers className="w-3 h-3" /> Lote</Label>
                <Input className="h-9 text-sm" value={lote} onChange={(e) => setLote(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Calendar className="w-3 h-3" /> Validade</Label>
                <Input type="date" className="h-9 text-sm" value={validade} onChange={(e) => setValidade(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Package className="w-3 h-3" /> Qtd conferida</Label>
                <Input type="number" className="h-9 text-sm" value={qtd} onChange={(e) => setQtd(e.target.value)} />
              </div>
            </div>
            <div className="border border-dashed border-border rounded-lg p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Resultado da validação</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "EAN", flag: validacao?.flags?.eanOk && validacao?.flags?.marcaOk !== false },
                  { label: "Lote", flag: validacao?.flags?.loteOk },
                  { label: "Validade", flag: validacao?.flags?.validadeOk && validacao?.flags?.shelfLifeOk },
                  { label: "Equiv.", flag: validacao?.flags?.equivalenciaOk },
                ].map((v) => (
                  <span key={v.label} className={cn("text-[11px] px-1.5 py-1 rounded border text-center",
                    v.flag === undefined ? "bg-muted text-muted-foreground border-border"
                      : v.flag ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-red-50 text-red-700 border-red-200")}>
                    {v.flag === false ? "✗" : "✓"} {v.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfItem(null)}>Cancelar</Button>
            <Button onClick={confirmarConferencia} disabled={confirmando || validando} className="gap-1.5">
              {confirmando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirmar conferência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação — conferência diferente do digitado pelo comprador */}
      <Dialog open={substituirOpen} onOpenChange={setSubstituirOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Conferência divergente
            </DialogTitle>
            <DialogDescription>
              Os valores conferidos são diferentes dos digitados pelo comprador do apanho.
              Substituir informações do apanho pela conferência?
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs space-y-1 rounded-md border border-border bg-muted/40 px-3 py-2">
            <p><span className="text-muted-foreground">Comprador:</span> {confItem?.qtd} un{confItem?.lote ? ` · lote ${confItem.lote}` : ""}{confItem?.validade ? ` · val ${confItem.validade}` : ""}</p>
            <p><span className="text-muted-foreground">Conferência:</span> <b>{qtd}</b> un{lote ? ` · lote ${lote}` : ""}{validade ? ` · val ${validade}` : ""}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="gap-1.5" onClick={() => setSubstituirOpen(false)}>
              <XCircle className="w-4 h-4" /> Não — corrigir conferência
            </Button>
            <Button className="gap-1.5 bg-amber-600 hover:bg-amber-700" disabled={confirmando}
              onClick={() => enviarConferencia(true)}>
              {confirmando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Sim — substituir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
