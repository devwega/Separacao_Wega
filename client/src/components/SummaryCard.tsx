/**
 * SummaryCard — Cards de resumo/KPI no topo de cada tela
 * Mostra um ícone, título, valor principal e variação opcional.
 */
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface SummaryCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  iconColor?: string;
  iconBg?: string;
  className?: string;
}

export default function SummaryCard({
  icon: Icon,
  title,
  value,
  subtitle,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  className,
}: SummaryCardProps) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg p-4 flex items-start gap-4 transition-shadow hover:shadow-sm",
        className
      )}
    >
      <div className={cn("rounded-lg p-2.5 shrink-0", iconBg)}>
        <Icon className={cn("w-5 h-5", iconColor)} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5 tabular-nums">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
