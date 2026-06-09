/**
 * Tela 9.6 — Tela Final de Conferência Pré-Faturamento
 * Objetivo: Consolidar o resultado final do pedido antes da NF
 * Usuários: Comercial e faturamento
 * Layout: Resumo do pedido + tabelas agrupadas por tipo + ações finais
 */
import { useFetch } from "@/hooks/use-fetch";
import { useMutation } from "@/hooks/use-mutation";
import { useSearch } from "wouter";
import type { PreFaturamento as PreFatType } from "@/lib/api";
import SummaryCard from "@/components/SummaryCard";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  CheckCircle2,
  ArrowLeftRight,
  AlertTriangle,
  ShieldCheck,
  Undo2,
  Lock,
  Unlock,
  Ship,
  Clock,
  User,
  Printer,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Fallback caso API esteja offline (corresponde ao seed do pedido 190)
const mockPedidoResumo = {
  id: "PV-2024-00190",
  cliente: "Distribuidora Norte Alimentos",
  embarcacao: "EMB-043",
  horario: "08:00",
  responsavel: "Maria Santos",
  totalItens: 72,
  conformes: 60,
  substituidos: 5,
  faltas: 4,
  fluxoDistinto: 2,
  pendenciasImpeditivas: 1,
};

const mockItensConformes = [
  { codigo: "PRD-001100", descricao: "Filé de Frango Congelado 1kg", qtd: 50, lote: "L2024-0451", validade: "15/08/2026" },
  { codigo: "PRD-001101", descricao: "Peito de Frango Bandeja 600g", qtd: 30, lote: "L2024-0452", validade: "10/08/2026" },
  { codigo: "PRD-001200", descricao: "Coxa de Frango Congelada 1kg", qtd: 40, lote: "L2024-0460", validade: "20/08/2026" },
];

const mockItensSubstituidos = [
  {
    codOriginal: "PRD-001300",
    descOriginal: "Linguiça Toscana 500g - Marca A",
    codSubstituto: "PRD-001301",
    descSubstituto: "Linguiça Toscana 500g - Marca B",
    qtdOriginal: 20,
    qtdSubstituta: 20,
    tipo: "Marca homologada",
    aprovadoPor: "Maria Santos",
  },
  {
    codOriginal: "PRD-001455",
    descOriginal: "Hambúrguer Bovino 56g cx c/36",
    codSubstituto: "PRD-001456",
    descSubstituto: "Hambúrguer Bovino 56g cx c/12",
    qtdOriginal: 15,
    qtdSubstituta: 45,
    tipo: "Proporção 1:3",
    aprovadoPor: "Maria Santos",
  },
];

const mockItensFalta = [
  { codigo: "PRD-001612", descricao: "Mortadela Bologna 3,5kg", qtdPedida: 10, qtdFaltante: 10, acao: "Compra padrão", previsao: "09:00h" },
  { codigo: "PRD-001900", descricao: "Bacon Defumado Manta 3kg", qtdPedida: 15, qtdFaltante: 5, acao: "Corte", previsao: "—" },
];

const mockItensFluxoDistinto = [
  {
    codNF: "PRD-001300",
    descNF: "Linguiça Toscana 500g - Marca A",
    codFisico: "PRD-001301",
    descFisico: "Linguiça Toscana 500g - Marca B",
    aprovadoPor: "Roberto Gerente",
    justificativa: "Contrato do cliente exige item original na NF",
  },
];

const mockPendencias = [
  {
    tipo: "Falta em compra",
    descricao: "Mortadela Bologna 3,5kg — Aguardando retorno de compra padrão (prev. 09:00h)",
    impeditiva: true,
  },
];

