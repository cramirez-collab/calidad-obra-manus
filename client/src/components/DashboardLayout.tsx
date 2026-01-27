import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { 
  LayoutDashboard, 
  LogOut, 
  Building2, 
  MapPin, 
  Wrench, 
  Users, 
  ClipboardCheck, 
  BarChart3,
  QrCode,
  Settings,
  Camera,
  TrendingUp,
  History,
  AlertTriangle,
  FileSpreadsheet,
  FolderOpen,
  Layers,
  ListOrdered,
  FolderKanban,
  Clock,
  CheckCircle2,
  ChevronDown,
  ExternalLink
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import NotificationCenter from "./NotificationCenter";
import { NotificationBell } from "./NotificationBell";
import OnlineUsers from "./OnlineUsers";
import { BadgeNotifications } from "./BadgeNotifications";
import { QRScannerButton } from "./QRScanner";
import { ProjectSelector } from "./ProjectSelector";
import { useRealTimeItems } from "@/hooks/useRealTimeData";

// Tipo para items de menú
type MenuItem = {
  icon: any;
  label: string;
  path: string;
  external?: boolean;
  children?: MenuItem[];
};

// Menú principal según rol
const getMenuItems = (role: string): MenuItem[] => {
  // Items base para todos los usuarios
  const baseItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "Inicio", path: "/bienvenida" },
    { icon: Camera, label: "Nuevo", path: "/nuevo-item" },
    { icon: ClipboardCheck, label: "Ítems", path: "/items" },
    { icon: Clock, label: "Mis Tareas", path: "/mis-tareas" },
  ];

  // Aprobación solo para supervisores y admins (no duplicar con Ítems)
  const supervisorItems: MenuItem[] = [];

  const analysisItems: MenuItem[] = [
    { icon: Layers, label: "Stacking", path: "/panoramica" },
    { icon: BarChart3, label: "Estadísticas", path: "/estadisticas" },
    { icon: TrendingUp, label: "KPIs", path: "/kpis" },
    { icon: ListOrdered, label: "Secuencias", path: "https://www.appsheet.com/start/bad5370e-61b3-4a42-8347-643e96d15f32?platform=desktop#appName=Secuencias-226234876&vss=H4sIAAAAAAAAA6WQwU7EIBCG32XOYADb7ZaretgYPejGg-KBFpoQW2iAqpuGdxd0jR68qMf5Z74vf2aFZ6NfbqPsn4A_rF_TpT4Ah1XA_jBrAVzAmbPRu1EAEnAtp2O46BCNs9IbJyBBekSfjqgD8PX3Cv7_FgiM0jaawWhffIXOniOb14UswTcOEoJpibIb9Xv5wh2Bn64R3DgXczo4P-XpXEaZuWnOESOsxpRhQveM8YpyUp1UrKkZq-9Lt7CzF8rEK6eyNvpFI4he2iD7ot-prOi3XUNOhy1WVLa4aliLO8IoZq3qN5SQtt_UkFLuPLh-CVrd5Zf98VWlzussrfooNMgx6PQGxeoKAhkCAAA=&view=Cuestionario", external: true },
    { icon: FileSpreadsheet, label: "Visor", path: "https://docs.google.com/spreadsheets/d/1QhfpVCXE2SwpTazhH96wrc2Q0HIFMS3SpO6GXvS2DJA/edit?gid=464225867#gid=464225867", external: true },
    { icon: FolderOpen, label: "Planos", path: "https://drive.google.com/drive/folders/1BsaAtPcfOmmGkJMgtLw_zJujxFQmfiro", external: true },
  ];

  // Submenú de Configuración
  const configSubItems: MenuItem[] = [
    { icon: FolderKanban, label: "Proyectos", path: "/proyectos" },
    { icon: QrCode, label: "QR", path: "/generar-qr" },
    { icon: Building2, label: "Empresas", path: "/empresas" },
    { icon: MapPin, label: "Unidades", path: "/unidades" },
    { icon: Layers, label: "Espacios", path: "/espacios" },
    { icon: Wrench, label: "Especialidades", path: "/especialidades" },
    { icon: AlertTriangle, label: "Defectos", path: "/defectos" },
    { icon: Users, label: "Usuarios", path: "/usuarios" },
    { icon: History, label: "Bitácora", path: "/bitacora" },
  ];

  let items: MenuItem[] = [...baseItems];

  if (role === 'supervisor' || role === 'admin' || role === 'superadmin') {
    items = [...items, ...supervisorItems];
  }

  // Desarrollador: puede ver y crear ítems, pero NO accede a Configuración
  if (role === 'desarrollador') {
    // Solo tiene acceso a los baseItems (Inicio, Nuevo, Ítems, Mis Tareas)
    // No se agregan analysisItems ni configSubItems
    return items;
  }

  if (role === 'admin' || role === 'superadmin') {
    items = [...items, ...analysisItems];
    items.push({
      icon: Settings,
      label: "Configuración",
      path: "",
      children: configSubItems,
    });
  }

  return items;
};

