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
// getLoginUrl se usa en Login.tsx
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
  ChevronDown,
  ExternalLink,
  Menu,
  X,
  Activity
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
    { icon: Activity, label: "Curvas", path: "https://bit.ly/49OgS7d", external: true },
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
  superadmin: "Superadministrador",
  admin: "Administrador",
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
    // Redirigir a la página de login
    window.location.href = '/login';
    return <DashboardLayoutSkeleton />;
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  
  // Activar sincronización en tiempo real
  useRealTimeItems();
  
  const menuItems = getMenuItems(user?.role || 'residente');

  // Cerrar dropdown de config al navegar
  useEffect(() => {
    setConfigOpen(false);
    setMobileMenuOpen(false);
  }, [location]);

  // Cerrar menú móvil al cambiar de tamaño de pantalla
  useEffect(() => {
    if (!isMobile) {
      setMobileMenuOpen(false);
    }
  }, [isMobile]);

  // Componente de icono de navegación para desktop
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

  // Componente de item de menú móvil
  const MobileMenuItem = ({ item, isActive, depth = 0 }: { item: MenuItem; isActive: boolean; depth?: number }) => {
    const [subMenuOpen, setSubMenuOpen] = useState(false);
    
    if (item.children) {
      return (
        <div>
          <button
            onClick={() => setSubMenuOpen(!subMenuOpen)}
            className={`
              w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
              ${isActive 
                ? "bg-primary/10 text-primary border-l-4 border-primary" 
                : "hover:bg-accent"
              }
            `}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="flex-1 font-medium">{item.label}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${subMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {subMenuOpen && (
            <div className="bg-muted/50">
              {item.children.map(subItem => {
                const isSubActive = location.startsWith(subItem.path);
                return (
                  <button
                    key={subItem.path}
                    onClick={() => {
                      setLocation(subItem.path);
                      setMobileMenuOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 pl-12 text-left transition-colors
                      ${isSubActive 
                        ? "bg-primary/10 text-primary" 
                        : "hover:bg-accent"
                      }
                    `}
                  >
                    <subItem.icon className="h-4 w-4 shrink-0" />
                    <span className="text-sm">{subItem.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        onClick={() => {
          if (item.external) {
            window.open(item.path, '_blank');
          } else {
            setLocation(item.path);
          }
          setMobileMenuOpen(false);
        }}
        className={`
          w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
          ${isActive 
            ? "bg-primary/10 text-primary border-l-4 border-primary" 
            : "hover:bg-accent"
          }
        `}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        <span className="flex-1 font-medium">{item.label}</span>
        {item.external && (
          <ExternalLink className="h-4 w-4 opacity-50" />
        )}
      </button>
    );
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
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

            {/* Separador - solo desktop */}
            <div className="h-6 w-px bg-border mx-1 sm:mx-2 hidden md:block" />

            {/* Navegación de iconos - SOLO DESKTOP */}
            {!isMobile && (
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
            )}

            {/* Espaciador en móvil */}
            {isMobile && <div className="flex-1" />}

            {/* Separador */}
            <div className="h-6 w-px bg-border mx-1 sm:mx-2" />

            {/* Acciones del lado derecho */}
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <BadgeNotifications />
              <OnlineUsers />
              <NotificationBell />
              <NotificationCenter />

              {/* Menú de usuario - solo desktop */}
              {!isMobile && (
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
              )}

              {/* Botón hamburguesa - solo móvil */}
              {isMobile && (
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="flex items-center justify-center h-10 w-10 rounded-lg hover:bg-accent transition-colors"
                >
                  {mobileMenuOpen ? (
                    <X className="h-6 w-6" />
                  ) : (
                    <Menu className="h-6 w-6" />
                  )}
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Panel lateral móvil (menú hamburguesa) */}
        {isMobile && (
          <>
            {/* Overlay */}
            <div 
              className={`
                fixed inset-0 bg-black/50 z-40 transition-opacity duration-300
                ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
              `}
              onClick={() => setMobileMenuOpen(false)}
            />
            
            {/* Panel lateral */}
            <div 
              className={`
                fixed top-14 right-0 bottom-0 w-72 bg-background z-50 
                shadow-xl border-l overflow-y-auto
                transition-transform duration-300 ease-in-out
                ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
              `}
            >
              {/* Info del usuario */}
              <div className="p-4 border-b bg-muted/30">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2">
                    <AvatarFallback className={`text-white text-lg font-medium ${roleColors[user?.role || 'residente']}`}>
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    <p className="text-xs text-primary font-medium mt-0.5">
                      {roleLabels[user?.role || 'residente']}
                    </p>
                  </div>
                </div>
              </div>

              {/* Menú de navegación */}
              <nav className="py-2">
                {menuItems.map(item => {
                  const isActive = item.path === '/bienvenida' 
                    ? (location === '/bienvenida' || location === '/') 
                    : (item.path ? location.startsWith(item.path) : false);
                  
                  return (
                    <MobileMenuItem 
                      key={item.path || item.label} 
                      item={item} 
                      isActive={isActive} 
                    />
                  );
                })}
              </nav>

              {/* Cerrar sesión */}
              <div className="border-t p-4 mt-auto">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="font-medium">Cerrar Sesión</span>
                </button>
              </div>
            </div>
          </>
        )}
        
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
