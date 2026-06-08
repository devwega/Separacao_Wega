/**
 * Tela de Apanho (campo) — Seção 5.
 * 5.1 exige geolocalização ligada; 5.2 inicia sessão (mercado + login/senha);
 * 5.3 cards sem NF durante a sessão, NF só ao finalizar; 5.4 total por produto + quebra
 * por embarcação, lote/validade por embarcação (com múltiplos lotes — botão +).
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { api, extractErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  ShoppingCart, Loader2, Check, Ship, MapPin, Plus, XCircle, Lock, User, Store, Flag,
  ChevronDown, ChevronRight, Package, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Embarc = { nufaltaitem: number; nunota: number; embarcacao: string; parceiro: string; qtdFalta: number; qtdEncontrada: number };
type Grupo = { codprod: number; item: string; marca: string; qtdFaltaTotal: number; qtdEncontradaTotal: number; qtdPendenteTotal: number; embarcacoes: Embarc[] };
type Sessao = { nusessao: number; comprador: string; mercado: string };
type LoteRow = { lote: string; validade: string; qtd: string };

const SESSAO_KEY = "apanho_sessao";

function getGeo(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 },
    );
  });
}

export default function ApanhoMobile() {
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoChecked, setGeoChecked] = useState(false);
  const [resumo, setResumo] = useState<{ totalItens: number; totalEmbarcacoes: number; totalUnidades: number } | null>(null);
  const [sessao, setSessao] = useState<Sessao | null>(() => {
    try { const s = localStorage.getItem(SESSAO_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(false);
  const [expand, setExpand] = useState<number | null>(null);
  const [forms, setForms] = useState<Record<number, LoteRow[]>>({});
  const [savingFalta, setSavingFalta] = useState<number | null>(null);

  // modais
  const [startOpen, setStartOpen] = useState(false);
  const [mercado, setMercado] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [starting, setStarting] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [nfChave, setNfChave] = useState("");
  const [ending, setEnding] = useState(false);

  const refreshGeo = useCallback(async () => { setGeo(await getGeo()); setGeoChecked(true); }, []);
  useEffect(() => { refreshGeo(); }, [refreshGeo]);
  useEffect(() => { api.get("/apanho/resumo").then(({ data }) => setResumo(data)).catch(() => {}); }, []);

  const carregarGrupos = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get<Grupo[]>("/apanho/agrupado"); setGrupos(data ?? []); }
    catch (e) { toast.error(extractErrorMessage(e, "Erro ao carregar itens")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (sessao) carregarGrupos(); }, [sessao, carregarGrupos]);

  // 6.1: heartbeat de localização enquanto a sessão está ativa
  const geoRef = useRef(geo); geoRef.current = geo;
  useEffect(() => {
    if (!sessao) return;
    const tick = async () => {
      const g = await getGeo();
      if (g) { setGeo(g); api.post(`/apanho/sessao/${sessao.nusessao}/local`, g).catch(() => {}); }
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [sessao]);

  const persistSessao = (s: Sessao | null) => {
    setSessao(s);
    try { s ? localStorage.setItem(SESSAO_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSAO_KEY); } catch { /* ignore */ }
  };

  const iniciarSessao = async () => {
    if (!mercado.trim()) { toast.error("Informe o mercado/local da compra."); return; }
    if (!login || !senha) { toast.error("Informe login e senha."); return; }
    setStarting(true);
    try {
      const g = geo ?? (await getGeo());
      const { data } = await api.post("/apanho/sessao/iniciar", { mercado: mercado.trim(), login, senha, lat: g?.lat, lng: g?.lng });
      persistSessao({ nusessao: data.nusessao, comprador: data.comprador, mercado: mercado.trim() });
      setStartOpen(false); setLogin(""); setSenha("");
      toast.success("Sessão de apanho iniciada");
    } catch (e) { toast.error(extractErrorMessage(e, "Falha ao iniciar sessão")); }
    finally { setStarting(false); }
  };

  const finalizarSessao = async () => {
    if (!sessao) return;
    if (!nfChave.trim()) { toast.error("Informe a NF/cupom fiscal da sessão."); return; }
    setEnding(true);
    try {
      await api.post(`/apanho/sessao/${sessao.nusessao}/finalizar`, { nfChave: nfChave.trim() });
      persistSessao(null); setEndOpen(false); setNfChave(""); setGrupos([]);
      api.get("/apanho/resumo").then(({ data }) => setResumo(data)).catch(() => {});
      toast.success("Sessão finalizada");
    } catch (e) { toast.error(extractErrorMessage(e, "Falha ao finalizar")); }
    finally { setEnding(false); }
  };

  const getRows = (nf: number): LoteRow[] => forms[nf] ?? [{ lote: "", validade: "", qtd: "" }];
  const setRows = (nf: number, rows: LoteRow[]) => setForms((f) => ({ ...f, [nf]: rows }));

  const registrarEmbarc = async (e: Embarc) => {
    const rows = getRows(e.nufaltaitem).filter((r) => Number(r.qtd) > 0);
    if (rows.length === 0) { toast.error("Informe ao menos uma quantidade."); return; }
    setSavingFalta(e.nufaltaitem);
    try {
      const g = geo ?? (await getGeo());
      for (const r of rows) {
        await api.post(`/apanho/${e.nufaltaitem}/registrar`, {
          qtd: Number(r.qtd), lote: r.lote, validade: r.validade,
          nusessao: sessao?.nusessao, lat: g?.lat, lng: g?.lng,
        });
      }
      toast.success(`Apanho registrado p/ ${e.embarcacao}`);
      setForms((f) => ({ ...f, [e.nufaltaitem]: [{ lote: "", validade: "", qtd: "" }] }));
      carregarGrupos();
    } catch (err) { toast.error(extractErrorMessage(err, "Erro ao registrar")); }
    finally { setSavingFalta(null); }
  };

  // ----- Gate de geolocalização (5.1) -----
  if (geoChecked && !geo) {
    return (
      <div className="max-w-md mx-auto mt-10 text-center space-y-4">
        <MapPin className="w-12 h-12 mx-auto text-amber-500" />
        <h1 className="text-lg font-bold">Ative a localização</h1>
        <p className="text-sm text-muted-foreground">
          Para o apanho em campo é necessário permitir o acesso à localização do celular.
        </p>
        <Button onClick={refreshGeo} className="gap-2"><MapPin className="w-4 h-4" /> Permitir e tentar de novo</Button>
      </div>
    );
  }

  // ----- Sem sessão: resumo + iniciar (5.2) -----
  if (!sessao) {
    return (
      <div className="max-w-xl mx-auto space-y-5">
        <h1 className="text-lg font-bold flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Apanho (campo)</h1>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{resumo?.totalItens ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Itens p/ apanho</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{resumo?.totalEmbarcacoes ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Embarcações</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{resumo?.totalUnidades ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Unidades</p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
          <MapPin className="w-3 h-3 text-emerald-600" /> Localização ativa
        </div>
        <Button className="w-full h-12 gap-2 text-base" onClick={() => setStartOpen(true)}>
          <ShoppingCart className="w-5 h-5" /> Iniciar sessão de apanho
        </Button>

        <Dialog open={startOpen} onOpenChange={setStartOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Store className="w-5 h-5 text-primary" /> Iniciar sessão</DialogTitle>
              <DialogDescription>Informe o mercado onde fará as compras e confirme com seu login e senha.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs flex items-center gap-1"><Store className="w-3 h-3" /> Mercado / local da compra</Label>
                <Input value={mercado} onChange={(e) => setMercado(e.target.value)} placeholder="Ex.: Atacadão Centro" className="h-9" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs flex items-center gap-1"><User className="w-3 h-3" /> Login</Label>
                  <Input value={login} onChange={(e) => setLogin(e.target.value)} className="h-9" autoComplete="username" />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><Lock className="w-3 h-3" /> Senha</Label>
                  <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="h-9" autoComplete="current-password"
                    onKeyDown={(e) => { if (e.key === "Enter") iniciarSessao(); }} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStartOpen(false)}>Cancelar</Button>
              <Button onClick={iniciarSessao} disabled={starting} className="gap-1.5">
                {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />} Iniciar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ----- Em sessão: cards agrupados (5.4) + finalizar (5.3) -----
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1"><Store className="w-4 h-4 text-primary" /> {sessao.mercado}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <User className="w-3 h-3" /> {sessao.comprador}
            <span className="ml-2 flex items-center gap-1 text-emerald-600"><MapPin className="w-3 h-3" /> GPS ativo</span>
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 border-emerald-300 text-emerald-700" onClick={() => setEndOpen(true)}>
          <Flag className="w-4 h-4" /> Finalizar
        </Button>
      </div>

      {loading && <div className="text-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando…</div>}
      {!loading && grupos.length === 0 && <div className="text-center py-8 text-muted-foreground">Nenhum item em apanho.</div>}

      {grupos.map((g) => (
        <div key={g.codprod} className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-foreground flex items-center gap-1"><Package className="w-4 h-4 text-muted-foreground" /> {g.item}</p>
              <p className="text-xs text-muted-foreground">{g.marca}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold tabular-nums">{g.qtdFaltaTotal}</p>
              <p className="text-[10px] text-muted-foreground">total a comprar</p>
            </div>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="text-emerald-700">Encontrado: <b>{g.qtdEncontradaTotal}</b></span>
            <span className="text-amber-700">Pendente: <b>{g.qtdPendenteTotal}</b></span>
          </div>
          <div className="divide-y divide-border border-t border-border">
            {g.embarcacoes.map((e) => {
              const aberto = expand === e.nufaltaitem;
              const rows = getRows(e.nufaltaitem);
              return (
                <div key={e.nufaltaitem} className="py-2">
                  <button type="button" className="w-full flex items-center justify-between gap-2 text-left"
                    onClick={() => setExpand(aberto ? null : e.nufaltaitem)}>
                    <span className="text-sm flex items-center gap-1.5">
                      {aberto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <Ship className="w-3.5 h-3.5 text-muted-foreground" /> {e.embarcacao}
                      <span className="text-xs text-muted-foreground">· {e.parceiro}</span>
                    </span>
                    <span className="text-xs tabular-nums">
                      <b>{e.qtdFalta}</b> un
                      {e.qtdEncontrada > 0 && <span className="text-emerald-700 ml-1">({e.qtdEncontrada} ✓)</span>}
                    </span>
                  </button>
                  {aberto && (
                    <div className="mt-2 space-y-2 pl-5">
                      {rows.map((r, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <Input className="col-span-4 h-9 text-sm" placeholder="Lote" value={r.lote}
                            onChange={(ev) => setRows(e.nufaltaitem, rows.map((x, i) => i === idx ? { ...x, lote: ev.target.value } : x))} />
                          <Input className="col-span-4 h-9 text-sm" type="date" value={r.validade}
                            onChange={(ev) => setRows(e.nufaltaitem, rows.map((x, i) => i === idx ? { ...x, validade: ev.target.value } : x))} />
                          <Input className="col-span-3 h-9 text-sm" type="number" placeholder="Qtd" value={r.qtd}
                            onChange={(ev) => setRows(e.nufaltaitem, rows.map((x, i) => i === idx ? { ...x, qtd: ev.target.value } : x))} />
                          <div className="col-span-1 flex justify-center">
                            {idx === 0 ? (
                              <button type="button" title="Adicionar lote" className="text-primary"
                                onClick={() => setRows(e.nufaltaitem, [...rows, { lote: "", validade: "", qtd: "" }])}>
                                <Plus className="w-4 h-4" />
                              </button>
                            ) : (
                              <button type="button" title="Remover" className="text-red-600"
                                onClick={() => setRows(e.nufaltaitem, rows.filter((_, i) => i !== idx))}>
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      <Button size="sm" className="w-full gap-1.5" disabled={savingFalta === e.nufaltaitem}
                        onClick={() => registrarEmbarc(e)}>
                        {savingFalta === e.nufaltaitem ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Registrar p/ {e.embarcacao}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Flag className="w-5 h-5 text-emerald-600" /> Finalizar sessão</DialogTitle>
            <DialogDescription>
              Informe a NF/cupom fiscal que contém todos os itens comprados nesta sessão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Chave da NF / nº do cupom</Label>
            <Input value={nfChave} onChange={(e) => setNfChave(e.target.value)} placeholder="NF/cupom da sessão" className="h-9" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndOpen(false)}>Cancelar</Button>
            <Button onClick={finalizarSessao} disabled={ending} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              {ending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />} Finalizar sessão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
