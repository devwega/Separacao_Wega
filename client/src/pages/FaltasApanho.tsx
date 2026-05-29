/**
 * Tela 9.4 — Tela de Faltas e Apanho
 * Objetivo: Tratar indisponibilidades com foco no prazo do pedido
 * Usuários: Compras e comercial
 * Layout: Summary cards + tabela com indicadores de criticidade e ações
 */
import { useMemo, useState } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { useMutation } from "@/hooks/use-mutation";
import type { Falta } from "@/lib/api";
import SummaryCard from "@/components/SummaryCard";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  ShoppingCart,
  Zap,
  Scissors,
  Clock,
  Search,
  Package,
  Ship,
  ArrowRight,
  CalendarClock,
  Timer,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Fallback caso API esteja offline
const mockFaltas = [
  {
    id: 1,
    pedido: "PV-2024-00190",
    cliente: "Distribuidora Norte",
    item: "Mortadela Bologna 3,5kg",
    codigo: "PRD-001612",
    qtdPedida: 10,
    qtdFaltante: 10,
    tipo: "total" as const,
    embarcacao: "EMB-043",
    horarioCarregamento: "08:00",
    criticidade: "critica" as const,
    acaoProposta: null,
    prazoRetorno: null,
    tempoRestante: "1h 45min",
  },
  {
    id: 2,
    pedido: "PV-2024-00190",
    cliente: "Distribuidora Norte",
    item: "Presunto Cozido Fatiado 200g",
    codigo: "PRD-001620",
    qtdPedida: 50,
    qtdFaltante: 20,
    tipo: "parcial" as const,
    embarcacao: "EMB-043",
    horarioCarregamento: "08:00",
    criticidade: "alta" as const,
    acaoProposta: "apanho",
    prazoRetorno: "07:30",
    tempoRestante: "1h 45min",
  },
  {
    id: 3,
    pedido: "PV-2024-00192",
    cliente: "Hortifruti Natural",
    item: "Queijo Mussarela Peça 4kg",
    codigo: "PRD-001800",
    qtdPedida: 25,
    qtdFaltante: 25,
    tipo: "total" as const,
    embarcacao: "EMB-044",
    horarioCarregamento: "10:00",
    criticidade: "media" as const,
    acaoProposta: "compra",
    prazoRetorno: "09:00",
    tempoRestante: "3h 45min",
  },
  {
    id: 4,
    pedido: "PV-2024-00187",
    cliente: "Supermercado Bom Preço",
    item: "Bacon Defumado Manta 3kg",
    codigo: "PRD-001900",
    qtdPedida: 15,
    qtdFaltante: 5,
    tipo: "parcial" as const,
    embarcacao: "EMB-042",
    horarioCarregamento: "06:30",
    criticidade: "critica" as const,
    acaoProposta: null,
    prazoRetorno: null,
    tempoRestante: "15min",
  },
];

const criticidadeConfig = {
  critica: { label: "Crítica", className: "bg-red-100 text-red-800 border-red-200", barColor: "bg-red-500" },
  alta: { label: "Alta", className: "bg-orange-100 text-orange-800 border-orange-200", barColor: "bg-orange-500" },
  media: { label: "Média", className: "bg-amber-100 text-amber-800 border-amber-200", barColor: "bg-amber-500" },
  baixa: { label: "Baixa", className: "bg-green-100 text-green-800 border-green-200", barColor: "bg-green-500" },
};

type FaltasSummary = { total: number; totais: number; parciais: number; apanhoAtivo: number; compraPadrao: number; semTratativa: number };

