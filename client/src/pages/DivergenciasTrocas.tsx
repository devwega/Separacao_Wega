/**
 * Tela 9.3 — Tela de Divergências e Trocas
 * Objetivo: Consolidar itens divergentes para decisão comercial
 * Usuários: Comercial
 * Layout: Summary cards + tabela de divergências com ações inline e painel de detalhes
 */
import { useMemo, useState } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { useMutation } from "@/hooks/use-mutation";
import type { Divergencia } from "@/lib/api";
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
  ArrowLeftRight,
  CheckCircle2,
  XCircle,
  MessageSquare,
  UserCheck,
  Forward,
  Search,
  Clock,
  Undo2,
} from "lucide-react";

// Fallback caso a API esteja offline — corresponde ao seed do banco
const mockDivergencias = [
  {
    id: 1,
    pedido: "PV-2024-00187",
    cliente: "Supermercado Bom Preço",
    itemOriginal: "Linguiça Toscana 500g - Marca A",
    codOriginal: "PRD-001300",
    itemSeparado: "Linguiça Toscana 500g - Marca B",
    codSeparado: "PRD-001301",
    tipoDivergencia: "Marca homologada",
    homologada: true,
    necessidadeCliente: "Informar",
    qtdOriginal: 20,
    qtdEquivalente: 20,
    fatorConversao: "1:1",
    motivo: "Marca A indisponível no estoque. Marca B é homologada pelo cliente.",
    status: "pendente" as const,
  },
  {
    id: 2,
    pedido: "PV-2024-00190",
    cliente: "Distribuidora Norte",
    itemOriginal: "Hambúrguer Bovino 56g cx c/36",
    codOriginal: "PRD-001455",
    itemSeparado: "Hambúrguer Bovino 56g cx c/12",
    codSeparado: "PRD-001456",
    tipoDivergencia: "Proporção/Porcionamento",
    homologada: true,
    necessidadeCliente: "Nenhuma",
    qtdOriginal: 15,
    qtdEquivalente: 45,
    fatorConversao: "1:3",
    motivo: "Embalagem cx c/36 indisponível. Substituição por 3x cx c/12 (equivalente).",
    status: "pendente" as const,
  },
  {
    id: 3,
    pedido: "PV-2024-00190",
    cliente: "Distribuidora Norte",
    itemOriginal: "Salsicha Hot Dog 3kg - Premium",
    codOriginal: "PRD-001500",
    itemSeparado: "Salsicha Hot Dog 3kg - Standard",
    codSeparado: "PRD-001502",
    tipoDivergencia: "Marca não homologada",
    homologada: false,
    necessidadeCliente: "Aprovação obrigatória",
    qtdOriginal: 40,
    qtdEquivalente: 40,
    fatorConversao: "1:1",
    motivo: "Marca Premium sem estoque. Marca Standard não consta no cadastro de equivalência.",
    status: "bloqueado" as const,
  },
  {
    id: 4,
    pedido: "PV-2024-00192",
    cliente: "Hortifruti Natural",
    itemOriginal: "Peito de Peru Defumado 3,5kg",
    codOriginal: "PRD-001700",
    itemSeparado: "Peito de Peru Defumado 4kg",
    codSeparado: "PRD-001701",
    tipoDivergencia: "Gramatura",
    homologada: true,
    necessidadeCliente: "Informar",
    qtdOriginal: 8,
    qtdEquivalente: 7,
    fatorConversao: "3.5:4",
    motivo: "Gramatura 3,5kg indisponível. Substituição por 4kg com ajuste de quantidade.",
    status: "conforme" as const,
  },
];

type Summary = { total: number; pendentes: number; aprovadas: number; bloqueadas: number; rejeitadas: number };

