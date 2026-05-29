/**
 * AppLayout — sidebar persistente + topo com usuário logado e logout.
 */
import { cn } from "@/lib/utils";
import {
  Package, ScanBarcode, ArrowLeftRight, AlertTriangle, ShieldCheck,
  FileCheck, History, ChevronLeft, ChevronRight, Users, LogOut, CalendarClock, ShoppingCart, Activity, ClipboardCheck,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { path: "/", label: "Pedidos Liberados", icon: Package },
  { path: "/bipe", label: "BIPE Separação", icon: ScanBarcode },
  { path: "/divergencias", label: "Divergências e Trocas", icon: ArrowLeftRight },
  { path: "/faltas", label: "Faltas e Apanho", icon: AlertTriangle },
  { path: "/apanho-mobile", label: "Apanho (campo)", icon: ShoppingCart },
  { path: "/apanho-acompanhamento", label: "Apanho — Acompanhamento", icon: Activity },
  { path: "/apanho-conferencia", label: "Conferência de Apanho", icon: ClipboardCheck },
  { path: "/fluxo-distinto", label: "Fluxo Distinto", icon: ShieldCheck },
  { path: "/pre-faturamento", label: "Pré-Faturamento", icon: FileCheck },
  { path: "/auditoria", label: "Auditoria", icon: History },
];

const PERFIL_LABEL: Record<string, string> = {
  ADMINISTRADOR: "Administrador", GERENCIA: "Gerência",
  APROVADOR: "Aprovador", SEPARADOR: "Separador",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();

  const items = [...navItems];
  if (user && (user.perfil === "ADMINISTRADOR" || user.perfil === "GERENCIA")) {
    items.push({ path: "/validade-minima", label: "Validade Mínima", icon: CalendarClock });
    items.push({ path: "/usuarios", label: "Usuários", icon: Users });
  }
  const currentNav = items.find((i) => i.path === location) || items[0];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className={cn(
        "flex flex-col border-r border-border bg-sidebar transition-all duration-200 ease-out shrink-0",
        collapsed ? "w-[68px]" : "w-[260px]",
      )}>
        <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Package className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-foreground truncate">Troca de Itens</p>
              <p className="text-[11px] text-muted-foreground truncate">Sankhya ERP</p>
            </div>
          )}
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {items.map((item) => {
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150",
                  isActive ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}>
                  <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive && "text-primary")} />
                  {!collapsed && <span className="block truncate">{item.label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-2 shrink-0">
          <button onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!collapsed && <span>Recolher</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center px-6 shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Troca de Itens</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium text-foreground">{currentNav.label}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {user && (
              <div className="text-right leading-tight hidden sm:block">
                <p className="text-sm font-medium text-foreground">{user.nome}</p>
                <p className="text-[11px] text-muted-foreground">{PERFIL_LABEL[user.perfil] ?? user.perfil}</p>
              </div>
            )}
            <button onClick={logout} title="Sair"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
