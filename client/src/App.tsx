import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// Pages
import Home from "./pages/Home";
import Bienvenida from "./pages/Bienvenida";
import Bitacora from "./pages/Bitacora";
import Usuarios from "./pages/Usuarios";
import Estadisticas from "./pages/Estadisticas";
import Seguimiento from "./pages/Seguimiento";
import KPIs from "./pages/KPIs";
import OfflineIndicator from "./components/OfflineIndicator";

// Catálogos
import Empresas from "./pages/catalogos/Empresas";
import Unidades from "./pages/catalogos/Unidades";
import Especialidades from "./pages/catalogos/Especialidades";
import Atributos from "./pages/catalogos/Atributos";

// Items
import ItemsList from "./pages/items/ItemsList";
import NuevoItem from "./pages/items/NuevoItem";
import ItemDetail from "./pages/items/ItemDetail";

function Router() {
  return (
    <Switch>
      {/* Dashboard y Bienvenida */}
      <Route path="/" component={Bienvenida} />
      <Route path="/dashboard" component={Home} />
      <Route path="/bienvenida" component={Bienvenida} />
      
      {/* Items */}
      <Route path="/items" component={ItemsList} />
      <Route path="/nuevo-item" component={NuevoItem} />
      <Route path="/items/nuevo" component={NuevoItem} />
      <Route path="/items/revision" component={ItemsList} />
      <Route path="/items/aprobacion" component={ItemsList} />
      <Route path="/items/:id" component={ItemDetail} />
      
      {/* Catálogos */}
      <Route path="/empresas" component={Empresas} />
      <Route path="/unidades" component={Unidades} />
      <Route path="/especialidades" component={Especialidades} />
      <Route path="/atributos" component={Atributos} />
      <Route path="/catalogos/empresas" component={Empresas} />
      <Route path="/catalogos/unidades" component={Unidades} />
      <Route path="/catalogos/especialidades" component={Especialidades} />
      <Route path="/catalogos/atributos" component={Atributos} />
      
      {/* Usuarios y Bitácora */}
      <Route path="/usuarios" component={Usuarios} />
      <Route path="/bitacora" component={Bitacora} />
      
      {/* Estadísticas */}
      <Route path="/estadisticas" component={Estadisticas} />
      <Route path="/kpis" component={KPIs} />
      
      {/* Seguimiento público (QR) */}
      <Route path="/seguimiento/:codigo" component={Seguimiento} />
      
      {/* 404 */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <OfflineIndicator />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
