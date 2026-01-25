import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

// Loading component minimalista
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50">
    <Loader2 className="h-8 w-8 animate-spin text-[#02B381]" />
  </div>
);

// Lazy load de páginas para máxima velocidad
const Home = lazy(() => import("./pages/Home"));
const Bienvenida = lazy(() => import("./pages/Bienvenida"));
const Bitacora = lazy(() => import("./pages/Bitacora"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Estadisticas = lazy(() => import("./pages/Estadisticas"));
const Seguimiento = lazy(() => import("./pages/Seguimiento"));
const KPIs = lazy(() => import("./pages/KPIs"));
const GenerarQR = lazy(() => import("./pages/GenerarQR"));
const Configuracion = lazy(() => import("./pages/Configuracion"));
const Metas = lazy(() => import("./pages/Metas"));
const OfflineIndicator = lazy(() => import("./components/OfflineIndicator"));

// Proyectos
const Proyectos = lazy(() => import("./pages/Proyectos"));

// Catálogos
const Empresas = lazy(() => import("./pages/catalogos/Empresas"));
const EmpresaDetalle = lazy(() => import("./pages/catalogos/EmpresaDetalle"));
const Unidades = lazy(() => import("./pages/catalogos/Unidades"));
const Especialidades = lazy(() => import("./pages/catalogos/Especialidades"));
const Atributos = lazy(() => import("./pages/catalogos/Atributos"));
const Defectos = lazy(() => import("./pages/Defectos"));

// Reportes
const ReporteFotografico = lazy(() => import("./pages/ReporteFotografico"));

// Items
const ItemsList = lazy(() => import("./pages/items/ItemsList"));
const NuevoItem = lazy(() => import("./pages/items/NuevoItem"));
const ItemDetail = lazy(() => import("./pages/items/ItemDetail"));

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Dashboard y Bienvenida */}
        <Route path="/" component={Bienvenida} />
        <Route path="/dashboard" component={Home} />
        <Route path="/bienvenida" component={Bienvenida} />
        
        {/* Proyectos */}
        <Route path="/proyectos" component={Proyectos} />
        
        {/* Items */}
        <Route path="/items" component={ItemsList} />
        <Route path="/nuevo-item" component={NuevoItem} />
        <Route path="/items/nuevo" component={NuevoItem} />
        <Route path="/items/revision" component={ItemsList} />
        <Route path="/items/aprobacion" component={ItemsList} />
        <Route path="/items/:id" component={ItemDetail} />
        
        {/* Catálogos */}
        <Route path="/empresas" component={Empresas} />
        <Route path="/empresas/:id" component={EmpresaDetalle} />
        <Route path="/unidades" component={Unidades} />
        <Route path="/especialidades" component={Especialidades} />
        <Route path="/atributos" component={Atributos} />
        <Route path="/catalogos/empresas" component={Empresas} />
        <Route path="/catalogos/unidades" component={Unidades} />
        <Route path="/catalogos/especialidades" component={Especialidades} />
        <Route path="/catalogos/atributos" component={Atributos} />
        <Route path="/defectos" component={Defectos} />
        <Route path="/catalogos/defectos" component={Defectos} />
        
        {/* Reportes */}
        <Route path="/reportes" component={ReporteFotografico} />
        <Route path="/reporte-fotografico" component={ReporteFotografico} />
        
        {/* Usuarios y Bitácora */}
        <Route path="/usuarios" component={Usuarios} />
        <Route path="/bitacora" component={Bitacora} />
        
        {/* Estadísticas */}
        <Route path="/estadisticas" component={Estadisticas} />
        <Route path="/kpis" component={KPIs} />
        
        {/* Seguimiento público (QR) */}
        <Route path="/seguimiento/:codigo" component={Seguimiento} />
        <Route path="/generar-qr" component={GenerarQR} />
        
        {/* Configuración y Metas */}
        <Route path="/configuracion" component={Configuracion} />
        <Route path="/metas" component={Metas} />
        
        {/* 404 */}
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={null}>
            <OfflineIndicator />
          </Suspense>
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