export default function DivergenciasTrocas() {
  const [filters, setFilters] = useState({ q: "", tipo: "todos", status: "todos" });
  const params = useMemo(() => ({ ...filters }), [filters]);
  const { data: apiDivs, loading, refetch } = useFetch<Divergencia[]>("/divergencias", params);
  const { data: summary, refetch: refetchSummary } = useFetch<Summary>("/divergencias/summary");
  const divergencias = (apiDivs ?? mockDivergencias) as any[];

  const decidir = useMutation<{ acao: "APROVAR" | "REPROVAR"; _id: number }>(
    "post",
    (b) => `/divergencias/${b._id}/decidir`,
    { successMessage: "Decisão registrada", onSuccess: () => { refetch(); refetchSummary(); } },
  );
  const informarCliente = useMutation<{ _id: number }>(
    "post", (b) => `/divergencias/${b._id}/informar-cliente`,
    { successMessage: "Cliente informado (registrado)", onSuccess: refetch },
  );
  const aprovCliente = useMutation<{ _id: number }>(
    "post", (b) => `/divergencias/${b._id}/registrar-aprov-cliente`,
    { successMessage: "Aprovação do cliente registrada", onSuccess: refetch },
  );
  const encaminharGestor = useMutation<{ _id: number; codusu: number }>(
    "post", (b) => `/divergencias/${b._id}/encaminhar-gestor`,
    { successMessage: "Encaminhado para fluxo distinto", onSuccess: () => { refetch(); refetchSummary(); } },
  );
  const estornar = useMutation<{ _id: number }>(
    "post", (b) => `/divergencias/${b._id}/estornar`,
    { successMessage: "Movimento estornado — item voltou para pendente", onSuccess: () => { refetch(); refetchSummary(); } },
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Divergências e Trocas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Analise e decida sobre itens divergentes identificados durante a separação
        </p>
      </div>

      {/* Summary cards — contagens por status (clique para filtrar) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {([
          { key: "todos",     icon: ArrowLeftRight, title: "Todas",      value: summary?.total,      subtitle: "Total de divergências", color: "text-blue-600",    bg: "bg-blue-50" },
          { key: "pendente",  icon: Clock,          title: "Pendentes",  value: summary?.pendentes,  subtitle: "Aguardando decisão",    color: "text-amber-600",   bg: "bg-amber-50" },
          { key: "aprovado",  icon: CheckCircle2,   title: "Aprovadas",  value: summary?.aprovadas,  subtitle: "Trocas aprovadas",      color: "text-emerald-600", bg: "bg-emerald-50" },
          { key: "bloqueado", icon: Forward,        title: "Bloqueadas", value: summary?.bloqueadas, subtitle: "Encaminhadas ao gestor", color: "text-violet-600", bg: "bg-violet-50" },
          { key: "rejeitado", icon: XCircle,        title: "Rejeitadas", value: summary?.rejeitadas, subtitle: "Trocas reprovadas",     color: "text-red-600",     bg: "bg-red-50" },
        ] as const).map((c) => (
          <button key={c.key} type="button" className="text-left cursor-pointer"
            onClick={() => setFilters({ ...filters, status: c.key })}>
            <SummaryCard icon={c.icon} title={c.title} value={c.value ?? "—"} subtitle={c.subtitle}
              iconColor={c.color} iconBg={c.bg}
              className={filters.status === c.key ? "ring-2 ring-primary/40 border-primary/40" : ""} />
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por pedido, item ou cliente..." className="pl-9 h-9 text-sm"
              value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          </div>
          <Select value={filters.tipo} onValueChange={(v) => setFilters({ ...filters, tipo: v })}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="Tipo de divergência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="marca homologada">Marca homologada</SelectItem>
              <SelectItem value="marca não homologada">Marca não homologada</SelectItem>
              <SelectItem value="proporção">Proporção/Porcionamento</SelectItem>
              <SelectItem value="gramatura">Gramatura</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
              <SelectItem value="bloqueado">Bloqueado</SelectItem>
              <SelectItem value="rejeitado">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Divergence cards */}
      <div className="space-y-4">
        {loading && <div className="text-sm text-muted-foreground">Carregando divergências…</div>}
        {divergencias.map((div: any) => (
          <Card key={div.id} className={div.status === "bloqueado" ? "border-red-200 bg-red-50/30" : ""}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-primary">{div.pedido}</span>
                  <span className="text-sm text-muted-foreground">—</span>
                  <span className="text-sm text-foreground">{div.cliente}</span>
                  <StatusBadge status={div.status} />
                </div>
                <Badge
                  variant="outline"
                  className={
                    div.homologada
                      ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                      : "border-red-300 text-red-700 bg-red-50"
                  }
                >
                  {div.homologada ? "Homologada" : "Não Homologada"}
                </Badge>
              </div>

              {/* Item comparison */}
              <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
                {/* Item original */}
                <div className="md:col-span-4 bg-muted/50 rounded-lg p-3">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Item Original (Pedido)</p>
                  <p className="text-sm font-medium text-foreground">{div.itemOriginal}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-mono">{div.codOriginal}</span>
                    {" · "}Marca: <span className="font-medium text-foreground">{div.marcaOriginal ?? "—"}</span>
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Qtd:</span>
                    <span className="text-sm font-semibold tabular-nums">{div.qtdOriginal}</span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="md:col-span-3 flex flex-col items-center justify-center gap-1">
                  <ArrowLeftRight className="w-5 h-5 text-primary" />
                  <div className="text-center">
                    <Badge variant="secondary" className="text-[10px]">{div.tipoDivergencia}</Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">Fator: {div.fatorConversao}</p>
                  </div>
                </div>

                {/* Item separado */}
                <div className="md:col-span-4 bg-primary/5 rounded-lg p-3 border border-primary/10">
                  <p className="text-[10px] font-medium text-primary uppercase tracking-wider mb-1">Item Separado (Físico)</p>
                  <p className="text-sm font-medium text-foreground">{div.itemSeparado}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-mono">{div.codSeparado}</span>
                    {" · "}Marca: <span className="font-medium text-foreground">{div.marcaSeparado ?? "—"}</span>
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Qtd Equiv.:</span>
                    <span className="text-sm font-semibold tabular-nums">{div.qtdEquivalente}</span>
                  </div>
                </div>
              </div>

              {/* Motivo */}
              <div className="mt-4 bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Motivo da divergência</p>
                <p className="text-sm text-foreground">{div.motivo}</p>
              </div>

              {/* Ação com cliente */}
              {div.necessidadeCliente !== "Nenhuma" && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <MessageSquare className="w-4 h-4 text-amber-500" />
                  <span className="text-muted-foreground">Ação com cliente:</span>
                  <span className="font-medium text-foreground">{div.necessidadeCliente}</span>
                </div>
              )}

              {/* Actions — só liberadas enquanto PENDENTE. Após decisão, bloqueia e só permite estorno. */}
              {div.status === "pendente" && (
                <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 flex-wrap">
                  <Button size="sm" className="gap-1.5 h-8" disabled={decidir.loading}
                    onClick={() => decidir.mutate({ acao: "APROVAR", _id: div.id } as any)}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Aprovar Troca
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 border-red-200 text-red-700 hover:bg-red-50"
                    disabled={decidir.loading}
                    onClick={() => decidir.mutate({ acao: "REPROVAR", _id: div.id } as any)}>
                    <XCircle className="w-3.5 h-3.5" />
                    Reprovar
                  </Button>
                  {div.necessidadeCliente === "Informar" && (
                    <Button variant="outline" size="sm" className="gap-1.5 h-8"
                      disabled={informarCliente.loading}
                      onClick={() => informarCliente.mutate({ _id: div.id })}>
                      <MessageSquare className="w-3.5 h-3.5" />
                      Registrar Informação ao Cliente
                    </Button>
                  )}
                  {div.necessidadeCliente === "Aprovação obrigatória" && (
                    <Button variant="outline" size="sm" className="gap-1.5 h-8"
                      disabled={aprovCliente.loading}
                      onClick={() => aprovCliente.mutate({ _id: div.id })}>
                      <UserCheck className="w-3.5 h-3.5" />
                      Registrar Aprovação do Cliente
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="gap-1.5 h-8 ml-auto"
                    disabled={encaminharGestor.loading}
                    onClick={() => encaminharGestor.mutate({ _id: div.id, codusu: 2 })}>
                    <Forward className="w-3.5 h-3.5" />
                    Encaminhar para Gestor
                  </Button>
                </div>
              )}
              {div.status !== "pendente" && (
                <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 flex-wrap">
                  {div.status === "conforme" ? (
                    <span className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Troca aprovada — novas ações bloqueadas
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                      <Forward className="w-4 h-4 text-slate-500" />
                      Item encaminhado/reprovado — novas ações bloqueadas
                    </span>
                  )}
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 ml-auto border-amber-300 text-amber-700 hover:bg-amber-50"
                    disabled={estornar.loading}
                    onClick={() => { if (confirm("Estornar este movimento e devolver o item para pendente?")) estornar.mutate({ _id: div.id }); }}>
                    <Undo2 className="w-3.5 h-3.5" />
                    Estornar Movimento
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
