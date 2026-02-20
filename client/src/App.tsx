import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Router as WouterRouter } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProjectProvider } from "./contexts/ProjectContext";
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
// KPIs eliminado - duplicado con Estadísticas
const GenerarQR = lazy(() => import("./pages/GenerarQR"));
const Configuracion = lazy(() => import("./pages/Configuracion"));
const Metas = lazy(() => import("./pages/Metas"));
const DashboardResidente = lazy(() => import("./pages/DashboardResidente"));
const MisTareas = lazy(() => import("./pages/MisTareas"));
const Login = lazy(() => import("./pages/Login"));



// Proyectos
const SeleccionProyecto = lazy(() => import("./pages/SeleccionProyecto"));
const Proyectos = lazy(() => import("./pages/Proyectos"));
const NuevoProyecto = lazy(() => import("./pages/NuevoProyecto"));
const VistaPanoramica = lazy(() => import("./pages/VistaPanoramica"));
const StackingPDF = lazy(() => import("./pages/StackingPDF"));
const ImportarUnidades = lazy(() => import("./pages/ImportarUnidades"));

// Catálogos
const Empresas = lazy(() => import("./pages/catalogos/Empresas"));
const EmpresaDetalle = lazy(() => import("./pages/catalogos/EmpresaDetalle"));
const Unidades = lazy(() => import("./pages/catalogos/Unidades"));
const Espacios = lazy(() => import("./pages/catalogos/Espacios"));
const Especialidades = lazy(() => import("./pages/catalogos/Especialidades"));
const ListaEspecialidades = lazy(() => import("./pages/ListaEspecialidades"));
const Defectos = lazy(() => import("./pages/Defectos"));
const EnlacesExternos = lazy(() => import("./pages/EnlacesExternos"));
const Avisos = lazy(() => import("./pages/Avisos"));
const Terminos = lazy(() => import("./pages/Terminos"));
const Planos = lazy(() => import("./pages/Planos"));
const Pruebas = lazy(() => import("./pages/Pruebas"));
const PruebasDetalle = lazy(() => import("./pages/PruebasDetalle"));
const EditorPruebas = lazy(() => import("./pages/EditorPruebas"));
const AltaRapidaEmpresa = lazy(() => import("./pages/catalogos/AltaRapidaEmpresa"));
const Notificaciones = lazy(() => import("./pages/Notificaciones"));
const Seguridad = lazy(() => import("./pages/Seguridad"));
const BitacoraCorreos = lazy(() => import("./pages/BitacoraCorreos"));



// Items
const ItemsList = lazy(() => import("./pages/items/ItemsList"));
const NuevoItem = lazy(() => import("./pages/items/NuevoItem"));
const ItemDetail = lazy(() => import("./pages/items/ItemDetail"));

function AppRoutes() {
  return (
    <Switch>
      {/* Login */}
      <Route path="/login" component={Login} />
      
      {/* Selección de Proyecto (punto de entrada) */}
      <Route path="/seleccionar-proyecto" component={SeleccionProyecto} />
      
      {/* Dashboard y Bienvenida */}
      <Route path="/" component={SeleccionProyecto} />
      <Route path="/dashboard" component={Home} />
      <Route path="/bienvenida" component={Bienvenida} />
      
      {/* Proyectos */}
      <Route path="/proyectos/nuevo" component={NuevoProyecto} />
      <Route path="/proyectos" component={Proyectos} />
      <Route path="/panoramica" component={VistaPanoramica} />
      <Route path="/stacking/pdf" component={StackingPDF} />
      <Route path="/unidades/importar" component={ImportarUnidades} />
      
      {/* Items */}
      <Route path="/items" component={ItemsList} />
      <Route path="/nuevo-item" component={NuevoItem} />
      <Route path="/items/nuevo" component={NuevoItem} />

      <Route path="/items/aprobacion" component={ItemsList} />
      <Route path="/items/:id" component={ItemDetail} />
      
      {/* Catálogos */}
      <Route path="/empresas" component={Empresas} />
      <Route path="/empresas/:id" component={EmpresaDetalle} />
      <Route path="/unidades" component={Unidades} />
      <Route path="/especialidades" component={Especialidades} />
      <Route path="/catalogos/empresas" component={Empresas} />
      <Route path="/catalogos/unidades" component={Unidades} />
      <Route path="/catalogos/espacios" component={Espacios} />
      <Route path="/espacios" component={Espacios} />
      <Route path="/catalogos/especialidades" component={Especialidades} />
      <Route path="/lista-especialidades" component={ListaEspecialidades} />
      <Route path="/defectos" component={Defectos} />
      <Route path="/catalogos/defectos" component={Defectos} />
      <Route path="/alta-rapida-empresa" component={AltaRapidaEmpresa} />
      <Route path="/configuracion/alta-rapida" component={AltaRapidaEmpresa} />
      

      
      {/* Usuarios y Bitácora */}
      <Route path="/usuarios" component={Usuarios} />
      <Route path="/bitacora" component={Bitacora} />
      
      {/* Estadísticas */}
      <Route path="/estadisticas" component={Estadisticas} />
      {/* KPIs eliminado - usar Estadísticas */}
      
      {/* Flujo Rápido */}
      <Route path="/mis-tareas" component={MisTareas} />
      
      {/* Seguimiento público (QR) */}
      <Route path="/seguimiento/:codigo" component={Seguimiento} />
      <Route path="/generar-qr" component={GenerarQR} />
      
      {/* Términos y Condiciones */}
      <Route path="/terminos" component={Terminos} />
      
      {/* Avisos */}
      <Route path="/avisos" component={Avisos} />
      
      {/* Planos */}
      <Route path="/planos" component={Planos} />
      
      {/* Pruebas por Departamento */}
      <Route path="/pruebas" component={Pruebas} />
      <Route path="/pruebas/:id" component={PruebasDetalle} />
      <Route path="/editor-pruebas" component={EditorPruebas} />
      
      {/* Seguridad */}
      <Route path="/seguridad" component={Seguridad} />
      <Route path="/notificaciones" component={Notificaciones} />
      <Route path="/bitacora-correos" component={BitacoraCorreos} />
      
      {/* Configuración y Metas */}
      <Route path="/configuracion" component={Configuracion} />
      <Route path="/enlaces-externos" component={EnlacesExternos} />
      <Route path="/metas" component={Metas} />
      
      {/* 404 */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter>
      <ThemeProvider defaultTheme="light">
        <ProjectProvider>
          <TooltipProvider>
            <ErrorBoundary>
              <Suspense fallback={null}>
                <Toaster />
                <ConnectionStatus />
                <PWAInstallPrompt />
                <AppRoutes />
              </Suspense>
            </ErrorBoundary>
          </TooltipProvider>
        </ProjectProvider>
      </ThemeProvider>
    </WouterRouter>
  );
}

export default App;
