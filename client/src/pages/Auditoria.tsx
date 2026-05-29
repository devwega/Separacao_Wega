/**
 * Tela 9.7 (extra) — Auditoria por pedido
 * Trilha completa: separação, divergências, faltas, fluxo distinto, faturamento.
 * Atende seção 6.6 da spec (Auditoria: usuário, data, hora, item, decisão).
 */
import { useSearch } from "wouter";
import { useFetch } from "@/hooks/use-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { History, Package, ArrowLeftRight, AlertTriangle, ShieldCheck, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Evento = { data: string; tipo: string; descricao: string; usuario?: string };

const iconConfig: Record<string, { Icon: any; className: string; bg: string }> = {
  SEPARACAO:     { Icon: Package,        className: "text-sky-600",     bg: "bg-sky-50" },
  DIVERGENCIA:   { Icon: ArrowLeftRight, className: "text-amber-600",   bg: "bg-amber-50" },
  FALTA:         { Icon: AlertTriangle,  className: "text-red-600",     bg: "bg-red-50" },
  FLUXO_DISTINTO:{ Icon: ShieldCheck,    className: "text-purple-600",  bg: "bg-purple-50" },
  FATURAMENTO:   { Icon: FileCheck,      className: "text-emerald-600", bg: "bg-emerald-50" },
};

export default function Auditoria() {
  const search = useSearch();
  const nunotaParam = new URLSearchParams(search).get("nunota");
  const nunota = nunotaParam ? Number(nunotaParam) : 190;
  const { data: lista } = useFetch<any[]>("/pre-faturamento");
  const { data: eventos, loading } = useFetch<Evento[]>(`/pedidos/${nunota}/auditoria`);
  const pedido = (lista ?? []).find((p: any) => p.nunota === nunota);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Trilha de Auditoria</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Histórico completo de eventos do pedido — separação, divergências, faltas, fluxo distinto e faturamento.
          </p>
        </div>
        <Select value={String(nunota)} onValueChange={(v) => {
          window.history.pushState({}, "", `/auditoria?nunota=${v}`);
          window.location.reload();
        }}>
          <SelectTrigger className="w-[240px] h-9 text-sm">
            <SelectValue placeholder="Selecionar pedido" />
          </SelectTrigger>
          <SelectContent>
            {(lista ?? []).map((p: any) => (
              <SelectItem key={p.nunota} value={String(p.nunota)}>
                {p.id} — {p.cliente.slice(0, 28)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            {pedido?.id ?? `Pedido ${nunota}`} — {pedido?.cliente ?? ""}
            <Badge variant="outline" className="ml-auto text-xs">
              {eventos?.length ?? 0} eventos
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!loading && (eventos?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
          )}
          <ol className="relative border-l border-border ml-3 mt-2 space-y-6">
            {(eventos ?? []).map((e, i) => {
              const cfg = iconConfig[e.tipo] ?? { Icon: History, className: "text-muted-foreground", bg: "bg-muted" };
              const Icon = cfg.Icon;
              return (
                <li key={i} className="ml-6">
                  <span className={cn("absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full", cfg.bg)}>
                    <Icon className={cn("w-3.5 h-3.5", cfg.className)} />
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <time className="text-xs font-mono text-muted-foreground">{e.data}</time>
                    <Badge variant="secondary" className="text-[10px]">{e.tipo}</Badge>
                    {e.usuario && (
                      <span className="text-xs text-muted-foreground">por <strong className="text-foreground">{e.usuario}</strong></span>
                    )}
                  </div>
                  <p className="text-sm text-foreground mt-1">{e.descricao}</p>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
