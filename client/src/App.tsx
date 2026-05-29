import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AppLayout from "./components/AppLayout";
import PedidosLiberados from "./pages/PedidosLiberados";
import BipeSeparacao from "./pages/BipeSeparacao";
import BipeMobile from "./pages/BipeMobile";
import DivergenciasTrocas from "./pages/DivergenciasTrocas";
import FaltasApanho from "./pages/FaltasApanho";
import FluxoDistinto from "./pages/FluxoDistinto";
import PreFaturamento from "./pages/PreFaturamento";
import Auditoria from "./pages/Auditoria";

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
              <Route path="/404" component={NotFound} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
