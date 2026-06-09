/**
 * Tela 9.5 — Aprovação Gerencial de Fluxo Distinto
 */
import { useMemo, useState } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { useMutation } from "@/hooks/use-mutation";
import type { FluxoDistinto as FluxoDistType } from "@/lib/api";
import SummaryCard from "@/components/SummaryCard";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldCheck, ShieldAlert, CheckCircle2, XCircle, Undo2, Search, FileText,
  ArrowRight, History, AlertTriangle, User, Clock, Scale, Package, Receipt,
} from "lucide-react";

const mockFluxos = [
  {
    id: 1, pedido: "PV-2024-00190", cliente: "Distribuidora Norte Alimentos",
    itemPedidoNF: "Linguiça Toscana 500g - Marca A", codPedidoNF: "PRD-001300",
    itemFisico: "Linguiça Toscana 500g - Marca B", codFisico: "PRD-001301",
    justificativa: "Marca A com estoque zerado. Marca B é equivalente homologada.",
    solicitante: "Maria Santos (Comercial)", dataSolicitacao: "14/05/2026 07:15",
    impacto: "Movimento compensatório de estoque será gerado automaticamente.",
    historico: [
      { data: "14/05/2026 06:45", acao: "Divergência identificada", usuario: "Carlos Silva" },
      { data: "14/05/2026 07:00", acao: "Troca aprovada pelo comercial", usuario: "Maria Santos" },
    ],
    status: "pendente" as const,
  },
];

type FluxoSummary = {
  aguardando: number; aprovadosHoje: number; aprovadosTotal: number;
  rejeitados: number; total: number;
};

export default function FluxoDistinto() {
  const [filters, setFilters] = useState({ q: "", status: "todos" });
  const params = useMemo(() => ({ ...filters }), [filters]);
  const { data: apiFluxos, loading, refetch } = useFetch<FluxoDistType[]>("/fluxo-distinto", params);
  const { data: summary, refetch: refetchSummary } = useFetch<FluxoSummary>("/fluxo-distinto/summary");
  const fluxos = (apiFluxos ?? mockFluxos) as any[];
  const [justifPorId, setJustifPorId] = useState<Record<number, string>>({});

  const decidir = useMutation<{ acao: "APROVAR" | "REJEITAR"; codusu: number; justificativa: string; _id: number }>(
    "post",
    (b) => `/fluxo-distinto/${b._id}/decidir`,
    { successMessage: "Decisão registrada", onSuccess: () => { refetch(); refetchSummary(); } },
  );
  const devolver = useMutation<{ _id: number; motivo: string }>(
    "post",
    (b) => `/fluxo-distinto/${b._id}/devolver`,
    { successMessage: "Devolvido para ajuste", onSuccess: () => { refetch(); refetchSummary(); } },
  );

  const handleDecidir = (acao: "APROVAR" | "REJEITAR", id: number) => {
    const j = justifPorId[id] ?? "";
    if (!j.trim() || j.trim().length < 5) {
      alert("Justificativa é obrigatória (mín. 5 caracteres)");
      return;
    }
    decidir.mutate({ acao, codusu: 5, justificativa: j, _id: id });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Aprovação de Fluxo Distinto</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aprove exceções onde o item físico expedido difere do item fiscal faturado
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Aprovação restrita a Supervisor ou Gerente</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Movimentos compensatórios de estoque exigem justificativa obrigatória.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard icon={ShieldCheck} title="Aguardando Aprovação"
          value={summary?.aguardando ?? "—"} subtitle="Fluxos pendentes"
          iconColor="text-purple-600" iconBg="bg-purple-50" />
        <SummaryCard icon={CheckCircle2} title="Aprovados Hoje"
          value={summary?.aprovadosHoje ?? "—"} subtitle="Com justificativa"
          iconColor="text-emerald-600" iconBg="bg-emerald-50" />
        <SummaryCard icon={Scale} title="Impacto Fiscal"
          value={`${summary?.aprovadosTotal ?? 0} itens`} subtitle="Movimentos compensatórios"
          iconColor="text-blue-600" iconBg="bg-blue-50" />
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-9 h-9 text-sm"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          </div>
          <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
              <SelectItem value="rejeitado">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-5">
        {loading && <div className="text-sm text-muted-foreground">Carregando…</div>}
        {fluxos.map((f: any) => (
          <Card key={f.id} className="border-purple-200 overflow-hidden">
            <div className="h-1 bg-purple-500" />
            <CardContent className="p-5 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-primary">{f.pedido}</span>
                    <StatusBadge status={f.status ?? "distinto"} label="Fluxo Distinto" size="md" />
                  </div>
                  <p className="text-sm text-foreground mt-1">{f.cliente}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{f.solicitante}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{f.dataSolicitacao}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-11 gap-4">
                <div className="md:col-span-5 bg-muted/50 rounded-lg p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Receipt className="w-4 h-4 text-muted-foreground" />
                    <p className="text-[10px] font-semibold uppercase tracking-wider">Item NF (Fiscal)</p>
                  </div>
                  <p className="text-sm font-medium">{f.itemPedidoNF}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-mono">{f.codPedidoNF}</span>
                    {" · "}Marca: <span className="font-medium text-foreground">{f.marcaPedidoNF ?? "—"}</span>
                  </p>
                </div>
                <div className="md:col-span-1 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-purple-600" />
                  </div>
                </div>
                <div className="md:col-span-5 bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-purple-600" />
                    <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider">Item Físico</p>
                  </div>
                  <p className="text-sm font-medium">{f.itemFisico}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-mono">{f.codFisico}</span>
                    {" · "}Marca: <span className="font-medium text-foreground">{f.marcaFisico ?? "—"}</span>
                  </p>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wider">Justificativa</p>
                </div>
                <p className="text-sm">{f.justificativa}</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-blue-600" />
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Impacto Operacional</p>
                </div>
                <p className="text-sm text-blue-700">{f.impacto}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wider">Histórico</p>
                </div>
                <div className="space-y-2 ml-2">
                  {(f.historico ?? []).map((h: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-border mt-1.5 shrink-0" />
                      <div>
                        <span className="text-xs text-muted-foreground">{h.data}</span>
                        <span className="mx-1.5 text-muted-foreground">—</span>
                        <span>{h.acao}</span>
                        <span className="text-xs text-muted-foreground ml-1">({h.usuario})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {f.status === "pendente" && (
                <>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Justificativa do Gestor (obrigatória)</Label>
                    <Textarea
                      placeholder="Informe a justificativa..."
                      className="min-h-[80px] text-sm"
                      value={justifPorId[f.id] ?? ""}
                      onChange={(e) => setJustifPorId({ ...justifPorId, [f.id]: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Button className="gap-2 h-10 bg-emerald-600 hover:bg-emerald-700"
                      disabled={decidir.loading}
                      onClick={() => handleDecidir("APROVAR", f.id)}>
                      <CheckCircle2 className="w-4 h-4" /> Aprovar
                    </Button>
                    <Button variant="outline" className="gap-2 h-10 border-red-300 text-red-700 hover:bg-red-50"
                      disabled={decidir.loading}
                      onClick={() => handleDecidir("REJEITAR", f.id)}>
                      <XCircle className="w-4 h-4" /> Reprovar
                    </Button>
                    <Button variant="ghost" className="gap-2 h-10 ml-auto"
                      disabled={devolver.loading}
                      onClick={() => {
                        const m = window.prompt("Motivo da devolução para ajuste:");
                        if (m && m.trim()) devolver.mutate({ _id: f.id, motivo: m.trim() });
                      }}>
                      <Undo2 className="w-4 h-4" /> Devolver
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
