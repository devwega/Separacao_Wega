/**
 * Apanho — Acompanhamento (Seção 6).
 * 6.1 localização em tempo real dos compradores; 6.2 item em sessão de cada comprador +
 * itens ainda não encontrados; 6.3 total por produto + quebra por embarcação com lote/validade;
 * 6.4 múltiplos lotes por embarcação. Atualização automática (polling).
 */
import { useEffect, useState, useCallback } from "react";
import { api, extractErrorMessage } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Activity, Loader2, RotateCcw, MapPin, Store, User, Ship, Package, Clock, Search, Maximize2,
} from "lucide-react";
import { toast } from "sonner";

/** Mini mapa rastreador (OpenStreetMap embed — sem chave de API). */
function MapaSessao({ lat, lng, altura }: { lat: number; lng: number; altura: number }) {
  const d = 0.004; // ~400m de raio
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  return (
    <iframe
      title={`mapa-${lat}-${lng}`}
      src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lng}`}
      className="w-full rounded-md border border-border pointer-events-none"
      style={{ height: altura }}
      loading="lazy"
    />
  );
}

type Lote = { lote: string | null; validade: string | null; qtd: number };
type Embarc = { nufaltaitem: number; nunota: number; embarcacao: string; parceiro: string; qtdFalta: number; qtdEncontrada: number; previsao?: string | null; lotes: Lote[] };
type Grupo = { codprod: number; item: string; marca: string; qtdFaltaTotal: number; qtdEncontradaTotal: number; qtdPendenteTotal: number; embarcacoes: Embarc[] };
type Sessao = { nusessao: number; comprador: string; mercado: string; lat: number | null; lng: number | null; dtInicio: string; dtAlterLoc: string; itens: { item: string; marca: string }[] };
type Compradores = { sessoes: Sessao[]; naoEncontrados: { item: string; marca: string; embarcacao: string; qtdFalta: number }[] };

const REFRESH_MS = 12000;

export default function ApanhoAcompanhamento() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [comp, setComp] = useState<Compradores>({ sessoes: [], naoEncontrados: [] });
  const [loading, setLoading] = useState(true);
  const [lastUpd, setLastUpd] = useState<Date | null>(null);
  const [mapaExpandido, setMapaExpandido] = useState<Sessao | null>(null);

  const load = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    try {
      const [g, c] = await Promise.all([api.get<Grupo[]>("/apanho/agrupado"), api.get<Compradores>("/apanho/compradores")]);
      setGrupos(g.data ?? []);
      setComp(c.data ?? { sessoes: [], naoEncontrados: [] });
      // rastreador: se o mapa ampliado está aberto, acompanha a nova posição
      setMapaExpandido((prev) => prev
        ? ((c.data?.sessoes ?? []).find((x) => x.nusessao === prev.nusessao) ?? prev)
        : prev);
      setLastUpd(new Date());
    } catch (e) { if (!silent) toast.error(extractErrorMessage(e, "Erro")); }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => load(true), REFRESH_MS); return () => clearInterval(t); }, [load]);

  const hora = (s?: string) => { if (!s) return "—"; const d = new Date(s.replace(" ", "T")); return isNaN(+d) ? s : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Activity className="w-5 h-5" /> Apanho — Acompanhamento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visibilidade em tempo real dos compradores e itens em apanho.
            {lastUpd && <span className="ml-1">Atualizado {lastUpd.toLocaleTimeString("pt-BR")}.</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => load()}><RotateCcw className="w-4 h-4" /> Atualizar</Button>
      </div>

      {loading && <div className="text-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando…</div>}

      {/* 6.1/6.2 — Compradores em sessão */}
      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Compradores em campo ({comp.sessoes.length})</h2>
        {comp.sessoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum comprador em sessão de apanho no momento.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {comp.sessoes.map((s) => (
              <div key={s.nusessao} className="bg-card border border-border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm flex items-center gap-1"><User className="w-3.5 h-3.5" /> {s.comprador}</span>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">em sessão</Badge>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Store className="w-3 h-3" /> {s.mercado}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> desde {hora(s.dtInicio)} · loc. {hora(s.dtAlterLoc)}</p>
                {s.lat != null && s.lng != null ? (
                  <button type="button" className="block w-full text-left relative group cursor-pointer"
                    title="Clique para ampliar o mapa"
                    onClick={() => setMapaExpandido(s)}>
                    <MapaSessao lat={s.lat} lng={s.lng} altura={130} />
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-background/90 border border-border text-foreground shadow-sm">
                      <Maximize2 className="w-3 h-3" /> ampliar
                    </span>
                    <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-background/90 border border-border text-muted-foreground shadow-sm">
                      <MapPin className="w-3 h-3 text-emerald-600" /> rastreando · atualizado {hora(s.dtAlterLoc)}
                    </span>
                  </button>
                ) : <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> sem localização</span>}
                <div className="pt-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Itens nesta sessão</p>
                  {s.itens.length === 0 ? <p className="text-xs text-muted-foreground">— ainda registrando —</p> : (
                    <div className="flex flex-wrap gap-1">
                      {s.itens.map((it, i) => <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-foreground border border-border">{it.item}</span>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6.2 — Itens ainda não encontrados */}
      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Search className="w-4 h-4 text-amber-500" /> Ainda não encontrados ({comp.naoEncontrados.length})</h2>
        {comp.naoEncontrados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos os itens já têm ao menos um registro de apanho.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {comp.naoEncontrados.map((n, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                {n.item} <span className="text-amber-600">· {n.embarcacao} · {n.qtdFalta} un</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 6.3/6.4 — Por produto: total + quebra por embarcação com lotes */}
      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Itens em apanho</h2>
        {!loading && grupos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item em apanho.</p>}
        <div className="space-y-3">
          {grupos.map((g) => (
            <div key={g.codprod} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{g.item}</p>
                  <p className="text-xs text-muted-foreground">{g.marca}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold tabular-nums">{g.qtdEncontradaTotal}/{g.qtdFaltaTotal}</p>
                  <p className="text-[10px] text-muted-foreground">encontrado / total</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {g.embarcacoes.map((e) => (
                  <div key={e.nufaltaitem} className="rounded-md border border-border p-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5"><Ship className="w-3.5 h-3.5 text-muted-foreground" /> {e.embarcacao} <span className="text-xs text-muted-foreground">· {e.parceiro}</span></span>
                      <span className="flex items-center gap-2">
                        {e.previsao && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                            Prev. retorno: {e.previsao}h
                          </span>
                        )}
                        <span className="text-xs tabular-nums"><b>{e.qtdEncontrada}</b>/{e.qtdFalta} un</span>
                      </span>
                    </div>
                    {e.lotes.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {e.lotes.map((l, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                            {l.qtd} un{l.lote ? ` · lote ${l.lote}` : ""}{l.validade ? ` · val ${l.validade}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mapa ampliado da sessão (rastreador) */}
      <Dialog open={!!mapaExpandido} onOpenChange={(o) => { if (!o) setMapaExpandido(null); }}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" /> {mapaExpandido?.comprador} — {mapaExpandido?.mercado}
            </DialogTitle>
            <DialogDescription>
              Localização em tempo real (atualizada {hora(mapaExpandido?.dtAlterLoc)}). O mapa acompanha o heartbeat do comprador.
            </DialogDescription>
          </DialogHeader>
          {mapaExpandido?.lat != null && mapaExpandido?.lng != null && (
            <div className="space-y-2">
              <iframe
                title="mapa-expandido"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(`${mapaExpandido.lng - 0.01},${mapaExpandido.lat - 0.007},${mapaExpandido.lng + 0.01},${mapaExpandido.lat + 0.007}`)}&layer=mapnik&marker=${mapaExpandido.lat}%2C${mapaExpandido.lng}`}
                className="w-full h-[440px] rounded-md border border-border"
              />
              <a className="text-xs text-sky-600 hover:underline inline-flex items-center gap-1" target="_blank" rel="noreferrer"
                href={`https://www.google.com/maps?q=${mapaExpandido.lat},${mapaExpandido.lng}`}>
                <MapPin className="w-3 h-3" /> abrir no Google Maps
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
