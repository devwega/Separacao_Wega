/**
 * Tela BIPE Separação — Layout Mobile
 * Otimizada para coletores de dados e tablets no armazém.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { useFetch } from "@/hooks/use-fetch";
import { useMutation } from "@/hooks/use-mutation";
import type { PedidoDetalhe } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  ScanBarcode,
  Check,
  AlertTriangle,
  XCircle,
  Package,
  ChevronRight,
  ChevronUp,
  Clock,
  Ship,
  User,
  Hash,
  Calendar,
  Layers,
  ArrowLeftRight,
  Info,
  ArrowLeft,
  List,
  Vibrate,
  CheckCircle2,
  CircleDot,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { toast } from "sonner";

// Fallback caso API esteja offline
const mockItensFallback = [
  { id: 1, codigo: "PRD-001245", codprod: 1245, descricao: "Filé de Frango Congelado 1kg", eanEsperado: "7891234567890", qtdPedida: 50, qtdSeparada: 50, status: "conforme" as const },
  { id: 2, codigo: "PRD-001246", codprod: 1246, descricao: "Peito de Frango Bandeja 600g", eanEsperado: "7891234567891", qtdPedida: 30, qtdSeparada: 30, status: "conforme" as const },
  { id: 3, codigo: "PRD-001300", codprod: 1300, descricao: "Linguiça Toscana 500g - Marca A", eanEsperado: "7891234567892", qtdPedida: 20, qtdSeparada: 0, status: "separacao" as const },
  { id: 4, codigo: "PRD-001455", codprod: 1455, descricao: "Hambúrguer Bovino 56g cx c/36", eanEsperado: "7891234567893", qtdPedida: 15, qtdSeparada: 0, status: "pendente" as const },
  { id: 5, codigo: "PRD-001500", codprod: 1500, descricao: "Salsicha Hot Dog 3kg", eanEsperado: "7891234567894", qtdPedida: 40, qtdSeparada: 0, status: "pendente" as const },
  { id: 6, codigo: "PRD-001612", codprod: 1612, descricao: "Mortadela Bologna 3,5kg", eanEsperado: "7891234567895", qtdPedida: 10, qtdSeparada: 0, status: "pendente" as const },
];

type ValidacaoResult = {
  ok: boolean;
  match?: string;
  motivo?: string;
  fatorConv?: number;
  flags?: { eanOk: boolean; loteOk: boolean; validadeOk: boolean; equivalenciaOk: boolean; shelfLifeOk: boolean };
};

function ItemStatusIcon({ status }: { status: string }) {
  if (status === "conforme") return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
  if (status === "separacao") return <CircleDot className="w-5 h-5 text-sky-500 animate-pulse" />;
  return <Circle className="w-5 h-5 text-muted-foreground/40" />;
}

export default function BipeMobile() {
  const search = useSearch();
  const nunotaParam = new URLSearchParams(search).get("nunota");
  const nunota = nunotaParam ? Number(nunotaParam) : 187;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: pedido, refetch } = useFetch<PedidoDetalhe>(`/pedidos/${nunota}`);

  const mockItens = useMemo(() => {
    const raw = (pedido?.itens && pedido.itens.length > 0 ? pedido.itens : mockItensFallback) as any[];
    return raw.map((i: any) => ({
      id: i.id ?? i.SEQUENCIA ?? 0,
      codigo: i.codigo,
      codprod: i.codprod,
      descricao: i.descricao,
      eanEsperado: i.eanEsperado,
      qtdPedida: i.qtdPedida,
      qtdSeparada: i.qtdSeparada,
      status: (i.status as "conforme" | "separacao" | "pendente") ?? "pendente",
    }));
  }, [pedido]);

  const [itemAtualId, setItemAtualId] = useState<number | null>(null);
  useEffect(() => {
    if (itemAtualId == null && mockItens.length > 0) {
      const sep = mockItens.find((i) => i.status === "separacao");
      const pend = mockItens.find((i) => i.status === "pendente");
      setItemAtualId((sep ?? pend ?? mockItens[0]).id);
    }
  }, [mockItens, itemAtualId]);

  const itemAtual = useMemo(
    () => mockItens.find((i) => i.id === itemAtualId) ?? mockItens[0],
    [mockItens, itemAtualId],
  );
  const totalItens = mockItens.length;
  const itensConformes = mockItens.filter((i: any) => i.status === "conforme").length;
  const progressPercent = totalItens ? Math.round((itensConformes / totalItens) * 100) : 0;

  // Inputs
  const [ean, setEan] = useState("");
  const [lote, setLote] = useState("");
  const [validade, setValidade] = useState("");
  const [qtdSep, setQtdSep] = useState("");
  const [qtdFalt, setQtdFalt] = useState("");
  const [validacao, setValidacao] = useState<ValidacaoResult | null>(null);

  useEffect(() => {
    setEan("");
    setLote("");
    setValidade("");
    setQtdSep("");
    setQtdFalt("");
    setValidacao(null);
  }, [itemAtualId]);

  // Saldo
  const { data: saldo } = useFetch<{ disponivel: number }[]>(
    `/bipagem/saldo/${itemAtual?.codprod ?? 0}`,
  );
  const saldoDisponivel = saldo?.reduce((s, r) => s + (r.disponivel || 0), 0) ?? 0;

  // Mutations
  const validarEan = useMutation<any, ValidacaoResult>("post", "/bipagem/validar-ean", {
    onSuccess: (data) => setValidacao(data),
  });
  const conferir = useMutation("put", "/bipagem/conferir", {
    successMessage: "Item confirmado!",
    onSuccess: () => {
      refetch();
      setEan("");
      setLote("");
      setQtdSep("");
      setValidacao(null);
    },
  });
  const registrarDivergencia = useMutation("post", "/bipagem/registrar-divergencia", {
    successMessage: "Divergência registrada",
    onSuccess: () => refetch(),
  });
  const registrarFalta = useMutation("post", "/bipagem/registrar-falta", {
    successMessage: "Falta registrada",
    onSuccess: () => refetch(),
  });

  const handleBipar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && ean && itemAtual?.id) {
      validarEan.mutate({ nunota, sequencia: itemAtual.id, ean, lote, validade });
    }
  };

  const handleConfirmar = () => {
    if (!itemAtual) return;
    if (validacao && !validacao.ok) {
      toast.error("Resolva os erros de validação antes de confirmar.");
      return;
    }
    conferir.mutate({
      nunota,
      sequencia: itemAtual.id,
      qtdSeparada: Number(qtdSep) || itemAtual.qtdPedida,
      lote,
      validade,
    } as any);
  };

  const handleDivergencia = () => {
    if (!itemAtual) return;
    const codSubst = window.prompt("Código do produto substituto:");
    if (!codSubst) return;
    const motivo = window.prompt("Motivo da divergência:", "Produto original sem estoque") ?? "";
    if (!motivo.trim()) {
      toast.error("Motivo obrigatório.");
      return;
    }
    registrarDivergencia.mutate({
      nunota,
      sequencia: itemAtual.id,
      codProdSubst: Number(codSubst),
      qtdSubst: Number(qtdSep) || itemAtual.qtdPedida,
      tipoEquiv: "EXATA",
      motivo,
      homologada: true,
      necessidadeCliente: "Informar",
      tipoDivergencia: "Marca homologada",
    } as any);
  };

  const handleFalta = () => {
    if (!itemAtual) return;
    const q = window.prompt(
      `Quantidade faltante (qtd pedida: ${itemAtual.qtdPedida}):`,
      qtdFalt || String(itemAtual.qtdPedida),
    );
    if (!q) return;
    const qtd = Number(q);
    if (!qtd || Number.isNaN(qtd)) {
      toast.error("Quantidade inválida.");
      return;
    }
    const obs = window.prompt("Observação (opcional):", "") ?? "";
    registrarFalta.mutate({
      nunota,
      sequencia: itemAtual.id,
      qtdFaltante: qtd,
      tipo: qtd >= itemAtual.qtdPedida ? "total" : "parcial",
      criticidade: "ALTA",
      observacao: obs,
    } as any);
  };

  const flag = (k: keyof NonNullable<ValidacaoResult["flags"]>) =>
    validacao?.flags ? validacao.flags[k] : undefined;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* HEADER */}
      <header className="bg-card border-b border-border px-4 pt-3 pb-3 shrink-0 safe-area-top">
        <div className="flex items-center justify-between mb-2">
          <Link href="/bipe">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground active:text-foreground transition-colors -ml-1 p-1">
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
          </Link>
          <div className="bg-muted px-2.5 py-1 rounded-md">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              Mobile
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-foreground">
                {pedido?.NUNNOTA ?? `Pedido ${nunota}`}
              </h1>
              <StatusBadge status={(pedido as any)?.statusPedido ?? "EM_SEPARACAO"} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{pedido?.cliente ?? "—"}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tabular-nums text-foreground">
              {itensConformes}/{totalItens}
            </p>
            <p className="text-[10px] text-muted-foreground">itens</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Ship className="w-3 h-3" />
            {pedido?.embarcacao ?? "—"}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {pedido?.horarioCarregamento ? `${pedido.horarioCarregamento}h` : "—"}
          </span>
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {pedido?.separador ?? "—"}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-2.5">
          <Progress value={progressPercent} className="h-1.5 flex-1" />
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
            {progressPercent}%
          </span>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-6">
        {/* Item atual — card destacado */}
        <div className="bg-primary/5 border-2 border-primary/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Item Atual</p>
            <Badge variant="outline" className="text-[10px] font-mono h-5">
              {itemAtual?.id ?? 0} de {totalItens}
            </Badge>
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug">
            {itemAtual?.descricao ?? "—"}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-mono">
              <Hash className="w-3 h-3" />
              {itemAtual?.codigo ?? "—"}
            </span>
            <span className="flex items-center gap-1 font-mono">
              <ScanBarcode className="w-3 h-3" />
              {itemAtual?.eanEsperado ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-primary/10">
            <div>
              <p className="text-[10px] text-muted-foreground">Qtd. Pedida</p>
              <p className="text-xl font-bold text-foreground tabular-nums">
                {itemAtual?.qtdPedida ?? 0}{" "}
                <span className="text-xs font-normal text-muted-foreground">un</span>
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
              <p className="text-[10px] text-blue-600">Saldo estoque</p>
              <p className="text-sm font-bold text-blue-700 tabular-nums">{saldoDisponivel} un</p>
            </div>
          </div>
        </div>

        {/* CAMPO DE BIPAGEM */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Vibrate className="w-3.5 h-3.5 text-primary" />
            Leitura do EAN (Bipagem)
          </Label>
          <div className="relative">
            <Input
              placeholder="Bipe ou digite o código EAN..."
              className="h-14 text-lg font-mono pl-4 pr-14 border-2 border-primary/40 focus:border-primary rounded-xl bg-card shadow-sm"
              autoFocus
              inputMode="numeric"
              value={ean}
              onChange={(e) => setEan(e.target.value)}
              onKeyDown={handleBipar}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary/10 rounded-lg p-2">
              <ScanBarcode className="w-6 h-6 text-primary animate-pulse" />
            </div>
          </div>
          {validacao && (
            <div
              className={cn(
                "text-xs px-3 py-1.5 rounded-md border",
                validacao.ok
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-red-50 text-red-700 border-red-200",
              )}
            >
              {validacao.ok ? `✓ EAN válido (${validacao.match})` : `✗ ${validacao.motivo}`}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Info className="w-3 h-3" />
            Validação automática de EAN, equivalência e shelf life
          </p>
        </div>

        {/* Campos complementares */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
              <Layers className="w-3 h-3" />
              Lote
            </Label>
            <Input
              placeholder="Nº do lote"
              className="h-10 text-sm rounded-lg"
              value={lote}
              onChange={(e) => setLote(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
              <Calendar className="w-3 h-3" />
              Validade
            </Label>
            <Input
              type="date"
              className="h-10 text-sm rounded-lg"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
              <Package className="w-3 h-3" />
              Qtd. Separada
            </Label>
            <Input
              type="number"
              placeholder="0"
              className="h-10 text-sm rounded-lg"
              inputMode="numeric"
              value={qtdSep}
              onChange={(e) => setQtdSep(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
              <AlertTriangle className="w-3 h-3" />
              Qtd. Faltante
            </Label>
            <Input
              type="number"
              placeholder="0"
              className="h-10 text-sm rounded-lg"
              inputMode="numeric"
              value={qtdFalt}
              onChange={(e) => setQtdFalt(e.target.value)}
            />
          </div>
        </div>

        {/* Validação */}
        <div className="bg-muted/50 rounded-xl p-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Validação
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "EAN", val: flag("eanOk") },
              { label: "Lote", val: flag("loteOk") },
              {
                label: "Validade",
                val: validacao?.flags ? validacao.flags.validadeOk && validacao.flags.shelfLifeOk : undefined,
              },
              { label: "Equiv.", val: flag("equivalenciaOk") },
            ].map((v) => {
              const color =
                v.val === undefined
                  ? "bg-muted text-muted-foreground"
                  : v.val
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700";
              const Icon = v.val === false ? XCircle : Check;
              return (
                <div key={v.label} className="flex flex-col items-center gap-1">
                  <div
                    className={cn("w-8 h-8 rounded-full flex items-center justify-center", color)}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{v.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* AÇÕES NO RODAPÉ */}
      <div className="shrink-0 border-t border-border bg-card px-4 pt-3 pb-4 safe-area-bottom space-y-2.5">
        <Button
          onClick={handleConfirmar}
          disabled={conferir.loading || !itemAtual}
          className="w-full h-13 text-base font-semibold gap-2 rounded-xl shadow-md active:scale-[0.98] transition-transform"
          style={{ minHeight: "52px" }}
        >
          <Check className="w-5 h-5" />
          Confirmar Item Conforme
        </Button>

        <div className="grid grid-cols-2 gap-2.5">
          <Button
            variant="outline"
            disabled={registrarDivergencia.loading || !itemAtual}
            onClick={handleDivergencia}
            className="h-12 text-sm gap-1.5 rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50 active:bg-amber-100 active:scale-[0.98] transition-transform"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Divergência
          </Button>
          <Button
            variant="outline"
            disabled={registrarFalta.loading || !itemAtual}
            onClick={handleFalta}
            className="h-12 text-sm gap-1.5 rounded-xl border-red-300 text-red-700 hover:bg-red-50 active:bg-red-100 active:scale-[0.98] transition-transform"
          >
            <XCircle className="w-4 h-4" />
            Falta
          </Button>
        </div>

        {/* Lista de itens — drawer */}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>
            <button className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <List className="w-3.5 h-3.5" />
              <span>Ver todos os itens do pedido</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </DrawerTrigger>

          <DrawerContent className="max-h-[75vh]">
            <DrawerHeader className="pb-2">
              <DrawerTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Itens do Pedido
                <Badge variant="secondary" className="text-[10px] ml-1">
                  {itensConformes}/{totalItens}
                </Badge>
              </DrawerTitle>
            </DrawerHeader>

            <div className="overflow-y-auto px-4 pb-6">
              <div className="space-y-1">
                {mockItens.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setItemAtualId(item.id);
                      setDrawerOpen(false);
                    }}
                    className={cn(
                      "w-full text-left flex items-center gap-3 p-3 rounded-xl transition-colors",
                      itemAtual && item.id === itemAtual.id
                        ? "bg-primary/5 border border-primary/20"
                        : "hover:bg-accent/50",
                    )}
                  >
                    <ItemStatusIcon status={item.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.descricao}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {item.codigo}
                        </span>
                        <StatusBadge status={item.status} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tabular-nums text-foreground">
                        {item.qtdSeparada}/{item.qtdPedida}
                      </p>
                      <p className="text-[10px] text-muted-foreground">un</p>
                    </div>
                    {itemAtual && item.id === itemAtual.id && (
                      <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
}