export default function PreFaturamento() {
  // Pedido vem de ?nunota=XXX na URL; default = 190
  const search = useSearch();
  const nunotaParam = new URLSearchParams(search).get("nunota");
  const nunota = nunotaParam ? Number(nunotaParam) : 190;
  const { data: api, refetch } = useFetch<PreFatType>(`/pre-faturamento/${nunota}`);
  const { data: lista } = useFetch<any[]>("/pre-faturamento");
  const liberar = useMutation(
    "post", `/pre-faturamento/${nunota}/liberar`,
    { successMessage: "Pedido liberado para faturamento!", onSuccess: refetch },
  );
  const devolver = useMutation<{ motivo: string }>(
    "post", `/pre-faturamento/${nunota}/devolver-ajuste`,
    { successMessage: "Devolvido para ajuste", onSuccess: refetch },
  );
  const pedidoResumo = api?.pedidoResumo ?? mockPedidoResumo;
  const itensConformes = (api?.itensConformes ?? mockItensConformes) as PreFatType["itensConformes"];
  const itensSubstituidos = (api?.itensSubstituidos ?? mockItensSubstituidos) as PreFatType["itensSubstituidos"];
  const itensFalta = (api?.itensFalta ?? mockItensFalta) as PreFatType["itensFalta"];
  const itensFluxoDistinto = (api?.itensFluxoDistinto ?? mockItensFluxoDistinto) as PreFatType["itensFluxoDistinto"];
  const pendencias = api?.pendencias ?? mockPendencias;
  const percentConforme = Math.round((pedidoResumo.conformes / pedidoResumo.totalItens) * 100);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Conferência Pré-Faturamento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Consolide o resultado final do pedido antes da emissão da NF
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(nunota)} onValueChange={(v) => {
            window.history.pushState({}, "", `/pre-faturamento?nunota=${v}`);
            window.location.reload();
          }}>
            <SelectTrigger className="w-[200px] h-8 text-sm">
              <SelectValue placeholder="Selecionar pedido" />
            </SelectTrigger>
            <SelectContent>
              {(lista ?? []).map((p: any) => (
                <SelectItem key={p.nunota} value={String(p.nunota)}>
                  {p.id} — {p.cliente.slice(0, 30)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5 h-8"
            onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 h-8"
            onClick={() => {
              const blob = new Blob([JSON.stringify(api, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `pre-faturamento-${nunota}.json`;
              a.click();
            }}>
            <Download className="w-3.5 h-3.5" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Pedido header card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">{pedidoResumo.id}</h2>
                  {(pedidoResumo as any).statusPedido ? (
                    <StatusBadge status={(pedidoResumo as any).statusPedido} size="md" />
                  ) : pedidoResumo.pendenciasImpeditivas > 0 ? (
                    <StatusBadge status="bloqueado" label="Com Pendência Impeditiva" size="md" />
                  ) : (
                    <StatusBadge status="conforme" label="Apto para Faturamento" size="md" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{pedidoResumo.cliente}</p>
              </div>
            </div>
            <div className="flex items-center gap-5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Ship className="w-4 h-4" />
                {pedidoResumo.embarcacao}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {pedidoResumo.horario}h
              </span>
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4" />
                {pedidoResumo.responsavel}
              </span>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-foreground tabular-nums">{pedidoResumo.totalItens}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Total Itens</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700 tabular-nums">{pedidoResumo.conformes}</p>
              <p className="text-[10px] text-emerald-600 uppercase tracking-wider mt-0.5">Conformes</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-700 tabular-nums">{pedidoResumo.substituidos}</p>
              <p className="text-[10px] text-blue-600 uppercase tracking-wider mt-0.5">Substituídos</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-orange-700 tabular-nums">{pedidoResumo.faltas}</p>
              <p className="text-[10px] text-orange-600 uppercase tracking-wider mt-0.5">Faltas</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-purple-700 tabular-nums">{pedidoResumo.fluxoDistinto}</p>
              <p className="text-[10px] text-purple-600 uppercase tracking-wider mt-0.5">Fluxo Distinto</p>
            </div>
            <div className={cn("rounded-lg p-3 text-center", pedidoResumo.pendenciasImpeditivas > 0 ? "bg-red-50" : "bg-emerald-50")}>
              <p className={cn("text-2xl font-bold tabular-nums", pedidoResumo.pendenciasImpeditivas > 0 ? "text-red-700" : "text-emerald-700")}>
                {pedidoResumo.pendenciasImpeditivas}
              </p>
              <p className={cn("text-[10px] uppercase tracking-wider mt-0.5", pedidoResumo.pendenciasImpeditivas > 0 ? "text-red-600" : "text-emerald-600")}>
                Impeditivas
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1">
              <Progress value={percentConforme} className="h-2" />
            </div>
            <span className="text-sm font-semibold text-foreground tabular-nums">{percentConforme}% conforme</span>
          </div>
        </CardContent>
      </Card>

      {/* Pendências impeditivas */}
      {pendencias.filter((p) => p.impeditiva).length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-700">
              <Lock className="w-4 h-4" />
              Pendências Impeditivas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendencias
              .filter((p) => p.impeditiva)
              .map((p, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-red-50 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800">{p.tipo}</p>
                    <p className="text-sm text-red-700 mt-0.5">{p.descricao}</p>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Itens Conformes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Itens Conformes
            <Badge variant="secondary" className="ml-1 text-xs">{itensConformes.length} de {pedidoResumo.conformes}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Código</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Descrição</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-center w-[80px]">Qtd</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider w-[120px]">Lote</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider w-[100px]">Validade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itensConformes.map((item) => (
                <TableRow key={item.codigo}>
                  <TableCell className="text-xs font-mono text-muted-foreground">{item.codigo}</TableCell>
                  <TableCell className="text-sm">
                    {item.descricao}
                    <span className="block text-xs text-muted-foreground">Marca: {item.marca ?? "—"}</span>
                  </TableCell>
                  <TableCell className="text-sm text-center font-semibold tabular-nums">{item.qtd}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{item.lote}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.validade}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Itens Substituídos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-blue-500" />
            Itens Substituídos
            <Badge variant="secondary" className="ml-1 text-xs">{itensSubstituidos.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Item Original</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Item Substituto</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-center w-[80px]">Qtd Orig.</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-center w-[80px]">Qtd Subst.</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider w-[140px]">Tipo</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider w-[130px]">Aprovado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itensSubstituidos.map((item) => (
                <TableRow key={item.codOriginal}>
                  <TableCell>
                    <div>
                      <p className="text-sm">{item.descOriginal}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{item.codOriginal}</span>
                        {" · "}Marca: {item.marcaOriginal ?? "—"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{item.descSubstituto}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{item.codSubstituto}</span>
                        {" · "}Marca: {item.marcaSubstituto ?? "—"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-center tabular-nums">{item.qtdOriginal}</TableCell>
                  <TableCell className="text-sm text-center font-semibold tabular-nums">{item.qtdSubstituta}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{item.tipo}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.aprovadoPor}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Faltas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Faltas
            <Badge variant="secondary" className="ml-1 text-xs">{itensFalta.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Código</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Descrição</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-center w-[80px]">Pedida</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-center w-[80px]">Faltante</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider w-[130px]">Ação</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider w-[100px]">Previsão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itensFalta.map((item) => (
                <TableRow key={item.codigo}>
                  <TableCell className="text-xs font-mono text-muted-foreground">{item.codigo}</TableCell>
                  <TableCell className="text-sm">
                    {item.descricao}
                    <span className="block text-xs text-muted-foreground">Marca: {item.marca ?? "—"}</span>
                  </TableCell>
                  <TableCell className="text-sm text-center tabular-nums">{item.qtdPedida}</TableCell>
                  <TableCell className="text-sm text-center font-semibold text-red-600 tabular-nums">{item.qtdFaltante}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        item.acao === "Corte" ? "border-red-200 text-red-700" : "border-blue-200 text-blue-700"
                      )}
                    >
                      {item.acao}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.previsao}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Fluxo Distinto */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-500" />
            Itens em Fluxo Distinto
            <Badge variant="secondary" className="ml-1 text-xs">{itensFluxoDistinto.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Item NF (Fiscal)</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Item Físico</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider w-[130px]">Aprovado por</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider">Justificativa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itensFluxoDistinto.map((item) => (
                <TableRow key={item.codNF}>
                  <TableCell>
                    <div>
                      <p className="text-sm">{item.descNF}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{item.codNF}</span>
                        {" · "}Marca: {item.marcaNF ?? "—"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{item.descFisico}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{item.codFisico}</span>
                        {" · "}Marca: {item.marcaFisico ?? "—"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.aprovadoPor}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">{item.justificativa}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Final actions */}
      <Card className="border-2 border-dashed">
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Decisão Final</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pedidoResumo.pendenciasImpeditivas > 0
                  ? "Este pedido possui pendências impeditivas que devem ser resolvidas antes do faturamento."
                  : "Todas as pendências foram resolvidas. O pedido está apto para faturamento."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" className="gap-2 h-10"
                disabled={devolver.loading}
                onClick={() => {
                  const motivo = window.prompt("Motivo da devolução para ajuste:");
                  if (motivo && motivo.trim()) devolver.mutate({ motivo: motivo.trim() });
                }}>
                <Undo2 className="w-4 h-4" />
                Devolver para Ajuste
              </Button>
              {pedidoResumo.pendenciasImpeditivas > 0 ? (
                <Button variant="outline" className="gap-2 h-10 border-red-300 text-red-700" disabled>
                  <Lock className="w-4 h-4" />
                  Faturamento Bloqueado
                </Button>
              ) : (
                <Button className="gap-2 h-10 bg-emerald-600 hover:bg-emerald-700"
                  disabled={liberar.loading}
                  onClick={() => liberar.mutate({} as any)}>
                  <Unlock className="w-4 h-4" />
                  Liberar para Faturamento
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
