/**
 * Tela 9.1 — Painel de Pedidos Liberados para Separação
 * Integrada à API /api/pedidos + /api/pedidos/summary
 * SQL fonte: TGFCAB JOIN TGFPAR, TGFVEN, TGFORD, AD_SEPARACAO
 */
import { useMemo, useState } from "react";
import SummaryCard from "@/components/SummaryCard";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  Play,
  RotateCcw,
  Eye,
  Ship,
  Loader2,
  ListChecks,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFetch } from "@/hooks/use-fetch";
import { useMutation } from "@/hooks/use-mutation";
import { useLocation } from "wouter";
import type { Pedido, PedidoSummary } from "@/lib/api";

export default function PedidosLiberados() {
  const [filters, setFilters] = useState({
    q: "",
    status: "todos",
    embarcacao: "todas",
    prioridade: "todas",
  });

  const params = useMemo(() => ({ ...filters }), [filters]);
  const { data: pedidos, loading, error, refetch } = useFetch<Pedido[]>("/pedidos", params);
  const { data: summary, refetch: refetchSummary } = useFetch<PedidoSummary>("/pedidos/summary");
  const { data: embarcacoes } = useFetch<{ value: string }[]>("/pedidos/embarcacoes");
  const [, setLocation] = useLocation();

  const iniciar = useMutation<{ _nunota: number }>(
    "post",
    (b) => `/pedidos/${b._nunota}/iniciar-separacao`,
    { successMessage: "Separação iniciada", onSuccess: () => { refetch(); refetchSummary(); } },
  );

  const estornar = useMutation<{ _nunota: number }>(
    "post",
    (b) => `/pedidos/${b._nunota}/estornar-separacao`,
    { successMessage: "Separação estornada", onSuccess: () => { refetch(); refetchSummary(); } },
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pedidos Liberados para Separação</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie e priorize os pedidos liberados para a operação de estoque
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Summary cards */}
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

      {/* Filters bar */}
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
              {(embarcacoes ?? []).map((e) => (
                <SelectItem key={e.value} value={e.value}>{e.value}</SelectItem>
              ))}
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
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => setFilters({ q: "", status: "todos", embarcacao: "todas", prioridade: "todas" })}
          >
            <ListChecks className="w-3.5 h-3.5" /> Limpar filtros
          </Button>
        </div>
      </div>

      {/* Table */}
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
              <TableHead className="font-semibold text-xs uppercase tracking-wider w-[130px] text-center">Progresso</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider w-[90px] text-center">Pendências</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider w-[80px] text-center">Alertas</TableHead>
              <TableHead className="font-semibold text-xs uppercase tracking-wider w-[140px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> Carregando…
                </TableCell>
              </TableRow>
            )}
            {!loading && pedidos?.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  Nenhum pedido encontrado com os filtros aplicados.
                </TableCell>
              </TableRow>
            )}
            {!loading && pedidos?.map((pedido) => (
              <TableRow key={pedido.id} className="group hover:bg-accent/50 transition-colors">
                <TableCell>
                  <div>
                    <span className="font-medium text-sm text-foreground">NU {pedido.nunota}</span>
                    <span className="block text-[11px] text-muted-foreground">{pedido.id}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      {pedido.prioridade === "critica" && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">CRÍTICO</Badge>
                      )}
                      {pedido.prioridade === "alta" && (
                        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-amber-200">ALTA</Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-foreground">{pedido.cliente}</span>
                </TableCell>
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
                      <div className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pedido.totalItens ? (pedido.itensSeparados / pedido.totalItens) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {pedido.itensSeparados}/{pedido.totalItens}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {pedido.pendencias > 0 ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                      {pedido.pendencias}
                    </span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-center">
                  {pedido.alertaValidade ? (
                    <Tooltip>
                      <TooltipTrigger><AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" /></TooltipTrigger>
                      <TooltipContent><p className="text-xs">Itens com alerta de validade</p></TooltipContent>
                    </Tooltip>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {pedido.status === "pendente" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                            disabled={iniciar.loading}
                            onClick={async () => {
                              await iniciar.mutate({ _nunota: pedido.nunota });
                              setLocation(`/bipe?nunota=${pedido.nunota}`);
                            }}>
                            <Play className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p className="text-xs">Iniciar Separação</p></TooltipContent>
                      </Tooltip>
                    )}
                    {pedido.status === "separacao" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                            onClick={() => setLocation(`/bipe?nunota=${pedido.nunota}`)}>
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p className="text-xs">Retomar Separação</p></TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => setLocation(`/pre-faturamento?nunota=${pedido.nunota}`)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p className="text-xs">Visualizar Pendências</p></TooltipContent>
                    </Tooltip>
                    {pedido.status !== "pendente" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-amber-600"
                            disabled={estornar.loading}
                            onClick={() => {
                              if (confirm(`Estornar a separação do pedido ${pedido.id}? Limpa divergências, faltas e progresso.`))
                                estornar.mutate({ _nunota: pedido.nunota });
                            }}>
                            <Undo2 className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p className="text-xs">Estornar Separação</p></TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