const roleLabels: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  supervisor: "Supervisor",
  jefe_residente: "Jefe Residente",
  residente: "Residente",
  desarrollador: "Desarrollador",
};

const roleColors: Record<string, string> = {
  superadmin: "bg-purple-500",
  admin: "bg-blue-500",
  supervisor: "bg-green-500",
  jefe_residente: "bg-orange-500",
  residente: "bg-gray-500",
  desarrollador: "bg-cyan-500",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-6 p-6 sm:p-8 max-w-sm w-full mx-4 bg-white rounded-2xl shadow-xl">
          <img 
            src="/logo-objetiva.jpg" 
            alt="ObjetivaQC" 
            className="h-12 object-contain"
          />
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-xl font-bold tracking-tight">
              Control de Calidad
            </h1>
            <p className="text-sm text-muted-foreground">
              Inicia sesión para continuar
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full h-12 text-base font-medium"
          >
            Iniciar Sesión
          </Button>
        </div>
      </div>
    );
  }

  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [configOpen, setConfigOpen] = useState(false);
  const isMobile = useIsMobile();
  
  // Activar sincronización en tiempo real
  useRealTimeItems();
  
  const menuItems = getMenuItems(user?.role || 'residente');

  // Cerrar dropdown de config al navegar
  useEffect(() => {
    setConfigOpen(false);
  }, [location]);

  // Componente de icono de navegación
  const NavIcon = ({ item, isActive }: { item: MenuItem; isActive: boolean }) => {
    // Si tiene hijos (submenú como Configuración)
    if (item.children) {
      return (
        <DropdownMenu open={configOpen} onOpenChange={setConfigOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  className={`
                    flex items-center justify-center h-10 w-10 rounded-lg transition-all
                    ${isActive 
                      ? "bg-primary text-white shadow-md" 
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }
                  `}
                >
                  <item.icon className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-medium">
              {item.label}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-48">
            {item.children.map(subItem => {
              const isSubActive = location.startsWith(subItem.path);
              return (
                <DropdownMenuItem
                  key={subItem.path}
                  onClick={() => setLocation(subItem.path)}
                  className={`cursor-pointer ${isSubActive ? "bg-primary/10 text-primary" : ""}`}
                >
                  <subItem.icon className="mr-2 h-4 w-4" />
                  {subItem.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    // Item normal
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              if (item.external) {
                window.open(item.path, '_blank');
              } else {
                setLocation(item.path);
              }
            }}
            className={`
              flex items-center justify-center h-10 w-10 rounded-lg transition-all relative
              ${isActive 
                ? "bg-primary text-white shadow-md" 
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }
            `}
          >
            <item.icon className="h-5 w-5" />
            {item.external && (
              <ExternalLink className="h-2.5 w-2.5 absolute top-1 right-1 opacity-50" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header con navegación de iconos */}
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
          <div className="flex items-center h-14 px-2 sm:px-4">
            {/* Logo */}
            <div className="flex items-center gap-2 mr-2 sm:mr-4 shrink-0">
              <img 
                src="/logo-objetiva.jpg" 
                alt="ObjetivaQC" 
                className="h-7 sm:h-8 object-contain"
              />
            </div>

            {/* Selector de proyecto */}
            <div className="shrink-0 mr-2">
              <ProjectSelector collapsed={isMobile} />
            </div>

            {/* Separador */}
            <div className="h-6 w-px bg-border mx-1 sm:mx-2 hidden sm:block" />

            {/* Navegación de iconos - scrollable en móvil */}
            <nav className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto flex-1 scrollbar-hide py-1">
              {menuItems.map(item => {
                const isActive = item.path === '/bienvenida' 
                  ? (location === '/bienvenida' || location === '/') 
                  : (item.path ? location.startsWith(item.path) : false);
                
                return (
                  <NavIcon key={item.path || item.label} item={item} isActive={isActive} />
                );
              })}
            </nav>

            {/* Separador */}
            <div className="h-6 w-px bg-border mx-1 sm:mx-2" />

            {/* Acciones del lado derecho */}
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <BadgeNotifications />
              <OnlineUsers />
              <NotificationBell />
              <NotificationCenter />

              {/* Menú de usuario */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 rounded-lg px-1 sm:px-2 py-1 hover:bg-accent transition-colors focus:outline-none">
                    <Avatar className="h-8 w-8 border">
                      <AvatarFallback className={`text-white text-xs font-medium ${roleColors[user?.role || 'residente']}`}>
                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium truncate">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {roleLabels[user?.role || 'residente']}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        
        {/* Contenido principal */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden">
          {children}
        </main>
        
        {/* Botón flotante de escáner QR */}
        <QRScannerButton />
      </div>
    </TooltipProvider>
  );
}
