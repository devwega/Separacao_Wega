/**
 * Tela 9.2 — Tela BIPE de Separação
 * Objetivo: Registrar a execução física da separação item a item
 * Usuários: Separador
 * Layout: Header do pedido + lista de itens à esquerda + painel de bipagem à direita
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ScanBarcode,
  Check,
  AlertTriangle,
  XCircle,
  Package,
  ChevronRight,
  Clock,
  Ship,
  User,
  Hash,
  Calendar,
  Layers,
  ArrowLeftRight,
  Info,
  Undo2,
  Gauge,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

// BS-2.4 / FA-5.2: rótulo e cor das tags de tratativa por item.
const TRATATIVA_INFO: Record<string, { label: string; cls: string }> = {
  EM_TRATATIVA_DIVERGENCIA:   { label: "Em tratativa de divergência", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  DIVERGENCIA_ENCAMINHADA:    { label: "Encaminhado ao gestor",        cls: "bg-violet-100 text-violet-800 border-violet-200" },
  FLUXO_DISTINTO_PENDENTE:    { label: "Fluxo distinto (pendente)",    cls: "bg-violet-100 text-violet-800 border-violet-200" },
  APROVADO_FLUXO_DISTINTO:    { label: "Aprovado em fluxo distinto",   cls: "bg-sky-100 text-sky-800 border-sky-200" },
  TROCA_APROVADA:             { label: "Troca aprovada",               cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  TROCA_REJEITADA:            { label: "Troca reprovada",              cls: "bg-red-100 text-red-700 border-red-200" },
  FALTA_AGUARDANDO_DEFINICAO: { label: "Aguardando definição (compras)", cls: "bg-orange-100 text-orange-800 border-orange-200" },
  EM_APANHO:                  { label: "Em apanho",                    cls: "bg-teal-100 text-teal-800 border-teal-200" },
  COMPRA_PADRAO:              { label: "Compra padrão",                cls: "bg-blue-100 text-blue-800 border-blue-200" },
  AGUARDANDO_CORTE_COMERCIAL: { label: "Aguardando corte (comercial)", cls: "bg-rose-100 text-rose-800 border-rose-200" },
  FALTA_RESOLVIDA:            { label: "Falta resolvida",              cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};
const TRATATIVA_BLOQUEIA = new Set([
  "EM_TRATATIVA_DIVERGENCIA", "DIVERGENCIA_ENCAMINHADA", "FLUXO_DISTINTO_PENDENTE",
  "FALTA_AGUARDANDO_DEFINICAO", "EM_APANHO", "COMPRA_PADRAO", "AGUARDANDO_CORTE_COMERCIAL",
]);

type ValidacaoResult = {
  ok: boolean;
  match?: string;
  motivo?: string;
  flv?: boolean;
  fatorConv?: number;
  outroProduto?: { CODPROD: number; DESCRPROD: string; MARCA?: string; alternativo?: boolean };
  flags?: { eanOk: boolean; marcaOk?: boolean; loteOk: boolean; validadeOk: boolean; equivalenciaOk: boolean; shelfLifeOk: boolean };
};

export default function BipeSeparacao() {
  const search = useSearch();
  const sp = new URLSearchParams(search);
  const nunotaParam = sp.get("nunota");
  const nunota = nunotaParam ? Number(nunotaParam) : 187;
  // BS-2.1: quando vem da Tela 1 com um local, mostra apenas os itens daquele local.
  const localParam = sp.get("local") || undefined;
  const { data: pedido, refetch } = useFetch<PedidoDetalhe>(
    `/pedidos/${nunota}`, localParam ? { local: localParam } : undefined,
  );

  const itens = useMemo(() => {
    const raw = (pedido?.itens && pedido.itens.length > 0 ? pedido.itens : mockItensFallback) as any[];
    return raw.map((i: any) => ({
      id: i.id ?? i.SEQUENCIA ?? 0,
      codigo: i.codigo,
      codprod: i.codprod,
      descricao: i.descricao,
      eanEsperado: i.eanEsperado,
      marca: i.marca,
      lote: i.lote,
      temFalta: !!i.temFalta,
      tratativa: (i.tratativa as string | null) ?? null,
      qtdPedida: i.qtdPedida,
      qtdSeparada: i.qtdSeparada,
      status: (i.status as "conforme" | "separacao" | "pendente") ?? "pendente",
      // Item 5: carrega o fluxo distinto aprovado (item NF + item físico) para a tela dividida.
      fluxoDistinto: i.fluxoDistinto,
    }));
  }, [pedido]);

  // Seleção controlada do item
  const [itemAtualId, setItemAtualId] = useState<number | null>(null);
  useEffect(() => {
    // Quando os itens carregarem, escolhe o primeiro em separação, depois o primeiro pendente, senão o primeiro
    if (itemAtualId == null && itens.length > 0) {
      const sep = itens.find((i) => i.status === "separacao");
      const pend = itens.find((i) => i.status === "pendente");
      setItemAtualId((sep ?? pend ?? itens[0]).id);
    }
  }, [itens, itemAtualId]);

  const itemAtual = useMemo(() => itens.find((i) => i.id === itemAtualId) ?? itens[0], [itens, itemAtualId]);
  const indiceAtual = useMemo(
    () => (itemAtual ? Math.max(1, itens.findIndex((i) => i.id === itemAtual.id) + 1) : 1),
    [itens, itemAtual],
  );
  const itensSeparados = itens.filter((i) => i.status === "conforme").length;
  const progresso = itens.length ? Math.round((itensSeparados / itens.length) * 100) : 0;

  const [ean, setEan] = useState("");
  const [lote, setLote] = useState("");
  const [validade, setValidade] = useState("");
  const [qtdSep, setQtdSep] = useState<string>("");
  const [qtdFalt, setQtdFalt] = useState<string>("");
  const [validacao, setValidacao] = useState<ValidacaoResult | null>(null);
  const [lotesExtra, setLotesExtra] = useState<{ lote: string; validade: string; qtd: string }[]>([]);
  // BS-2.2: bipagem das 2 remessas do fluxo distinto (entrada = item NF, saida = item fisico)
  const [rEnt, setREnt] = useState({ ean: "", lote: "", validade: "", qtd: "" });
  const [rSai, setRSai] = useState({ ean: "", lote: "", validade: "", qtd: "" });
  // Item 5: a remessa de SAÍDA (item físico) mantém as validações padrão (validar-ean).
  const [saiValidacao, setSaiValidacao] = useState<ValidacaoResult | null>(null);

  // Reset campos ao trocar de item
  useEffect(() => {
    const it = itens.find((i) => i.id === itemAtualId);
    setEan("");
    setValidade("");
    setQtdFalt("");
    setValidacao(null);
    setLotesExtra([]);
    setREnt({ ean: "", lote: "", validade: "", qtd: "" });
    setRSai({ ean: "", lote: "", validade: "", qtd: "" });
    setSaiValidacao(null);
    // BS-05: ao reabrir item ja separado, traz lote e qtd separada
    if (it && it.status === "conforme") {
      setLote(it.lote || "");
      setQtdSep(String(it.qtdSeparada || ""));
    } else {
      setLote("");
      setQtdSep("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemAtualId]);

  // Dialog state — Divergência
  const [divOpen, setDivOpen] = useState(false);
  const [divCodSubst, setDivCodSubst] = useState("");
  const [divQtd, setDivQtd] = useState("");
  const [divMotivo, setDivMotivo] = useState("");
  const [divTipo, setDivTipo] = useState("Marca homologada");
  const [divNecessidadeCli, setDivNecessidadeCli] = useState("Informar");
  const [divProdBipado, setDivProdBipado] = useState<{ codprod: number; nome: string; ean: string; marca?: string } | null>(null);

  // Dialog state — Falta
  const [faltaOpen, setFaltaOpen] = useState(false);
  const [faltaQtd, setFaltaQtd] = useState("");
  const [faltaObs, setFaltaObs] = useState("");
  const [faltaCrit, setFaltaCrit] = useState<"CRITICA" | "ALTA" | "MEDIA" | "BAIXA">("ALTA");

  const validarEan = useMutation<any, ValidacaoResult>(
    "post", "/bipagem/validar-ean",
    { onSuccess: (data) => setValidacao(data) },
  );
  // Item 5: validação padrão da remessa de saída (item físico do fluxo distinto).
  const validarEanSai = useMutation<any, ValidacaoResult>(
    "post", "/bipagem/validar-ean",
    { onSuccess: (data) => setSaiValidacao(data) },
  );
  const conferir = useMutation(
    "put", "/bipagem/conferir",
    { successMessage: "Item confirmado!", onSuccess: () => { refetch(); setEan(""); setLote(""); setQtdSep(""); setValidacao(null); } },
  );
  const registrarDivergencia = useMutation(
    "post", "/bipagem/registrar-divergencia",
    { successMessage: "Divergência registrada", onSuccess: () => { refetch(); setDivOpen(false); setDivCodSubst(""); setDivQtd(""); setDivMotivo(""); setValidacao(null); } },
  );
  const registrarFalta = useMutation(
    "post", "/bipagem/registrar-falta",
    { successMessage: "Falta registrada", onSuccess: () => { refetch(); setFaltaOpen(false); setFaltaQtd(""); setFaltaObs(""); setValidacao(null); } },
  );
  const registrarRemessa = useMutation(
    "post", "/bipagem/registrar-remessa-fluxo",
    { successMessage: "Remessa registrada", onSuccess: () => { refetch(); } },
  );
  const enviarRemessa = (tipo: "ENTRADA" | "SAIDA") => {
    const fd = (itemAtual as any)?.fluxoDistinto;
    if (!fd) return;
    const r = tipo === "ENTRADA" ? rEnt : rSai;
    // Entrada (item da NF, não vai fisicamente): quantidade travada na qtd pedida do item.
    const qtd = tipo === "ENTRADA" ? Number(itemAtual?.qtdPedida ?? 0) : Number(r.qtd);
    if (!qtd || qtd <= 0) { toast.error("Informe a quantidade separada."); return; }
    // Item 5: a saída (item físico) só registra após a validação padrão passar.
    if (tipo === "SAIDA") {
      if (!saiValidacao) { toast.error("Bipe e valide o EAN do item físico antes de registrar a saída."); return; }
      if (!saiValidacao.ok) { toast.error("Resolva os erros de validação do item físico antes de registrar a saída."); return; }
    }
    registrarRemessa.mutate({
      nufluxodist: fd.nufluxodist, tipo,
      codprod: tipo === "ENTRADA" ? fd.codProdNF : fd.codProdFisico,
      ean: r.ean, lote: r.lote, validade: r.validade, qtd,
    } as any);
  };
  const estornarItem = useMutation(
    "post", "/bipagem/estornar-item",
    { successMessage: "Separação do item estornada", onSuccess: () => { refetch(); setValidacao(null); } },
  );
  const estornarTudo = useMutation<{ _n: number }>(
    "post", (b) => `/pedidos/${b._n}/estornar-separacao`,
    { successMessage: "Separação completa estornada", onSuccess: () => { refetch(); } },
  );

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
    const qtdPrincipal = Number(qtdSep);
    // BS-2.6: se há lotes adicionais, envia o array completo (backend soma as quantidades).
    const lotesPayload = lotesExtra.length > 0
      ? [{ lote, validade, qtd: qtdPrincipal },
         ...lotesExtra.map((l) => ({ lote: l.lote, validade: l.validade, qtd: Number(l.qtd) || 0 }))]
      : undefined;
    conferir.mutate({
      nunota, sequencia: itemAtual.id,
      qtdSeparada: qtdPrincipal,
      lote, validade, lotes: lotesPayload,
    } as any);
  };
  const abrirDialogDivergencia = () => {
    if (!itemAtual) return;
    // Item 3: validade abaixo do mínimo → aprovação do comercial (mesmo produto, qtd mantida).
    if (validadeInsuficiente) {
      setDivCodSubst(String(itemAtual.codprod));
      setDivQtd(String(itemAtual.qtdPedida));
      setDivTipo("Validade abaixo do mínimo");
      setDivNecessidadeCli("Aprovação obrigatória");
      setDivMotivo(`Validade abaixo do mínimo exigido. Lote ${lote || "—"}, validade ${validade || "—"}. Necessita aprovação comercial para faturar.`);
      setDivProdBipado(null);
      setDivOpen(true);
      return;
    }
    setDivQtd(qtdSep || String(itemAtual.qtdPedida));
    const bipado = validacao?.outroProduto;
    // marca diferente da solicitada (EAN alternativo do mesmo item ou EAN de outro produto)
    const marcaDiferente = validacao?.flags?.marcaOk === false || bipado?.alternativo === true;
    setDivMotivo(marcaDiferente
      ? `Marca bipada diferente da solicitada (${(itemAtual as any).marca ?? "—"}). EAN bipado: ${ean}.`
      : "Produto original sem estoque");
    setDivCodSubst(bipado?.CODPROD ? String(bipado.CODPROD) : "");
    setDivProdBipado(bipado ? { codprod: bipado.CODPROD, nome: bipado.DESCRPROD, ean, marca: bipado.MARCA } : null);
    setDivTipo("Marca homologada");
    setDivNecessidadeCli("Informar");
    setDivOpen(true);
  };
  const confirmarDivergencia = () => {
    if (!itemAtual) return;
    const codSubst = Number(divCodSubst);
    if (!codSubst || Number.isNaN(codSubst)) {
      toast.error("Informe um código de produto substituto válido.");
      return;
    }
    if (!divMotivo.trim()) {
      toast.error("Motivo é obrigatório.");
      return;
    }
    registrarDivergencia.mutate({
      nunota, sequencia: itemAtual.id,
      codProdSubst: codSubst,
      qtdSubst: Number(divQtd) || itemAtual.qtdPedida,
      tipoEquiv: divTipo === "Proporção/Porcionamento" ? "PROPORCIONAL" : "EXATA",
      motivo: divMotivo.trim(),
      homologada: !/n[ãa]o homologada/i.test(divTipo),
      necessidadeCliente: divNecessidadeCli,
      tipoDivergencia: divTipo,
      eanBipado: divProdBipado?.ean || ean || undefined,
    } as any);
  };
  const abrirDialogFalta = () => {
    if (!itemAtual) return;
    setFaltaQtd(qtdFalt || String(itemAtual.qtdPedida));
    setFaltaObs("");
    setFaltaCrit("ALTA");
    setFaltaOpen(true);
  };
  const confirmarFalta = () => {
    if (!itemAtual) return;
    const q = Number(faltaQtd);
    if (!q || Number.isNaN(q) || q <= 0) {
      toast.error("Quantidade faltante inválida.");
      return;
    }
    registrarFalta.mutate({
      nunota, sequencia: itemAtual.id,
      qtdFaltante: q,
      tipo: q >= itemAtual.qtdPedida ? "total" : "parcial",
      criticidade: faltaCrit,
      observacao: faltaObs,
    } as any);
  };

  const { data: saldo } = useFetch<{ disponivel: number; lote: string; dtVal: string }[]>(
    `/bipagem/saldo/${itemAtual?.codprod ?? 0}`,
  );
  const saldoDisponivel = saldo?.reduce((s, r) => s + (r.disponivel || 0), 0) ?? 0;

  // BS-07/BS-09: o botão único "Confirmar" decide a tratativa conforme a validação.
  const qtdPedidaAtual = itemAtual?.qtdPedida ?? 0;
  // AH-02/AH-03: campo vazio => NaN (não assume mais a qtd pedida automaticamente).
  const qtdSepNum = qtdSep.trim() === "" ? NaN : Number(qtdSep);
  // RN-04 / AH-05: quantidade faltante calculada automaticamente (pedida - separada), nunca negativa.
  const qtdFaltanteCalc = Number.isNaN(qtdSepNum) ? 0 : Math.max(0, qtdPedidaAtual - qtdSepNum);
  const eanValidado = !!validacao;   // AH-01: exige bipagem/validação antes de confirmar
  const eanOk = !!validacao && validacao.ok;
  const eanDivergente = !!validacao && !validacao.ok &&
    (validacao.flags?.eanOk === false || validacao.flags?.equivalenciaOk === false || !!validacao.outroProduto);
  // Item 3: único problema é a validade abaixo do mínimo (EAN/lote ok, não vencida) →
  // encaminhar para Divergências/Trocas em vez de bloquear.
  const validadeInsuficiente = !!validacao && !validacao.ok &&
    validacao.flags?.eanOk === true && validacao.flags?.loteOk === true &&
    validacao.flags?.validadeOk === true && validacao.flags?.shelfLifeOk === false;
  // BS-2.5: enquanto nada foi bipado/informado, o Confirmar age como "registrar falta" sem trava.
  const nadaInformado = !validacao && !ean.trim() && (qtdSep.trim() === "" || Number(qtdSep) === 0);
  const situacao: "conforme" | "divergencia" | "falta" =
    nadaInformado ? "falta"
    : (eanDivergente || validadeInsuficiente) ? "divergencia"
    : (!Number.isNaN(qtdSepNum) && qtdSepNum > 0 && qtdSepNum < qtdPedidaAtual ? "falta" : "conforme");
  // BS-2.4: item com tratativa em aberto fica travado para nova ação (até estorno).
  const tratativaAtual = (itemAtual as any)?.tratativa as string | null;
  const tratativaBloqueia = !!tratativaAtual && TRATATIVA_BLOQUEIA.has(tratativaAtual);
  const fdAtual = (itemAtual as any)?.fluxoDistinto as {
    nufluxodist: number; codProdNF: number; descNF: string; eanNF: string; marcaNF?: string;
    codProdFisico: number; descFisico: string; eanFisico: string; marcaFisico?: string;
    entradaOk: boolean; saidaOk: boolean;
  } | undefined;
  // Item 5: valida o EAN do item FÍSICO (codprod override) ao bipar na remessa de saída.
  const handleBiparSai = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && rSai.ean && fdAtual && itemAtual?.id) {
      validarEanSai.mutate({
        nunota, sequencia: itemAtual.id, ean: rSai.ean,
        lote: rSai.lote, validade: rSai.validade, codprod: fdAtual.codProdFisico,
      });
    }
  };
  const onConfirmar = () => {
    if (!itemAtual) return;
    if (nadaInformado) {
      // BS-2.5: sem nada bipado/estoque — registrar falta direto (qtd pedida), sem trava.
      setFaltaQtd(String(qtdPedidaAtual)); setFaltaObs(""); setFaltaCrit("ALTA"); setFaltaOpen(true);
      return;
    }
    // AH-01: divergência só é detectada se o EAN foi bipado/validado.
    if (situacao === "divergencia") { abrirDialogDivergencia(); return; }
    // AH-01: bloqueia confirmar sem ter validado o EAN.
    if (!eanValidado) { toast.error("Bipe e valide o EAN antes de confirmar."); return; }
    if (!eanOk) { toast.error("Resolva os erros de validação antes de confirmar."); return; }
    // AH-02/AH-03: quantidade obrigatória e maior que zero.
    if (Number.isNaN(qtdSepNum)) { toast.error("Informe a quantidade separada."); return; }
    if (qtdSepNum <= 0) { toast.error("A quantidade separada deve ser maior que zero."); return; }
    // AH-04 / RN-09: excesso => alerta e permite seguir.
    if (qtdSepNum > qtdPedidaAtual) {
      toast.warning(`Quantidade separada (${qtdSepNum}) maior que a pedida (${qtdPedidaAtual}). Confira a contagem.`);
    }
    if (situacao === "falta") {
      setFaltaQtd(String(qtdFaltanteCalc || 1)); // RN-04: calculada automaticamente
      setFaltaObs(""); setFaltaCrit("ALTA"); setFaltaOpen(true);
      return;
    }
    handleConfirmar();
  };

  return (
    <div className="space-y-5">
      {/* Pedido header */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground">
                  {pedido?.NUNNOTA ?? `Pedido ${nunota}`}
                </h1>
                <StatusBadge
                  status={(pedido as any)?.statusPedido ?? "EM_SEPARACAO"}
                  size="md"
                />
                {(pedido as any)?.criticidade && (
                  <span className={cn(
                    "text-[11px] px-2 py-0.5 rounded-full border flex items-center gap-1",
                    (pedido as any).criticidade === "critica" ? "bg-red-100 text-red-700 border-red-200"
                      : (pedido as any).criticidade === "alta" ? "bg-amber-100 text-amber-700 border-amber-200"
                      : (pedido as any).criticidade === "media" ? "bg-sky-100 text-sky-700 border-sky-200"
                      : "bg-slate-100 text-slate-600 border-slate-200",
                  )}>
                    <Gauge className="w-3 h-3" /> {(pedido as any).criticidade}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {pedido?.cliente ?? "—"}
                {localParam && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Local: {localParam}
                  </span>
                )}
              </p>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Ship className="w-4 h-4" />
                <span>{pedido?.embarcacao ?? "—"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{pedido?.horarioCarregamento ? `${pedido.horarioCarregamento}h` : "—"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <User className="w-4 h-4" />
                <span>{pedido?.separador ?? pedido?.vendedor ?? "—"}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Progresso</p>
              <p className="text-sm font-semibold tabular-nums">
                {itensSeparados} de {itens.length} itens
              </p>
            </div>
            <div className="w-32">
              <Progress value={progresso} className="h-2" />
            </div>
            <Button
              variant="ghost" size="sm"
              className="gap-1.5 text-red-600 hover:bg-red-50"
              disabled={estornarTudo.loading}
              onClick={() => {
                if (confirm("Estornar a separação COMPLETA deste pedido? Isso limpa divergências, faltas e progresso.") &&
                    confirm("Confirmar novamente: esta ação não pode ser desfeita."))
                  estornarTudo.mutate({ _n: nunota });
              }}
            >
              <Undo2 className="w-4 h-4" /> Estornar Separação Completa
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Lista de itens do pedido — coluna esquerda */}
        <div className="lg:col-span-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Itens do Pedido
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {itens.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setItemAtualId(item.id)}
                    className={cn(
                      "w-full px-4 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer",
                      itemAtual && item.id === itemAtual.id
                        ? "bg-primary/5 border-l-2 border-l-primary"
                        : "hover:bg-accent/50 border-l-2 border-l-transparent",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">{item.codigo}</span>
                        <StatusBadge status={item.status} />
                        {(item as any).temFalta && !(item as any).tratativa && (
                          <span className="text-[10px] px-1.5 py-0 rounded-full bg-red-100 text-red-700 border border-red-200">FALTA</span>
                        )}
                        {(item as any).tratativa && TRATATIVA_INFO[(item as any).tratativa] && (
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border", TRATATIVA_INFO[(item as any).tratativa].cls)}>
                            {TRATATIVA_INFO[(item as any).tratativa].label}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground mt-0.5 truncate">{item.descricao}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(item as any).marca ? `${(item as any).marca} · ` : ""}{item.qtdSeparada}/{item.qtdPedida} un
                      </p>
                    </div>
                    {itemAtual && item.id === itemAtual.id && (
                      <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Painel de bipagem — coluna direita */}
        <div className="lg:col-span-8 space-y-5">
          {/* Item selecionado */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ScanBarcode className="w-4 h-4 text-primary" />
                  Bipagem do Item
                </CardTitle>
                <Badge variant="outline" className="text-xs font-mono">
                  Item {indiceAtual} de {itens.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {fdAtual ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                    <p className="text-sm font-semibold text-violet-900 flex items-center gap-2">
                      <ArrowLeftRight className="w-4 h-4" /> Item aprovado em fluxo distinto
                    </p>
                    <p className="text-xs text-violet-700 mt-1">
                      Separe as duas remessas: o item do pedido/NF (remessa de entrada) e o item físico enviado (remessa de saída).
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={cn("rounded-lg border p-4 space-y-3", fdAtual.entradaOk ? "border-emerald-300 bg-emerald-50/40" : "border-border")}>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Item do pedido / NF — remessa de entrada</p>
                        {fdAtual.entradaOk && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">Registrada</Badge>}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{fdAtual.descNF}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono">cód. {fdAtual.codProdNF}</span> · Marca: <span className="font-medium text-foreground">{fdAtual.marcaNF ?? "—"}</span>
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Item da NF do cliente — não será enviado fisicamente. Sem bipagem/validação; quantidade fixada na do pedido.
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <Input placeholder="Lote" className="h-9 text-sm" value={rEnt.lote} onChange={(e) => setREnt({ ...rEnt, lote: e.target.value })} />
                        <Input type="date" className="h-9 text-sm" value={rEnt.validade} onChange={(e) => setREnt({ ...rEnt, validade: e.target.value })} />
                        <Input type="number" readOnly tabIndex={-1} title="Quantidade do pedido (travada)"
                          className="h-9 text-sm bg-muted/50 cursor-not-allowed"
                          value={itemAtual?.qtdPedida ?? ""} />
                      </div>
                      <Button size="sm" className="w-full gap-1.5" disabled={registrarRemessa.loading} onClick={() => enviarRemessa("ENTRADA")}>
                        <Check className="w-4 h-4" /> {fdAtual.entradaOk ? "Atualizar entrada" : "Registrar remessa de entrada"}
                      </Button>
                    </div>
                    <div className={cn("rounded-lg border p-4 space-y-3", fdAtual.saidaOk ? "border-emerald-300 bg-emerald-50/40" : "border-sky-200")}>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Item físico enviado — remessa de saída</p>
                        {fdAtual.saidaOk && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">Registrada</Badge>}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{fdAtual.descFisico}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono">cód. {fdAtual.codProdFisico}</span> · Marca: <span className="font-medium text-foreground">{fdAtual.marcaFisico ?? "—"}</span>
                        </p>
                      </div>
                      {/* Item 5: o item físico mantém as validações e preenchimentos padrão. */}
                      <Input
                        placeholder="Bipe / EAN e pressione Enter"
                        className="h-9 text-sm font-mono border-2 border-sky-300 focus:border-sky-500"
                        value={rSai.ean}
                        onChange={(e) => { setRSai({ ...rSai, ean: e.target.value }); setSaiValidacao(null); }}
                        onKeyDown={handleBiparSai}
                      />
                      {saiValidacao && (
                        <div className={cn(
                          "text-xs px-3 py-1.5 rounded-md border",
                          saiValidacao.ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200",
                        )}>
                          {saiValidacao.ok
                            ? `✓ EAN válido (match: ${saiValidacao.match})${saiValidacao.fatorConv && saiValidacao.fatorConv !== 1 ? ` — fator ${saiValidacao.fatorConv}x` : ""}`
                            : `✗ ${saiValidacao.motivo}${saiValidacao.outroProduto ? ` — pertence a ${saiValidacao.outroProduto.DESCRPROD}` : ""}`}
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        <Input placeholder="Lote" className="h-9 text-sm" value={rSai.lote} onChange={(e) => setRSai({ ...rSai, lote: e.target.value })} />
                        <Input type="date" className="h-9 text-sm" value={rSai.validade} onChange={(e) => setRSai({ ...rSai, validade: e.target.value })} />
                        <Input type="number" placeholder="Qtd" className="h-9 text-sm" value={rSai.qtd} onChange={(e) => setRSai({ ...rSai, qtd: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-4 gap-2 border-t border-dashed border-border pt-2">
                        {[
                          { label: "EAN", flag: saiValidacao?.flags?.eanOk },
                          { label: "Lote", flag: saiValidacao?.flags?.loteOk },
                          { label: "Validade", flag: saiValidacao?.flags?.validadeOk && saiValidacao?.flags?.shelfLifeOk },
                          { label: "Equiv.", flag: saiValidacao?.flags?.equivalenciaOk },
                        ].map((v) => {
                          const color = v.flag === undefined ? "bg-muted text-muted-foreground" : v.flag ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700";
                          const Icon = v.flag === false ? XCircle : Check;
                          return (
                            <div key={v.label} className="flex items-center gap-1 text-[11px]">
                              <span className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0", color)}>
                                <Icon className="w-2.5 h-2.5" />
                              </span>
                              <span className={v.flag === undefined ? "text-muted-foreground" : v.flag ? "text-emerald-700" : "text-red-700"}>{v.label}</span>
                            </div>
                          );
                        })}
                      </div>
                      <Button size="sm" className="w-full gap-1.5 bg-sky-600 hover:bg-sky-700" disabled={registrarRemessa.loading} onClick={() => enviarRemessa("SAIDA")}>
                        <Check className="w-4 h-4" /> {fdAtual.saidaOk ? "Atualizar saída" : "Registrar remessa de saída"}
                      </Button>
                    </div>
                  </div>
                  {fdAtual.entradaOk && fdAtual.saidaOk && (
                    <div className="text-xs px-3 py-2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-2">
                      <Check className="w-4 h-4" /> Ambas as remessas registradas — item do pedido conferido.
                    </div>
                  )}
                </div>
              ) : (<>
              {/* Info do item esperado */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Item do Pedido</p>
                    <p className="text-base font-semibold text-foreground mt-1">{itemAtual?.descricao ?? "—"}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5" />
                        {itemAtual?.codigo ?? "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" />
                        Marca: {(itemAtual as any)?.marca ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Qtd. Pedida</p>
                    <p className="text-2xl font-bold text-foreground tabular-nums">{itemAtual?.qtdPedida ?? 0}</p>
                    <p className="text-xs text-muted-foreground">unidades</p>
                  </div>
                </div>
              </div>

              {/* Campo de bipagem */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                    <ScanBarcode className="w-4 h-4 text-primary" />
                    Leitura do EAN (Bipagem)
                  </Label>
                  <div className="relative">
                    <Input
                      placeholder="Bipe ou digite o código EAN e pressione Enter..."
                      className="h-12 text-lg font-mono pl-4 pr-12 border-2 border-primary/30 focus:border-primary"
                      value={ean}
                      onChange={(e) => setEan(e.target.value)}
                      onKeyDown={handleBipar}
                      autoFocus
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <ScanBarcode className="w-5 h-5 text-muted-foreground animate-pulse" />
                    </div>
                  </div>
                  {validacao && (
                    <div
                      className={`mt-2 text-xs px-3 py-1.5 rounded-md ${
                        validacao.ok
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {validacao.ok
                        ? `✓ EAN válido (match: ${validacao.match})${validacao.fatorConv && validacao.fatorConv !== 1 ? ` — fator ${validacao.fatorConv}x` : ""}`
                        : `✗ ${validacao.motivo}${validacao.outroProduto ? ` — pertence a ${validacao.outroProduto.DESCRPROD}` : ""}`}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    O sistema validará EAN, equivalência e shelf life automaticamente
                  </p>
                </div>

                {/* Grid de campos */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                      <Layers className="w-3 h-3" />
                      Lote
                      <button type="button" title="Adicionar outro lote/validade"
                        onClick={() => setLotesExtra((prev) => [...prev, { lote: "", validade: "", qtd: "" }])}
                        className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary hover:bg-primary/20">
                        <Plus className="w-3 h-3" />
                      </button>
                    </Label>
                    <Input
                      placeholder="Nº do lote"
                      className="h-9 text-sm"
                      value={lote}
                      onChange={(e) => setLote(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                      <Calendar className="w-3 h-3" />
                      Validade
                    </Label>
                    <Input
                      type="date"
                      className="h-9 text-sm"
                      value={validade}
                      onChange={(e) => setValidade(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                      <Package className="w-3 h-3" />
                      Qtd. Separada
                    </Label>
                    <Input
                      type="number"
                      placeholder="0"
                      className="h-9 text-sm"
                      value={qtdSep}
                      onChange={(e) => setQtdSep(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                      <AlertTriangle className="w-3 h-3" />
                      Qtd. Faltante
                    </Label>
                    <Input
                      type="number"
                      readOnly
                      tabIndex={-1}
                      className="h-9 text-sm bg-muted/50 cursor-not-allowed"
                      value={qtdFaltanteCalc}
                    />
                  </div>
                </div>

                {lotesExtra.map((l, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-muted/30 rounded-lg p-2">
                    <div className="col-span-4">
                      <Label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Layers className="w-3 h-3" /> Lote {idx + 2}</Label>
                      <Input placeholder="Nº do lote" className="h-9 text-sm" value={l.lote}
                        onChange={(e) => setLotesExtra((p) => p.map((x, i) => i === idx ? { ...x, lote: e.target.value } : x))} />
                    </div>
                    <div className="col-span-4">
                      <Label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Calendar className="w-3 h-3" /> Validade</Label>
                      <Input type="date" className="h-9 text-sm" value={l.validade}
                        onChange={(e) => setLotesExtra((p) => p.map((x, i) => i === idx ? { ...x, validade: e.target.value } : x))} />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1"><Package className="w-3 h-3" /> Qtd</Label>
                      <Input type="number" placeholder="0" className="h-9 text-sm" value={l.qtd}
                        onChange={(e) => setLotesExtra((p) => p.map((x, i) => i === idx ? { ...x, qtd: e.target.value } : x))} />
                    </div>
                    <div className="col-span-1 flex justify-center pb-1">
                      <button type="button" title="Remover lote"
                        onClick={() => setLotesExtra((p) => p.filter((_, i) => i !== idx))}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-red-600 hover:bg-red-50">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Saldo reservado */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <Info className="w-4 h-4" />
                    <span>Saldo disponível no estoque</span>
                  </div>
                  <span className="text-sm font-bold text-blue-700 tabular-nums">{saldoDisponivel} un</span>
                </div>
              </div>

              {/* Validação visual — reflete flags do backend */}
              <div className="border border-dashed border-border rounded-lg p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Resultado da Validação</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "EAN", flag: validacao?.flags?.eanOk },
                    { label: "Lote", flag: validacao?.flags?.loteOk },
                    { label: "Validade", flag: validacao?.flags?.validadeOk && validacao?.flags?.shelfLifeOk },
                    { label: "Equivalência", flag: validacao?.flags?.equivalenciaOk },
                  ].map((v) => {
                    const color =
                      v.flag === undefined
                        ? "bg-muted text-muted-foreground"
                        : v.flag
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700";
                    const Icon = v.flag === false ? XCircle : Check;
                    return (
                      <div key={v.label} className="flex items-center gap-2 text-sm">
                        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", color)}>
                          <Icon className="w-3 h-3" />
                        </div>
                        <span
                          className={
                            v.flag === undefined
                              ? "text-muted-foreground"
                              : v.flag
                              ? "text-emerald-700"
                              : "text-red-700"
                          }
                        >
                          {v.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {validacao?.motivo && (
                  <p className="text-xs text-red-600 mt-2">⚠ {validacao.motivo}</p>
                )}
              </div>

              {/* BS-07/BS-09: botão ÚNICO de confirmação — trata conforme / divergência / falta */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  className={cn(
                    "gap-2 flex-1 h-11",
                    situacao === "divergencia" ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : situacao === "falta" ? "bg-red-600 hover:bg-red-700 text-white" : "",
                  )}
                  disabled={conferir.loading || !itemAtual || itemAtual?.status === "conforme" || tratativaBloqueia}
                  onClick={onConfirmar}
                >
                  {situacao === "divergencia" ? <ArrowLeftRight className="w-4 h-4" />
                    : situacao === "falta" ? <XCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  {situacao === "divergencia" ? "Confirmar — tratar Divergência"
                    : situacao === "falta" ? "Confirmar — registrar Falta"
                    : "Confirmar Item"}
                </Button>
                {itemAtual?.status === "conforme" && (
                  <Button
                    variant="outline"
                    className="gap-2 h-11 border-slate-300 text-slate-700 hover:bg-slate-50"
                    disabled={estornarItem.loading}
                    onClick={() => estornarItem.mutate({ nunota, sequencia: itemAtual.id } as any)}
                  >
                    <Undo2 className="w-4 h-4" />
                    Estornar Item
                  </Button>
                )}
              </div>
              {tratativaBloqueia && tratativaAtual && TRATATIVA_INFO[tratativaAtual] && (
                <div className="text-xs px-3 py-2 rounded-md bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  Item em tratativa ({TRATATIVA_INFO[tratativaAtual].label}). Nova ação bloqueada até o estorno da tratativa.
                </div>
              )}
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                O botão Confirmar trata automaticamente: item conforme, divergência (EAN/equivalência) ou falta (qtd menor que a pedida).
              </p>
              </>)}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog — Divergência */}
      <Dialog open={divOpen} onOpenChange={setDivOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-amber-600" />
              Registrar Divergência
            </DialogTitle>
            <DialogDescription>
              Substitua {itemAtual?.descricao ?? "o item"} por um produto equivalente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Item 1: marca do item do pedido visível no modal de divergência. */}
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Item do pedido</p>
              <p className="text-sm font-semibold text-foreground">{itemAtual?.descricao ?? "—"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-mono">{itemAtual?.codigo ?? "—"}</span>
                {" · "}Marca: <span className="font-medium text-foreground">{(itemAtual as any)?.marca ?? "—"}</span>
              </p>
            </div>
            {divProdBipado && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-[10px] font-medium text-emerald-700 uppercase tracking-wide">Produto bipado (EAN {divProdBipado.ean})</p>
                <p className="text-sm font-semibold text-emerald-900">{divProdBipado.nome}</p>
                <p className="text-xs text-emerald-700 font-mono mt-0.5">cód. {divProdBipado.codprod} · Marca: {divProdBipado.marca ?? "—"}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Código produto substituto</Label>
                <Input
                  value={divCodSubst}
                  onChange={(e) => setDivCodSubst(e.target.value)}
                  placeholder="Ex.: 1301"
                  inputMode="numeric"
                  className="h-9"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Preenchido automaticamente pelo EAN bipado.</p>
              </div>
              <div>
                <Label className="text-xs">Quantidade equivalente</Label>
                <Input
                  type="number"
                  value={divQtd}
                  onChange={(e) => setDivQtd(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Tipo de divergência</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={divTipo}
                onChange={(e) => setDivTipo(e.target.value)}
              >
                <option>Marca homologada</option>
                <option>Marca não homologada</option>
                <option>Proporção/Porcionamento</option>
                <option>Gramatura</option>
                <option>Validade abaixo do mínimo</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Motivo *</Label>
              <Textarea
                value={divMotivo}
                onChange={(e) => setDivMotivo(e.target.value)}
                placeholder="Descreva o motivo da divergência..."
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDivOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarDivergencia} disabled={registrarDivergencia.loading}>
              Registrar Divergência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Falta */}
      <Dialog open={faltaOpen} onOpenChange={setFaltaOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Registrar Falta
            </DialogTitle>
            <DialogDescription>
              Item: {itemAtual?.descricao ?? "—"} (qtd pedida: {itemAtual?.qtdPedida ?? 0})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Quantidade faltante (automática)</Label>
                <Input
                  type="number"
                  value={faltaQtd}
                  readOnly
                  className="h-9 bg-muted cursor-not-allowed"
                />
              </div>
              <div>
                <Label className="text-xs">Criticidade</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={faltaCrit}
                  onChange={(e) => setFaltaCrit(e.target.value as any)}
                >
                  <option value="CRITICA">Crítica</option>
                  <option value="ALTA">Alta</option>
                  <option value="MEDIA">Média</option>
                  <option value="BAIXA">Baixa</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Observação</Label>
              <Textarea
                value={faltaObs}
                onChange={(e) => setFaltaObs(e.target.value)}
                placeholder="Observação opcional..."
                className="min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFaltaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarFalta} disabled={registrarFalta.loading} className="bg-red-600 hover:bg-red-700">
              Registrar Falta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
