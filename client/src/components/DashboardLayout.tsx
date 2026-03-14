import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserProfileEditor } from "./UserProfile";
import { getImageUrl } from "@/lib/imageUrl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
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
  Activity,
  Link2,
  BookOpen,
  FileText,
  RefreshCw,
  Wifi,
  WifiOff,
  Mail,
  Crosshair,
  Shield,
  ShieldCheck,
  BrainCircuit,
  CalendarDays,
  UserCheck
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { NotificationBell } from "./NotificationBell";
import OnlineUsers from "./OnlineUsers";
import { FloatingCaptureButton } from "./FloatingCaptureButton";
import { ProjectSelector } from "./ProjectSelector";
import { useRealTimeItems } from "@/hooks/useRealTimeData";
import { useProject } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc";
import { TermsModal } from "./TermsModal";
import { useSyncManager } from "@/hooks/useSyncManager";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import AsistenteOQC from "./AsistenteOQC";
import { Bell as BellIcon, BellRing } from "lucide-react";

// Tipo para items de menú
type MenuItem = {
  icon: any;
  label: string;
  path: string;
  external?: boolean;
  children?: MenuItem[];
};

// Tipo para proyecto con enlaces y títulos
type ProyectoConEnlaces = {
  linkCurvas?: string | null;
  linkSecuencias?: string | null;
  linkVisor?: string | null;
  linkPlanos?: string | null;
  linkManuales?: string | null;
  linkEspecificaciones?: string | null;
  tituloCurvas?: string | null;
  tituloSecuencias?: string | null;
  tituloVisor?: string | null;
  tituloPlanos?: string | null;
  tituloManuales?: string | null;
  tituloEspecificaciones?: string | null;
} | null;

