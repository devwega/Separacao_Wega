/**
 * StatusBadge — Badges coloridos para status do sistema.
 * Suporta tanto os status legados (conforme/pendente/separacao/bloqueado)
 * quanto os 10 estados do pedido conforme spec seção 8:
 *   LANCADO → LIBERADO_SEPARACAO → EM_SEPARACAO → COM_FALTA_ANALISE
 *   → AGUARDANDO_DECISAO → APROVADO_ALTERACAO / REPROVADO / APROVADO_FLUXO_DISTINTO
 *   → LIBERADO_FATURAMENTO → FATURADO
 */
import { cn } from "@/lib/utils";

type StatusType =
  // legados — usados em telas auxiliares
  | "conforme"
  | "pendente"
  | "bloqueado"
  | "distinto"
  | "info"
  | "separacao"
  | "faturado"
  | "lancado"
  | "falta"
  // 10 status oficiais do pedido (spec seção 8)
  | "LANCADO"
  | "LIBERADO_SEPARACAO"
  | "EM_SEPARACAO"
  | "COM_FALTA_ANALISE"
  | "AGUARDANDO_DECISAO"
  | "APROVADO_ALTERACAO"
  | "REPROVADO"
  | "APROVADO_FLUXO_DISTINTO"
  | "LIBERADO_FATURAMENTO"
  | "FATURADO";

const statusConfig: Record<StatusType, { label: string; className: string; dot: string }> = {
  // Legados (mantém compat)
  conforme: { label: "Conforme", className: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  pendente: { label: "Pendente", className: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  bloqueado: { label: "Bloqueado", className: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  distinto: { label: "Fluxo Distinto", className: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  info: { label: "Informativo", className: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  separacao: { label: "Em Separação", className: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500" },
  faturado: { label: "Faturado", className: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  lancado: { label: "Lançado", className: "bg-stone-100 text-stone-600 border-stone-200", dot: "bg-stone-400" },
  falta: { label: "Falta", className: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },

  // 10 status do pedido — paleta ordenada pelo ciclo de vida
  LANCADO:                 { label: "Lançado",                   className: "bg-stone-100 text-stone-700 border-stone-300",      dot: "bg-stone-400" },
  LIBERADO_SEPARACAO:      { label: "Liberado p/ Separação",     className: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-500" },
  EM_SEPARACAO:            { label: "Em Separação",              className: "bg-sky-50 text-sky-700 border-sky-200",             dot: "bg-sky-500" },
  COM_FALTA_ANALISE:       { label: "Com Falta em Análise",      className: "bg-orange-50 text-orange-700 border-orange-200",    dot: "bg-orange-500" },
  AGUARDANDO_DECISAO:      { label: "Aguardando Decisão",        className: "bg-yellow-50 text-yellow-800 border-yellow-300",    dot: "bg-yellow-500" },
  APROVADO_ALTERACAO:      { label: "Aprovado c/ Alteração",     className: "bg-teal-50 text-teal-700 border-teal-200",          dot: "bg-teal-500" },
  REPROVADO:               { label: "Reprovado",                 className: "bg-red-50 text-red-700 border-red-200",             dot: "bg-red-500" },
  APROVADO_FLUXO_DISTINTO: { label: "Aprovado em Fluxo Distinto",className: "bg-purple-50 text-purple-700 border-purple-200",    dot: "bg-purple-500" },
  LIBERADO_FATURAMENTO:    { label: "Liberado p/ Faturamento",   className: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  FATURADO:                { label: "Faturado",                  className: "bg-slate-100 text-slate-700 border-slate-300",      dot: "bg-slate-500" },
};

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, label, className, size = "sm" }: StatusBadgeProps) {
  // Fallback seguro: status desconhecido → cinza
  const config = (statusConfig as any)[status] ?? {
    label: String(status),
    className: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground/40",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium border rounded-full whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        config.className,
        className
      )}
    >
      <span
        className={cn(
          "rounded-full mr-1.5 shrink-0",
          size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2",
          config.dot,
        )}
      />
      {label || config.label}
    </span>
  );
}

export type { StatusType };
