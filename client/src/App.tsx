import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import PedidosLiberados from "./pages/PedidosLiberados";
import BipeSeparacao from "./pages/BipeSeparacao";
import BipeMobile from "./pages/BipeMobile";
import DivergenciasTrocas from "./pages/DivergenciasTrocas";
import FaltasApanho from "./pages/FaltasApanho";
import FluxoDistinto from "./pages/FluxoDistinto";
import PreFaturamento from "./pages/PreFaturamento";
import Auditoria from "./pages/Auditoria";
import Usuarios from "./pages/Usuarios";
import ValidadeMinima from "./pages/ValidadeMinima";

function Router() {
  return (
    <Switch>
      {/* Rota mobile — fullscreen sem sidebar */}
      <Route path="/bipe-mobile" component={BipeMobile} />

      {/* Rotas desktop — com AppLayout e sidebar */}
      <Route>
        {() => (
          <AppLayout>
            <Switch>
              <Route path="/" component={PedidosLiberados} />
              <Route path="/bipe" component={BipeSeparacao} />
              <Route path="/divergencias" component={DivergenciasTrocas} />
              <Route path="/faltas" component={FaltasApanho} />
              <Route path="/fluxo-distinto" component={FluxoDistinto} />
              <Route path="/pre-faturamento" component={PreFaturamento} />
              <Route path="/auditoria" component={Auditoria} />
              <Route path="/usuarios" component={Usuarios} />
              <Route path="/validade-minima" component={ValidadeMinima} />
              <Route path="/404" component={NotFound} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        )}
      </Route>
    </Switch>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }
  if (!user) return <Login />;
  return <Router />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AuthProvider>
            <Gate />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