// Menú principal según rol y proyecto
const getMenuItems = (role: string, proyecto: ProyectoConEnlaces): MenuItem[] => {
  // Items base para todos los usuarios
  const baseItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "Inicio", path: "/bienvenida" },
    { icon: Camera, label: "Nuevo", path: "/nuevo-item" },
    { icon: Crosshair, label: "Captura", path: "/planos" },
    { icon: ClipboardCheck, label: "Ítems", path: "/items" },
    { icon: Clock, label: "Mis Tareas", path: "/mis-tareas" },
  ];

  // Aprobación solo para supervisores y admins (no duplicar con Ítems)
  const supervisorItems: MenuItem[] = [];

  // Items de análisis (los enlaces externos dependen del proyecto)
  const analysisItems: MenuItem[] = [
    { icon: Layers, label: "Stacking", path: "/panoramica" },
    { icon: Shield, label: "Pruebas", path: "/pruebas" },
    { icon: BarChart3, label: "Estadísticas", path: "/estadisticas" },
    { icon: ListOrdered, label: "Especialidades", path: "/lista-especialidades" },
    { icon: AlertTriangle, label: "Seguridad", path: "/seguridad" },
    { icon: ShieldCheck, label: "BP Seguridad", path: "/buenas-practicas" },
    { icon: CalendarDays, label: "Programa", path: "/programa-semanal" },
  ];
  
  // Agregar enlaces externos solo si están configurados en el proyecto (con títulos personalizados)
  if (proyecto?.linkCurvas) {
    analysisItems.push({ icon: Activity, label: proyecto.tituloCurvas || "Curvas", path: proyecto.linkCurvas, external: true });
  }
  if (proyecto?.linkSecuencias) {
    analysisItems.push({ icon: ListOrdered, label: proyecto.tituloSecuencias || "Secuencias", path: proyecto.linkSecuencias, external: true });
  }
  if (proyecto?.linkVisor) {
    analysisItems.push({ icon: FileSpreadsheet, label: proyecto.tituloVisor || "Visor", path: proyecto.linkVisor, external: true });
  }
  if (proyecto?.linkPlanos) {
    analysisItems.push({ icon: FolderOpen, label: proyecto.tituloPlanos || "Planos", path: proyecto.linkPlanos, external: true });
  }
  if (proyecto?.linkManuales) {
    analysisItems.push({ icon: BookOpen, label: proyecto.tituloManuales || "Manuales", path: proyecto.linkManuales, external: true });
  }
  if (proyecto?.linkEspecificaciones) {
    analysisItems.push({ icon: FileText, label: proyecto.tituloEspecificaciones || "Especificaciones", path: proyecto.linkEspecificaciones, external: true });
  }

  // Submenú de Configuración - Agrupado por secciones
  type MenuItemWithGroup = MenuItem & { group?: string };
  const configSubItems: MenuItemWithGroup[] = [
    // Sistema
    { icon: Settings, label: "Ajustes", path: "/configuracion", group: "Sistema" },
    { icon: FolderKanban, label: "Proyectos", path: "/proyectos", group: "Sistema" },
    { icon: Link2, label: "Enlaces", path: "/enlaces-externos", group: "Sistema" },
    { icon: QrCode, label: "QR", path: "/generar-qr", group: "Sistema" },

    // Catálogos
    { icon: Building2, label: "Empresas", path: "/empresas", group: "Catálogos" },
    { icon: MapPin, label: "Unidades", path: "/unidades", group: "Catálogos" },
    { icon: Layers, label: "Espacios", path: "/espacios", group: "Catálogos" },
    { icon: Wrench, label: "Especialidades", path: "/especialidades", group: "Catálogos" },
    { icon: ListOrdered, label: "Lista Espec.", path: "/lista-especialidades", group: "Catálogos" },
    { icon: AlertTriangle, label: "Defectos", path: "/defectos", group: "Catálogos" },
    // Usuarios
    { icon: Users, label: "Usuarios", path: "/usuarios", group: "Usuarios" },
    { icon: History, label: "Bitácora", path: "/bitacora", group: "Usuarios" },
    { icon: Mail, label: "Correos", path: "/bitacora-correos", group: "Usuarios" },
    // Control
    { icon: UserCheck, label: "Participación", path: "/participacion", group: "Control" },
    { icon: ShieldCheck, label: "Buenas Prácticas", path: "/buenas-practicas", group: "Control" },
    // IA
    { icon: BrainCircuit, label: "Asistente IA", path: "/asistente-admin", group: "Sistema" },
  ];

  // Seguristas: solo ven Bienvenida, Seguridad, y Contratistas (lectura)
  if (role === 'segurista') {
    return [
      { icon: LayoutDashboard, label: "Inicio", path: "/bienvenida" },
      { icon: AlertTriangle, label: "Seguridad", path: "/seguridad" },
      { icon: Building2, label: "Contratistas", path: "/empresas" },
    ];
  }

  // Todos los demás usuarios ven los items base y de análisis
  let items: MenuItem[] = [...baseItems, ...analysisItems];

  // Solo admin y superadmin ven Configuración
  if (role === 'admin' || role === 'superadmin') {
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
  segurista: "Segurista",
};

