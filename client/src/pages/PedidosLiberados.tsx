/**
 * Tela 9.1 — Painel de Pedidos Liberados para Separação
 * PL-1.1: ao iniciar/retomar, escolher o LOCAL (definido pelo cadastro do item).
 *         A separação é registrada no usuário autenticado na sessão (sem re-login).
 * PL-1.2: progresso por local (locais concluídos / total de locais).
 * PL-1.3: botão Finalizar separação.
 */
import { useMemo, useState } from "react";
import SummaryCard from "@/components/SummaryCard";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Package, Clock, AlertTriangle, CheckCircle2, Search, Play, RotateCcw, Eye, Ship,
  Loader2, ListChecks, Undo2, MapPin, Flag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFetch } from "@/hooks/use-fetch";
import { useMutation } from "@/hooks/use-mutation";
import { useLocation } from "wouter";
import { api, extractErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Pedido, PedidoSummary } from "@/lib/api";

type LocalSep = { local: string; totalItens: number; itensSeparados: number; concluido: boolean; perc: number };

export default function PedidosLiberados() {
  const [filters, setFilters] = useState({ q: "", status: "todos", embarcacao: "todas", prioridade: "todas" });
  const params = useMemo(() => ({ ...filters }), [filters]);
  const { data: pedidos, loading, error, refetch } = useFetch<Pedido[]>("/pedidos", params);
  const { data: summary, refetch: refetchSummary } = useFetch<PedidoSummary>("/pedidos/summary");
  const { data: embarcacoes } = useFetch<{ value: string }[]>("/pedidos/embarcacoes");
  const [, setLocation] = useLocation();

  // Modal de seleção de local (PL-1.1) — usa o usuário já autenticado na sessão.
  const [modalPedido, setModalPedido] = useState<{ nunota: number; id: string } | null>(null);
  const [locais, setLocais] = useState<LocalSep[]>([]);
  const [loadingLocais, setLoadingLocais] = useState(false);
  const [selLocal, setSelLocal] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const abrirModal = async (pedido: Pedido) => {
    setModalPedido({ nunota: pedido.nunota, id: pedido.id });
    setSelLocal(""); setLocais([]); setLoadingLocais(true);
    try {
      const res = await api.get<LocalSep[]>(`/pedidos/${pedido.nunota}/locais`);
      setLocais(res.data ?? []);
      const pend = (res.data ?? []).find((l) => !l.concluido);
      if (pend) setSelLocal(pend.local);
    } catch (e) {
      toast.error(extractErrorMessage(e, "Erro ao carregar locais"));
    } finally {
      setLoadingLocais(false);
    }
  };

  const confirmarInicio = async () => {
    if (!modalPedido) return;
    if (!selLocal) { toast.error("Selecione o local a separar."); return; }
    setSubmitting(true);
    try {
      await api.post(`/pedidos/${modalPedido.nunota}/iniciar-separacao-local`, { local: selLocal });
      const nunota = modalPedido.nunota;
      setModalPedido(null);
      refetch(); refetchSummary();
      setLocation(`/bipe?nunota=${nunota}&local=${encodeURIComponent(selLocal)}`);
    } catch (e) {
      toast.error(extractErrorMessage(e, "Falha ao iniciar separação"));
    } finally {
      setSubmitting(false);
    }
  };

  const estornar = useMutation<{ _nunota: number }>(
    "post", (b) => `/pedidos/${b._nunota}/estornar-separacao`,
    { successMessage: "Separação estornada", onSuccess: () => { refetch(); refetchSummary(); } },
  );
  const finalizar = useMutation<{ _nunota: number }>(
    "post", (b) => `/pedidos/${b._nunota}/finalizar-separacao`,
    { successMessage: "Separação finalizada", onSuccess: () => { refetch(); refetchSummary(); } },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pedidos Liberados para Separação</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie e priorize os pedidos liberados para a operação de estoque
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RotateCcw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={Package} title="Total Pedidos" value={summary?.totalPedidos ?? "—"}
          subtitle="Liberados hoje" iconColor="text-blue-600" iconBg="bg-blue-50" />
        <SummaryCard icon={Clock} title="Em Separação" value={summary?.emSeparacao ?? "—"}
          subtitle="Em andamento" iconColor="text-sky-600" iconBg="bg-sky-50" />
        <SummaryCard icon={AlertTriangle} title="Com Pendências" value={summary?.comPendencias ?? "—"}
          subtitle="Requerem atenção" iconColor="text-amber-600" iconBg="bg-amber-50" />
        <SummaryCard icon={CheckCircle2} title="Concluídos" value={summary?.concluidos ?? "—"}
          subtitle="Prontos para decisão" iconColor="text-emerald-600" iconBg="bg-emerald-50" />
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar pedido ou cliente..." className="pl-9 h-9 text-sm"
              value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          </div>
          <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
            <SelectTrigger className="w-[210px] h-9 text-sm"><SelectValue placeholder="Status do Pedido" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="LANCADO">Lançado</SelectItem>
              <SelectItem value="LIBERADO_SEPARACAO">Liberado p/ Separação</SelectItem>
              <SelectItem value="EM_SEPARACAO">Em Separação</SelectItem>
              <SelectItem value="COM_FALTA_ANALISE">Com Falta em Análise</SelectItem>
              <SelectItem value="AGUARDANDO_DECISAO">Aguardando Decisão</SelectItem>
              <SelectItem value="APROVADO_ALTERACAO">Aprovado c/ Alteração</SelectItem>
              <SelectItem value="REPROVADO">Reprovado</SelectItem>
              <SelectItem value="APROVADO_FLUXO_DISTINTO">Aprovado em Fluxo Distinto</SelectItem>
              <SelectItem value="LIBERADO_FATURAMENTO">Liberado p/ Faturamento</SelectItem>
              <SelectItem value="FATURADO">Faturado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.embarcacao} onValueChange={(v) => setFilters({ ...filters, embarcacao: v })}>
            <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Embarcação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {(embarcacoes ?? []).map((e) => (<SelectItem key={e.value} value={e.value}>{e.value}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={filters.prioridade} onValueChange={(v) => setFilters({ ...filters, prioridade: v })}>
            <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="critica">Crítica</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 gap-1.5"
            onClick={() => setFilters({ q: "", status: "todos", embarcacao: "todas", prioridade: "todas" })}>
            <ListChecks className="w-3.5 h-3.5" /> Limpar filtros
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {error && (
          <div className="p-6 text-sm text-red-600 bg-red-50 border-b border-red-200">
            Erro ao carregar pedidos: {error}
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold text-xs uppercase tracking-wider w-[140px]">Pedido</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider">Parceiro</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider w-[120px]">
                <div className="flex items-center gap-1.5"><Ship className="w-3.5 h-3.5" /> Embarcação</div>
              </TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider w-[100px]">Status</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider w-[150px] text-center">Progresso (locais)</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider w-[90px] text-center">Pendências</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider w-[80px] text-center">Alertas</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider w-[160px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> Carregando…
              </TableCell></TableRow>
            )}
            {!loading && pedidos?.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                Nenhum pedido encontrado com os filtros aplicados.
              </TableCell></TableRow>
            )}
            {!loading && pedidos?.map((pedido) => {
              const totLoc = (pedido as any).totalLocais ?? 0;
              const locOk = (pedido as any).locaisConcluidos ?? 0;
              const perc = totLoc ? (locOk / totLoc) * 100 : (pedido.totalItens ? (pedido.itensSeparados / pedido.totalItens) * 100 : 0);
              return (
              <TableRow key={pedido.id} className="group hover:bg-accent/50 transition-colors">
                <TableCell>
                  <div>
                    <span className="font-medium text-sm text-foreground">NU {pedido.nunota}</span>
                    <span className="block text-[11px] text-muted-foreground">{pedido.id}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      {pedido.prioridade === "critica" && (<Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">CRÍTICO</Badge>)}
                      {pedido.prioridade === "alta" && (<Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-amber-200">ALTA</Badge>)}
                    </div>
                  </div>
                </TableCell>
                <TableCell><span className="text-sm text-foreground">{pedido.cliente}</span></TableCell>
                <TableCell>
                  <div className="text-sm">
                    <span className="text-foreground font-medium">{pedido.embarcacao}</span>
                    <span className="block text-xs text-muted-foreground">{pedido.horarioCarregamento}h</span>
                  </div>
                </TableCell>
                <TableCell><StatusBadge status={pedido.statusPedido ?? pedido.status} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${perc}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {totLoc ? `${locOk}/${totLoc} locais` : `${pedido.itensSeparados}/${pedido.totalItens}`}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {pedido.pendencias > 0 ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">{pedido.pendencias}</span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-center">
                  {pedido.alertaValidade ? (
                    <Tooltip><TooltipTrigger><AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" /></TooltipTrigger>
                      <TooltipContent><p className="text-xs">Itens com alerta de validade</p></TooltipContent></Tooltip>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {pedido.status === "pendente" && (
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => abrirModal(pedido)}>
                          <Play className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger><TooltipContent><p className="text-xs">Iniciar Separação</p></TooltipContent></Tooltip>
                    )}
                    {pedido.status === "separacao" && (
                      <>
                        <Tooltip><TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => abrirModal(pedido)}>
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger><TooltipContent><p className="text-xs">Retomar Separação</p></TooltipContent></Tooltip>
                        <Tooltip><TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-emerald-600"
                            disabled={finalizar.loading}
                            onClick={() => { if (confirm(`Finalizar a separação do pedido ${pedido.id}?`)) finalizar.mutate({ _nunota: pedido.nunota }); }}>
                            <Flag className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger><TooltipContent><p className="text-xs">Finalizar Separação</p></TooltipContent></Tooltip>
                      </>
                    )}
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setLocation(`/pre-faturamento?nunota=${pedido.nunota}`)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger><TooltipContent><p className="text-xs">Visualizar Pendências</p></TooltipContent></Tooltip>
                    {pedido.status !== "pendente" && (
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-amber-600" disabled={estornar.loading}
                          onClick={() => { if (confirm(`Estornar a separação do pedido ${pedido.id}? Limpa divergências, faltas e progresso.`)) estornar.mutate({ _nunota: pedido.nunota }); }}>
                          <Undo2 className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger><TooltipContent><p className="text-xs">Estornar Separação</p></TooltipContent></Tooltip>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );})}
          </TableBody>
        </Table>
      </div>

      {/* Modal — escolher local (PL-1.1). Sem re-login: usa o usuário autenticado na sessão. */}
      <Dialog open={!!modalPedido} onOpenChange={(o) => { if (!o) setModalPedido(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" /> Iniciar separação — {modalPedido?.id}
            </DialogTitle>
            <DialogDescription>
              Escolha o local a separar (definido pelo cadastro do item).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Local de separação</Label>
              {loadingLocais ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando locais…</div>
              ) : locais.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum local encontrado para este pedido.</div>
              ) : (
                <div className="space-y-2 max-h-[240px] overflow-y-auto">
                  {locais.map((l) => (
                    <button key={l.local} type="button" onClick={() => setSelLocal(l.local)}
                      className={cn(
                        "w-full text-left rounded-lg border p-3 transition-colors",
                        selLocal === l.local ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50",
                        l.concluido && "opacity-70",
                      )}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> {l.local}
                        </span>
                        {l.concluido
                          ? <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">Concluído</Badge>
                          : <span className="text-xs text-muted-foreground tabular-nums">{l.itensSeparados}/{l.totalItens} itens</span>}
                      </div>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${l.perc}%` }} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalPedido(null)}>Cancelar</Button>
            <Button onClick={confirmarInicio} disabled={submitting || !selLocal} className="gap-1.5">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Iniciar separação do local
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