export default function FaltasApanho() {
  const [filters, setFilters] = useState({ q: "", criticidade: "todas", tipo: "todos", acao: "todas" });
  const params = useMemo(() => ({ ...filters }), [filters]);
  const { data: apiFaltas, loading, refetch } = useFetch<Falta[]>("/faltas", params);
  const { data: summary, refetch: refetchSum } = useFetch<FaltasSummary>("/faltas/summary");
  const faltas = (apiFaltas ?? mockFaltas) as any[];

  const aplicarAcao = useMutation<{ acao: "APANHO" | "COMPRA_PADRAO" | "CORTE"; _id: number }>(
    "post", (b) => `/faltas/${b._id}/acao`,
    { successMessage: "Tratativa registrada", onSuccess: () => { refetch(); refetchSum(); } },
  );
  const informarPrev = useMutation<{ prazoRetorno: string; _id: number }>(
    "post", (b) => `/faltas/${b._id}/informar-previsao`,
    { successMessage: "Previsão registrada", onSuccess: () => { refetch(); refetchSum(); } },
  );
  const devolverComercial = useMutation<{ _id: number }>(
    "post", (b) => `/faltas/${b._id}/devolver-comercial`,
    { successMessage: "Devolvido ao comercial", onSuccess: () => { refetch(); refetchSum(); } },
  );
  const voltarSeparacao = useMutation<{ _id: number }>(
    "post", (b) => `/faltas/${b._id}/voltar-separacao`,
    { successMessage: "Item devolvido para separação", onSuccess: () => { refetch(); refetchSum(); } },
  );

  const handleInformarPrev = (id: number) => {
    const v = window.prompt("Previsão de retorno (formato YYYY-MM-DD HH:MM):");
    if (v && v.trim()) informarPrev.mutate({ _id: id, prazoRetorno: v.trim() });
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Faltas e Apanho</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Trate indisponibilidades de estoque com foco no prazo de carregamento
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={AlertTriangle} title="Total Faltas" value={summary?.total ?? faltas.length}
          subtitle={`${summary?.totais ?? 0} totais, ${summary?.parciais ?? 0} parciais`}
          iconColor="text-orange-600" iconBg="bg-orange-50" />
        <SummaryCard icon={Zap} title="Apanho Ativo" value={summary?.apanhoAtivo ?? "—"}
          subtitle="Compra emergencial" iconColor="text-red-600" iconBg="bg-red-50" />
        <SummaryCard icon={ShoppingCart} title="Compra Padrão" value={summary?.compraPadrao ?? "—"}
          subtitle="Em andamento" iconColor="text-blue-600" iconBg="bg-blue-50" />
        <SummaryCard icon={Timer} title="Sem Tratativa" value={summary?.semTratativa ?? "—"}
          subtitle="Aguardando decisão" iconColor="text-amber-600" iconBg="bg-amber-50" />
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar item ou pedido..." className="pl-9 h-9 text-sm"
              value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          </div>
          <Select value={filters.criticidade} onValueChange={(v) => setFilters({ ...filters, criticidade: v })}>
            <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Criticidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="critica">Crítica</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.tipo} onValueChange={(v) => setFilters({ ...filters, tipo: v })}>
            <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Tipo de falta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="total">Falta total</SelectItem>
              <SelectItem value="parcial">Falta parcial</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.acao} onValueChange={(v) => setFilters({ ...filters, acao: v })}>
            <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Ação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="sem-acao">Sem tratativa</SelectItem>
              <SelectItem value="apanho">Apanho</SelectItem>
              <SelectItem value="compra">Compra padrão</SelectItem>
              <SelectItem value="corte">Corte</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Falta cards */}
      <div className="space-y-3">
        {loading && <div className="text-sm text-muted-foreground">Carregando faltas…</div>}
        {faltas.map((falta: any) => {
          const crit = criticidadeConfig[falta.criticidade];
          return (
            <Card
              key={falta.id}
              className={cn(
                "overflow-hidden",
                falta.criticidade === "critica" && "border-red-200"
              )}
            >
              <CardContent className="p-0">
                <div className="flex">
                  {/* Criticidade indicator bar */}
                  <div className={cn("w-1.5 shrink-0", crit.barColor)} />

                  <div className="flex-1 p-4">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-semibold text-primary">{falta.pedido}</span>
                        <span className="text-sm text-muted-foreground">—</span>
                        <span className="text-sm text-foreground">{falta.cliente}</span>
                        <Badge variant="outline" className={cn("text-[10px] font-semibold border", crit.className)}>
                          {crit.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          Falta {falta.tipo}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                        <Ship className="w-3.5 h-3.5" />
                        <span>{falta.embarcacao}</span>
                        <span>•</span>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{falta.horarioCarregamento}h</span>
                      </div>
                    </div>

                    {/* Item info */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      <div className="md:col-span-5">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium text-foreground">{falta.item}</p>
                            <p className="text-xs text-muted-foreground font-mono">{falta.codigo}</p>
                          </div>
                        </div>
                      </div>

                      <div className="md:col-span-3">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Pedida</p>
                            <p className="text-sm font-semibold tabular-nums">{falta.qtdPedida}</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Faltante</p>
                            <p className="text-sm font-bold text-red-600 tabular-nums">{falta.qtdFaltante}</p>
                          </div>
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        {falta.acaoProposta ? (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Ação</p>
                            <Badge
                              className={cn(
                                "text-xs mt-0.5",
                                falta.acaoProposta === "apanho"
                                  ? "bg-red-100 text-red-700 border-red-200"
                                  : "bg-blue-100 text-blue-700 border-blue-200"
                              )}
                            >
                              {falta.acaoProposta === "apanho" ? "Apanho" : "Compra Padrão"}
                            </Badge>
                            {falta.prazoRetorno && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                <CalendarClock className="w-3 h-3" />
                                Prev.: {falta.prazoRetorno}h
                              </p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Ação</p>
                            <span className="text-xs text-amber-600 font-medium">Sem tratativa</span>
                          </div>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <p className="text-[10px] text-muted-foreground uppercase">Tempo restante</p>
                        <p className={cn(
                          "text-sm font-bold tabular-nums",
                          falta.tempoRestante.includes("min") && !falta.tempoRestante.includes("h")
                            ? "text-red-600"
                            : "text-foreground"
                        )}>
                          {falta.tempoRestante}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    {!falta.acaoProposta && (
                      <div className="mt-4 pt-3 border-t border-border flex items-center gap-2 flex-wrap">
                        <Button size="sm" className="gap-1.5 h-8 bg-blue-600 hover:bg-blue-700"
                          disabled={aplicarAcao.loading}
                          onClick={() => aplicarAcao.mutate({ acao: "COMPRA_PADRAO", _id: falta.id })}>
                          <ShoppingCart className="w-3.5 h-3.5" />
                          Compra Padrão
                        </Button>
                        <Button size="sm" className="gap-1.5 h-8 bg-red-600 hover:bg-red-700"
                          disabled={aplicarAcao.loading}
                          onClick={() => aplicarAcao.mutate({ acao: "APANHO", _id: falta.id })}>
                          <Zap className="w-3.5 h-3.5" />
                          Apanho
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5 h-8"
                          disabled={aplicarAcao.loading}
                          onClick={() => aplicarAcao.mutate({ acao: "CORTE", _id: falta.id })}>
                          <Scissors className="w-3.5 h-3.5" />
                          Corte
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5 h-8"
                          onClick={() => handleInformarPrev(falta.id)}>
                          <CalendarClock className="w-3.5 h-3.5" />
                          Informar Previsão
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1.5 h-8 ml-auto"
                          onClick={() => devolverComercial.mutate({ _id: falta.id })}>
                          <Undo2 className="w-3.5 h-3.5" />
                          Devolver ao Comercial
                        </Button>
                      </div>
                    )}
                    {falta.acaoProposta && (
                      <div className="mt-4 pt-3 border-t border-border flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          {falta.acaoProposta === "apanho" ? (
                            <Zap className="w-4 h-4 text-red-500" />
                          ) : (
                            <ShoppingCart className="w-4 h-4 text-blue-500" />
                          )}
                          <span>
                            {falta.acaoProposta === "apanho" ? "Apanho em andamento" : "Compra em andamento"}
                          </span>
                        </div>
{falta.acaoProposta === "compra" && (
                          <Button size="sm" className="gap-1.5 h-7 ml-auto text-xs bg-emerald-600 hover:bg-emerald-700"
                            disabled={voltarSeparacao.loading}
                            onClick={() => voltarSeparacao.mutate({ _id: falta.id })}>
                            <ArrowRight className="w-3 h-3" />
                            Voltar p/ Separação
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className={cn("gap-1.5 h-7 text-xs", falta.acaoProposta !== "compra" && "ml-auto")}
                          onClick={() => handleInformarPrev(falta.id)}>
                          <CalendarClock className="w-3 h-3" />
                          Atualizar Previsão
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs"
                          onClick={() => devolverComercial.mutate({ _id: falta.id })}>
                          <Undo2 className="w-3 h-3" />
                          Devolver ao Comercial
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