const roleColors: Record<string, string> = {
  superadmin: "bg-purple-500",
  admin: "bg-blue-500",
  supervisor: "bg-green-500",
  jefe_residente: "bg-orange-500",
  residente: "bg-gray-500",
  desarrollador: "bg-cyan-500",
  segurista: "bg-orange-600",
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
  const [mobileConfigSubMenuOpen, setMobileConfigSubMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  
  // Obtener proyecto actual para los enlaces dinámicos
  const { selectedProjectId, isChangingProject, userProjects, setSelectedProjectId } = useProject();
  const { data: proyectos } = trpc.proyectos.list.useQuery(undefined, { staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000 });
  const proyectoActual = proyectos?.find(p => p.id === selectedProjectId) || null;
  
  // Nombre del proyecto estable: solo se actualiza cuando el cambio termina
  // Evita mostrar el nombre del proyecto anterior durante la transición
  const [stableProjectName, setStableProjectName] = useState<string | null>(null);
  useEffect(() => {
    if (isChangingProject) {
      // Durante el cambio, limpiar inmediatamente
      setStableProjectName(null);
    } else if (proyectoActual?.nombre) {
      // Solo mostrar cuando el cambio terminó y tenemos datos
      setStableProjectName(proyectoActual.nombre);
    } else if (!selectedProjectId) {
      setStableProjectName(null);
    }
  }, [isChangingProject, proyectoActual?.nombre, selectedProjectId]);
  
  // Verificar si el usuario ha aceptado los términos
  const { data: terminosData, refetch: refetchTerminos } = trpc.auth.verificarTerminos.useQuery(undefined, { staleTime: 30 * 60 * 1000, gcTime: 60 * 60 * 1000 });
  const [showTermsModal, setShowTermsModal] = useState(false);
  
  // Mostrar modal de términos si no han sido aceptados
  useEffect(() => {
    if (terminosData && !terminosData.aceptados) {
      setShowTermsModal(true);
    }
  }, [terminosData]);
  
  // Activar sincronización en tiempo real
  useRealTimeItems();
  
  // Sincronización offline
  const { pendingCount, isSyncing, online } = useSyncManager();
  
  // Notificaciones push
  const { isSubscribed: pushSubscribed, isSupported: pushSupported, subscribe: subscribePush, permission: pushPermission } = usePushNotifications();
  
  const menuItems = getMenuItems(user?.role || 'residente', proyectoActual);

  // Cerrar dropdown de config al navegar (pero NO el menú móvil - el usuario decide cuándo cerrarlo)
  useEffect(() => {
    setConfigOpen(false);
    // NO cerrar mobileMenuOpen - el usuario decide cuándo cerrar el menú
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
        <DropdownMenu open={configOpen} onOpenChange={setConfigOpen} modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              className={`
                flex items-center justify-center h-10 w-10 rounded-lg transition-all
                ${isActive 
                  ? "bg-primary text-white shadow-md" 
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }
              `}
              title={item.label}
            >
              <item.icon className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52" onInteractOutside={(e) => e.preventDefault()}>
            {/* Agrupar items por sección */}
            {(() => {
              const groups = ['Sistema', 'Catálogos', 'Usuarios', 'Control'];
              const itemsWithGroup = item.children as (MenuItem & { group?: string })[];
              return groups.map((groupName, groupIndex) => {
                const groupItems = itemsWithGroup.filter(i => i.group === groupName);
                if (groupItems.length === 0) return null;
                return (
                  <div key={groupName}>
                    {groupIndex > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                      {groupName}
                    </DropdownMenuLabel>
                    <DropdownMenuGroup>
                      {groupItems.map(subItem => {
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
                    </DropdownMenuGroup>
                  </div>
                );
              });
            })()}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    // Item normal
    if (item.external) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={item.path}
              target="_blank"
              rel="noopener noreferrer"
              className={`
                flex items-center justify-center h-10 w-10 rounded-lg transition-all relative
                text-muted-foreground hover:bg-accent hover:text-foreground
              `}
            >
              <item.icon className="h-5 w-5" />
              <ExternalLink className="h-2.5 w-2.5 absolute top-1 right-1 opacity-50" />
            </a>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="font-medium">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setLocation(item.path)}
            className={`
              flex items-center justify-center h-10 w-10 rounded-lg transition-all relative
              ${isActive 
                ? "bg-primary text-white shadow-md" 
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }
            `}
          >
            <item.icon className="h-5 w-5" />
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
    // Usar estado persistente del padre para el submenú de Configuración
    const isConfigMenu = item.label === 'Configuración';
    const subMenuOpen = isConfigMenu ? mobileConfigSubMenuOpen : false;
    const setSubMenuOpen = isConfigMenu ? setMobileConfigSubMenuOpen : () => {};
    
    if (item.children) {
      return (
        <div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isConfigMenu) {
                setMobileConfigSubMenuOpen(!mobileConfigSubMenuOpen);
              }
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
            <ChevronDown className={`h-4 w-4 transition-transform ${subMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {subMenuOpen && (
            <div className="bg-muted/50">
              {/* Agrupar items por sección en móvil */}
              {(() => {
                const groups = ['Sistema', 'Catálogos', 'Usuarios', 'Control'];
                const itemsWithGroup = item.children as (MenuItem & { group?: string })[];
                return groups.map((groupName, groupIndex) => {
                  const groupItems = itemsWithGroup.filter(i => i.group === groupName);
                  if (groupItems.length === 0) return null;
                  return (
                    <div key={groupName}>
                      {groupIndex > 0 && <div className="border-t border-border my-1" />}
                      <div className="px-4 py-2 pl-12 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                        {groupName}
                      </div>
                      {groupItems.map(subItem => {
                        const isSubActive = location.startsWith(subItem.path);
                        return (
                          <button
                            key={subItem.path}
                            onClick={() => {
                              setLocation(subItem.path);
                              // NO cerrar el menú móvil - el usuario decide cuándo cerrarlo
                            }}
                            className={`
                              w-full flex items-center gap-3 px-4 py-2.5 pl-14 text-left transition-colors
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
                  );
                });
              })()}
            </div>
          )}
        </div>
      );
    }

    if (item.external) {
      return (
        <a
          href={item.path}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setMobileMenuOpen(false)}
          className={`
            w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
            hover:bg-accent
          `}
        >
          <item.icon className="h-5 w-5 shrink-0" />
          <span className="flex-1 font-medium">{item.label}</span>
          <ExternalLink className="h-4 w-4 opacity-50" />
        </a>
      );
    }

    return (
      <button
        onClick={() => {
          setLocation(item.path);
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
      </button>
    );
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
          <div className="flex items-center h-14 px-2 sm:px-4 max-w-full overflow-hidden">
            {/* Logo */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <img 
                src="/logo-objetiva.jpg" 
                alt="OQC" 
                style={{ maxHeight: '32px', width: 'auto' }}
                className="h-6 sm:h-7 md:h-8 object-contain"
              />
            </div>

            {/* Selector de proyecto */}
            <div className="shrink-0 mx-2">
              <ProjectSelector collapsed={isMobile} />
            </div>

            {/* Navegación de iconos - SOLO DESKTOP */}
            {!isMobile && (
              <nav className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide py-1">
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

            {/* Nombre del proyecto (clickeable para cambiar) + versión e indicador de conexión */}
            <div className="flex-1 flex justify-center items-center gap-2 min-w-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-[#002C63]/20 hover:border-[#02B381]/50 hover:bg-[#02B381]/5 transition-all focus:outline-none focus:ring-2 focus:ring-[#02B381]/30 min-w-0 max-w-[220px] sm:max-w-[320px] group"
                    title="Click para cambiar de proyecto"
                  >
                    <FolderKanban className="h-4 w-4 shrink-0 text-[#02B381] group-hover:scale-110 transition-transform" />
                    {stableProjectName ? (
                      <span className="font-bold text-sm sm:text-lg md:text-xl tracking-wide truncate" style={{ color: '#002C63' }}>
                        {stableProjectName}
                      </span>
                    ) : (
                      <span className="font-bold text-lg sm:text-2xl md:text-3xl tracking-wide" style={{ color: '#002C63' }}>OQC</span>
                    )}
                    <ChevronDown className="h-3.5 w-3.5 text-[#002C63]/50 shrink-0 group-hover:text-[#02B381] transition-colors" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-72">
                  <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <FolderKanban className="h-3.5 w-3.5" />
                    Cambiar Proyecto
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {userProjects.map((p: any) => {
                    const pId = p.id || p.proyecto?.id || p.proyectoId;
                    const pName = p.nombre || p.proyecto?.nombre || 'Proyecto';
                    const isActive = pId === selectedProjectId;
                    return (
                      <DropdownMenuItem
                        key={pId}
                        onClick={() => {
                          if (!isActive && pId) {
                            setSelectedProjectId(pId);
                            setLocation('/bienvenida');
                          }
                        }}
                        className={`cursor-pointer flex items-center gap-2 py-2.5 ${isActive ? 'bg-[#02B381]/10 text-[#002C63] font-semibold border-l-2 border-[#02B381]' : 'hover:bg-slate-50'}`}
                      >
                        <Building2 className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#02B381]' : 'text-slate-400'}`} />
                        <span className="truncate">{pName}</span>
                        {isActive && <span className="ml-auto text-[10px] bg-[#02B381] text-white px-1.5 py-0.5 rounded-full">Activo</span>}
                      </DropdownMenuItem>
                    );
                  })}
                  {(user?.role === 'superadmin' || user?.role === 'admin') && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setLocation('/proyectos')}
                        className="cursor-pointer flex items-center gap-2 text-[#002C63] hover:bg-slate-50"
                      >
                        <Settings className="h-4 w-4 shrink-0" />
                        <span>Gestionar Proyectos</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-[10px] font-mono bg-blue-100 px-1.5 py-0.5 rounded shrink-0" style={{ color: '#002C63' }}>{(window as any).OQC_DISPLAY_VERSION || 'v2.13'}</span>
              {/* Indicador de conexión eliminado — sync opera silenciosamente */}
            </div>

            {/* Separador */}
            <div className="h-6 w-px bg-border mx-1 sm:mx-2" />

            {/* Acciones del lado derecho - CAMPANA MÁS VISIBLE */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* Indicador de pendientes de sincronización */}
              {pendingCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a href="/pendientes" className="relative flex items-center justify-center h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 animate-pulse cursor-pointer hover:bg-amber-500/20 transition-colors">
                      <RefreshCw className="h-4 w-4" />
                      <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                        {pendingCount > 9 ? '9+' : pendingCount}
                      </span>
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{pendingCount} elemento(s) pendiente(s) de sincronizar</p>
                    <p className="text-xs opacity-70">Toca para ver detalles</p>
                    {!online && <p className="text-amber-400 text-xs">Sin conexión a internet</p>}
                  </TooltipContent>
                </Tooltip>
              )}
              {/* Estado de conexión - solo si está offline */}
              {!online && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-red-500/10 text-red-500">
                      <WifiOff className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Sin conexión a internet</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {/* Campana de notificaciones - PROMINENTE */}
              <NotificationBell />
              <OnlineUsers />

              {/* Menú de usuario - solo desktop */}
              {!isMobile && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 rounded-lg px-1 sm:px-2 py-1 hover:bg-accent transition-colors focus:outline-none">
                      <Avatar className="h-8 w-8 border">
                        <AvatarImage src={getImageUrl((user as any)?.fotoBase64 || user?.fotoUrl)} alt={user?.name || 'Usuario'} className="object-cover" />
                        <AvatarFallback className={`text-white text-xs font-medium ${roleColors[user?.role || 'residente']}`}>
                          {user?.name?.split(' ').map(n => n.charAt(0)).slice(0, 2).join('').toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <div className="px-3 py-3 flex items-center gap-3">
                      <UserProfileEditor 
                        user={{ 
                          id: user?.id || 0, 
                          name: user?.name, 
                          email: user?.email, 
                          role: user?.role,
                          fotoUrl: user?.fotoUrl,
                          fotoBase64: (user as any)?.fotoBase64
                        }} 
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {roleLabels[user?.role || 'residente']}
                        </p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    {/* BOTÓN ACTUALIZAR VERSIÓN - FORZAR ÚLTIMA VERSIÓN PUBLICADA */}
                    <DropdownMenuItem
                      onClick={async () => {
                        try {
                          console.log('[ACTUALIZAR NUCLEAR] Forzando descarga de última versión publicada...');
                          
                          // 1. Eliminar TODOS los Service Workers de forma agresiva
                          if ('serviceWorker' in navigator) {
                            const registrations = await navigator.serviceWorker.getRegistrations();
                            console.log('[ACTUALIZAR] Service Workers encontrados:', registrations.length);
                            for (const reg of registrations) {
                              await reg.unregister();
                              console.log('[ACTUALIZAR] SW eliminado:', reg.scope);
                            }
                          }
                          
                          // 2. Eliminar TODOS los caches sin excepción
                          if ('caches' in window) {
                            const cacheNames = await caches.keys();
                            console.log('[ACTUALIZAR] Caches encontrados:', cacheNames);
                            await Promise.all(cacheNames.map(async (name) => {
                              await caches.delete(name);
                              console.log('[ACTUALIZAR] Cache eliminado:', name);
                            }));
                          }
                          
                          // 3. Preservar SOLO datos críticos
                          const proyectoGuardado = localStorage.getItem('selectedProjectId');
                          const offlineData = localStorage.getItem('oqc_offline_queue');
                          
                          // 4. Limpiar TODO el almacenamiento
                          localStorage.clear();
                          sessionStorage.clear();
                          
                          // 5. Restaurar datos críticos
                          if (proyectoGuardado) localStorage.setItem('selectedProjectId', proyectoGuardado);
                          if (offlineData) localStorage.setItem('oqc_offline_queue', offlineData);
                          
                          // 6. FORZAR versión 0 para que el sistema detecte actualización
                          localStorage.setItem('oqc_app_version', '0');
                          localStorage.setItem('oqc_installed_version', '0');
                          localStorage.setItem('oqc_force_nuclear_update', 'true');
                          
                          // 7. Limpiar IndexedDB completamente
                          try {
                            const databases = await indexedDB.databases();
                            for (const db of databases) {
                              if (db.name && db.name !== 'objetiva-qc-offline') {
                                indexedDB.deleteDatabase(db.name);
                              }
                            }
                          } catch (e) {
                            console.log('[ACTUALIZAR] IndexedDB limpieza parcial');
                          }
                          
                          console.log('[ACTUALIZAR NUCLEAR] Todo limpio. Recargando desde servidor...');
                          
                          // 8. Recargar con múltiples parámetros anti-cache
                          const timestamp = Date.now();
                          const random = Math.random().toString(36).substring(7);
                          window.location.href = `${window.location.origin}/?nuclear=${timestamp}&bust=${random}&v=0`;
                        } catch (e) {
                          console.error('[ACTUALIZAR] Error:', e);
                          // Forzar recarga incluso si hay error
                          window.location.href = `${window.location.origin}/?force=${Date.now()}`;
                        }
                      }}
                      className="cursor-pointer text-green-600 focus:text-green-600 font-bold"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      🚀 ACTUALIZAR A ÚLTIMA VERSIÓN
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={async () => {
                        try {
                          console.log('[Cache] Iniciando limpieza completa (PC)...');
                          // 1. Desregistrar TODOS los Service Workers
                          if ('serviceWorker' in navigator) {
                            const registrations = await navigator.serviceWorker.getRegistrations();
                            for (const reg of registrations) {
                              await reg.unregister();
                            }
                          }
                          // 2. Limpiar caches
                          if ('caches' in window) {
                            const cacheNames = await caches.keys();
                            await Promise.all(cacheNames.map(name => caches.delete(name)));
                          }
                          // 3. Limpiar storage (preservar proyecto)
                          const proyectoGuardado = localStorage.getItem('selectedProjectId');
                          localStorage.clear();
                          sessionStorage.clear();
                          if (proyectoGuardado) localStorage.setItem('selectedProjectId', proyectoGuardado);
                          // 4. Limpiar IndexedDB
                          if ('indexedDB' in window) {
                            try {
                              const dbs = await indexedDB.databases();
                              for (const db of dbs) {
                                if (db.name) indexedDB.deleteDatabase(db.name);
                              }
                            } catch (e) {}
                          }
                          // 5. Recargar con cache-bust
                          window.location.href = window.location.origin + '?v=' + Date.now();
                        } catch (e) {
                          window.location.href = window.location.origin + '?v=' + Date.now();
                        }
                      }}
                      className="cursor-pointer text-orange-600 focus:text-orange-600"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Limpiar Caché
                    </DropdownMenuItem>
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
                  <UserProfileEditor 
                    user={{ 
                      id: user?.id || 0, 
                      name: user?.name, 
                      email: user?.email, 
                      role: user?.role,
                      fotoUrl: user?.fotoUrl,
                      fotoBase64: (user as any)?.fotoBase64
                    }} 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    <p className="text-xs text-primary font-medium mt-0.5">
                      {roleLabels[user?.role || 'residente']}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <Camera className="h-3 w-3 inline mr-1" />
                      Toca tu foto para cambiarla
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

              {/* Botón de Notificaciones Push */}
              <div className="border-t p-2">
                <button
                  onClick={async () => {
                    if (!pushSupported) {
                      alert('Tu navegador no soporta notificaciones push. Usa Chrome o Safari.');
                      return;
                    }
                    if (pushPermission === 'denied') {
                      alert('Las notificaciones están bloqueadas. Ve a Configuración del navegador → Sitios → objetivaoqc.cc → Notificaciones → Permitir');
                      return;
                    }
                    if (pushSubscribed) {
                      alert('¡Las notificaciones push ya están activadas!');
                      return;
                    }
                    const success = await subscribePush();
                    if (success) {
                      alert('¡Notificaciones push activadas! Recibirás alertas de ítems urgentes.');
                    } else {
                      alert('No se pudieron activar las notificaciones. Inténtalo de nuevo.');
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
                    pushSubscribed 
                      ? 'bg-green-500/10 text-green-700 border border-green-500/30' 
                      : 'bg-orange-500/10 text-orange-700 border border-orange-500/30 hover:bg-orange-500/20'
                  }`}
                >
                  {pushSubscribed ? (
                    <>
                      <BellRing className="h-5 w-5" />
                      <span>✅ Notificaciones Activadas</span>
                    </>
                  ) : (
                    <>
                      <BellIcon className="h-5 w-5" />
                      <span>🔔 Activar Notificaciones Push</span>
                    </>
                  )}
                </button>
              </div>

              {/* Link a Términos y Privacidad */}
              <div className="border-t p-2">
                <button
                  onClick={() => setLocation('/terminos')}
                  className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-sm"
                >
                  <FileText className="h-4 w-4" />
                  <span>Términos y Privacidad</span>
                </button>
              </div>
              
              {/* BOTÓN ACTUALIZAR VERSIÓN - MÓVIL - FORZAR ÚLTIMA VERSIÓN PUBLICADA */}
              <div className="border-t p-2">
                <button
                  onClick={async () => {
                    try {
                      console.log('[ACTUALIZAR NUCLEAR] Forzando descarga de última versión publicada...');
                      
                      // 1. Eliminar TODOS los Service Workers de forma agresiva
                      if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        console.log('[ACTUALIZAR] Service Workers encontrados:', registrations.length);
                        for (const reg of registrations) {
                          await reg.unregister();
                          console.log('[ACTUALIZAR] SW eliminado:', reg.scope);
                        }
                      }
                      
                      // 2. Eliminar TODOS los caches sin excepción
                      if ('caches' in window) {
                        const cacheNames = await caches.keys();
                        console.log('[ACTUALIZAR] Caches encontrados:', cacheNames);
                        await Promise.all(cacheNames.map(async (name) => {
                          await caches.delete(name);
                          console.log('[ACTUALIZAR] Cache eliminado:', name);
                        }));
                      }
                      
                      // 3. Preservar SOLO datos críticos
                      const proyectoGuardado = localStorage.getItem('selectedProjectId');
                      const offlineData = localStorage.getItem('oqc_offline_queue');
                      
                      // 4. Limpiar TODO el almacenamiento
                      localStorage.clear();
                      sessionStorage.clear();
                      
                      // 5. Restaurar datos críticos
                      if (proyectoGuardado) localStorage.setItem('selectedProjectId', proyectoGuardado);
                      if (offlineData) localStorage.setItem('oqc_offline_queue', offlineData);
                      
                      // 6. FORZAR versión 0 para que el sistema detecte actualización
                      localStorage.setItem('oqc_app_version', '0');
                      localStorage.setItem('oqc_installed_version', '0');
                      localStorage.setItem('oqc_force_nuclear_update', 'true');
                      
                      // 7. Limpiar IndexedDB completamente
                      try {
                        const databases = await indexedDB.databases();
                        for (const db of databases) {
                          if (db.name && db.name !== 'objetiva-qc-offline') {
                            indexedDB.deleteDatabase(db.name);
                          }
                        }
                      } catch (e) {
                        console.log('[ACTUALIZAR] IndexedDB limpieza parcial');
                      }
                      
                      console.log('[ACTUALIZAR NUCLEAR] Todo limpio. Recargando desde servidor...');
                      
                      // 8. Recargar con múltiples parámetros anti-cache
                      const timestamp = Date.now();
                      const random = Math.random().toString(36).substring(7);
                      window.location.href = `${window.location.origin}/?nuclear=${timestamp}&bust=${random}&v=0`;
                    } catch (e) {
                      console.error('[ACTUALIZAR] Error:', e);
                      // Forzar recarga incluso si hay error
                      window.location.href = `${window.location.origin}/?force=${Date.now()}`;
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-sm"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Actualizar Versión</span>
                </button>
              </div>
              
              {/* Limpiar Caché */}
              <div className="border-t p-2">
                <button
                  onClick={async () => {
                    try {
                      console.log('[Cache] Iniciando limpieza completa...');
                      
                      // 1. Desregistrar TODOS los Service Workers primero
                      if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        for (const registration of registrations) {
                          await registration.unregister();
                          console.log('[Cache] SW desregistrado');
                        }
                      }
                      
                      // 2. Limpiar TODOS los caches del navegador
                      if ('caches' in window) {
                        const cacheNames = await caches.keys();
                        await Promise.all(cacheNames.map(name => {
                          console.log('[Cache] Eliminando cache:', name);
                          return caches.delete(name);
                        }));
                      }
                      
                      // 3. Limpiar localStorage COMPLETAMENTE (incluyendo versión)
                      const selectedProject = localStorage.getItem('selectedProjectId');
                      localStorage.clear();
                      // Solo preservar proyecto seleccionado
                      if (selectedProject) localStorage.setItem('selectedProjectId', selectedProject);
                      // NO guardar versión - forzar que se detecte como nueva
                      
                      // 4. Limpiar sessionStorage
                      sessionStorage.clear();
                      
                      // 5. Limpiar IndexedDB si existe
                      if ('indexedDB' in window) {
                        try {
                          const databases = await indexedDB.databases();
                          for (const db of databases) {
                            if (db.name) {
                              indexedDB.deleteDatabase(db.name);
                              console.log('[Cache] IndexedDB eliminada:', db.name);
                            }
                          }
                        } catch (e) {
                          console.log('[Cache] Error limpiando IndexedDB:', e);
                        }
                      }
                      
                      console.log('[Cache] Limpieza completa. Recargando con cache-bust...');
                      
                      // 6. Recargar con parámetro de cache-bust para forzar descarga fresca
                      const cacheBust = Date.now();
                      window.location.href = window.location.origin + window.location.pathname + '?v=' + cacheBust;
                    } catch (error) {
                      console.error('[Cache] Error limpiando caché:', error);
                      // Forzar recarga de todas formas
                      window.location.href = window.location.origin + '?v=' + Date.now();
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-orange-600 hover:bg-orange-50 transition-colors text-sm"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Limpiar Caché y Recargar</span>
                </button>
              </div>
              
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
        <main className="flex-1 p-2 sm:p-3 md:p-4 lg:p-6 overflow-x-hidden overflow-y-auto max-w-full">
          <div className="max-w-full overflow-x-hidden">
            {children}
          </div>
        </main>
        
        {/* Botones flotantes: WhatsApp (Hidalma) + Captura + QR - todos en un solo contenedor derecha */}
        <FloatingCaptureButton />
        
        {/* Asistente OQC - disponible en toda la app */}
        <AsistenteOQC proyectoId={selectedProjectId || undefined} />
        
        {/* Modal de Términos y Condiciones */}
        <TermsModal 
          open={showTermsModal} 
          onAccept={() => {
            setShowTermsModal(false);
            refetchTerminos();
          }} 
        />
      </div>
    </TooltipProvider>
  );
}
