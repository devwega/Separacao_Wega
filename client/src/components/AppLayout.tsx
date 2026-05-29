/**
 * AppLayout — Clean Enterprise Design
 * Sidebar persistente à esquerda com navegação entre as 6 telas do sistema.
 * Breadcrumb contextual no topo da área de conteúdo.
 */
import { cn } from "@/lib/utils";
import {
  Package,
  ScanBarcode,
  ArrowLeftRight,
  AlertTriangle,
  ShieldCheck,
  FileCheck,
  History,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";

const navItems = [
  {
    path: "/",
    label: "Pedidos Liberados",
    shortLabel: "Pedidos",
    icon: Package,
    description: "Painel de separação",
  },
  {
    path: "/bipe",
    label: "BIPE Separação",
    shortLabel: "BIPE",
    icon: ScanBarcode,
    description: "Separação item a item",
  },
  {
    path: "/divergencias",
    label: "Divergências e Trocas",
    shortLabel: "Trocas",
    icon: ArrowLeftRight,
    description: "Decisão comercial",
  },
  {
    path: "/faltas",
    label: "Faltas e Apanho",
    shortLabel: "Faltas",
    icon: AlertTriangle,
    description: "Tratamento de faltas",
  },
  {
    path: "/fluxo-distinto",
    label: "Fluxo Distinto",
    shortLabel: "Distinto",
    icon: ShieldCheck,
    description: "Aprovação gerencial",
  },
  {
    path: "/pre-faturamento",
    label: "Pré-Faturamento",
    shortLabel: "Faturar",
    icon: FileCheck,
    description: "Conferência final",
  },
  {
    path: "/auditoria",
    label: "Auditoria",
    shortLabel: "Auditoria",
    icon: History,
    description: "Trilha do pedido",
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const currentNav = navItems.find((item) => item.path === location) || navItems[0];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-sidebar transition-all duration-200 ease-out shrink-0",
          collapsed ? "w-[68px]" : "w-[260px]"
        )}
      >
        {/* Logo area */}
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

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive && "text-primary")} />
                  {!collapsed && (
                    <div className="overflow-hidden">
                      <span className="block truncate">{item.label}</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-border p-2 shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!collapsed && <span>Recolher</span>}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar with breadcrumb */}
        <header className="h-16 border-b border-border bg-card flex items-center px-6 shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Troca de Itens</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium text-foreground">{currentNav.label}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
              Protótipo de Layout
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
