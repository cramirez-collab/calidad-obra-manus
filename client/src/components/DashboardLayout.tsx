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
  WifiOff
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { NotificationBell } from "./NotificationBell";
import OnlineUsers from "./OnlineUsers";
import { QRScannerButton } from "./QRScanner";
import { ProjectSelector } from "./ProjectSelector";
import { useRealTimeItems } from "@/hooks/useRealTimeData";
import { useProject } from "@/contexts/ProjectContext";
import { trpc } from "@/lib/trpc";
import { TermsModal } from "./TermsModal";
import { useSyncManager } from "@/hooks/useSyncManager";
import { usePushNotifications } from "@/hooks/usePushNotifications";
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
    { icon: ClipboardCheck, label: "Ítems", path: "/items" },
    { icon: Clock, label: "Mis Tareas", path: "/mis-tareas" },
  ];

  // Aprobación solo para supervisores y admins (no duplicar con Ítems)
  const supervisorItems: MenuItem[] = [];

  // Items de análisis (los enlaces externos dependen del proyecto)
  const analysisItems: MenuItem[] = [
    { icon: Layers, label: "Stacking", path: "/panoramica" },
    { icon: BarChart3, label: "Estadísticas", path: "/estadisticas" },
    { icon: ListOrdered, label: "Especialidades", path: "/lista-especialidades" },
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

  // Submenú de Configuración
  const configSubItems: MenuItem[] = [
    { icon: Settings, label: "Ajustes", path: "/configuracion" },
    { icon: FolderKanban, label: "Proyectos", path: "/proyectos" },
    { icon: Link2, label: "Enlaces Externos", path: "/enlaces-externos" },
    { icon: QrCode, label: "QR", path: "/generar-qr" },
    { icon: Building2, label: "Empresas", path: "/empresas" },
    { icon: MapPin, label: "Unidades", path: "/unidades" },
    { icon: Layers, label: "Espacios", path: "/espacios" },
    { icon: Wrench, label: "Especialidades", path: "/especialidades" },
    { icon: ListOrdered, label: "Lista Especialidades", path: "/lista-especialidades" },
    { icon: AlertTriangle, label: "Defectos", path: "/defectos" },
    { icon: Users, label: "Usuarios", path: "/usuarios" },
    { icon: History, label: "Bitácora", path: "/bitacora" },
  ];

  // Todos los usuarios ven los items base y de análisis
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
  
  // Obtener proyecto actual para los enlaces dinámicos
  const { selectedProjectId } = useProject();
  const { data: proyectos } = trpc.proyectos.list.useQuery();
  const proyectoActual = proyectos?.find(p => p.id === selectedProjectId) || null;
  
  // Verificar si el usuario ha aceptado los términos
  const { data: terminosData, refetch: refetchTerminos } = trpc.auth.verificarTerminos.useQuery();
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
          <DropdownMenuContent align="end" className="w-48" onInteractOutside={(e) => e.preventDefault()}>
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

            {/* OQC CENTRADO con versión e indicador de conexión */}
            <div className="flex-1 flex justify-center items-center gap-2">
              <span className="font-bold text-xl sm:text-2xl md:text-3xl tracking-wide hidden sm:block" style={{ color: '#002C63' }}>OQC</span>
              <span className="text-[10px] font-mono bg-blue-100 px-1.5 py-0.5 rounded" style={{ color: '#002C63' }}>v54</span>
              {/* Indicador de conexión */}
              <div className="flex items-center gap-1">
                {online ? (
                  <Wifi className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-red-500" />
                )}
                {pendingCount > 0 && (
                  <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full">
                    {isSyncing ? '...' : pendingCount}
                  </span>
                )}
              </div>
            </div>

            {/* Separador */}
            <div className="h-6 w-px bg-border mx-1 sm:mx-2" />

            {/* Acciones del lado derecho - CAMPANA MÁS VISIBLE */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
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
                    {/* BOTÓN ACTUALIZAR VERSIÓN - FORZAR ÚLTIMA VERSIÓN */}
                    <DropdownMenuItem
                      onClick={async () => {
                        try {
                          console.log('[ACTUALIZAR] Forzando actualización a última versión...');
                          // 1. Eliminar TODOS los Service Workers
                          if ('serviceWorker' in navigator) {
                            const registrations = await navigator.serviceWorker.getRegistrations();
                            for (const reg of registrations) {
                              await reg.unregister();
                            }
                            console.log('[ACTUALIZAR] Service Workers eliminados');
                          }
                          // 2. Eliminar TODOS los caches
                          if ('caches' in window) {
                            const cacheNames = await caches.keys();
                            await Promise.all(cacheNames.map(name => caches.delete(name)));
                            console.log('[ACTUALIZAR] Caches eliminados');
                          }
                          // 3. Limpiar localStorage (preservar proyecto y datos offline)
                          const proyectoGuardado = localStorage.getItem('selectedProjectId');
                          const offlineData = localStorage.getItem('oqc_offline_queue');
                          localStorage.clear();
                          sessionStorage.clear();
                          if (proyectoGuardado) localStorage.setItem('selectedProjectId', proyectoGuardado);
                          if (offlineData) localStorage.setItem('oqc_offline_queue', offlineData);
                          // 4. Marcar versión como 0 para forzar actualización
                          localStorage.setItem('oqc_app_version', '0');
                          localStorage.setItem('oqc_installed_version', '0');
                          console.log('[ACTUALIZAR] Versión reseteada, recargando...');
                          // 5. Recargar con cache-bust agresivo
                          window.location.href = window.location.origin + '?force_update=' + Date.now();
                        } catch (e) {
                          console.error('[ACTUALIZAR] Error:', e);
                          window.location.href = window.location.origin + '?force_update=' + Date.now();
                        }
                      }}
                      className="cursor-pointer text-blue-600 focus:text-blue-600 font-semibold"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      🔄 Actualizar Versión
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
              
              {/* BOTÓN ACTUALIZAR VERSIÓN - MÓVIL */}
              <div className="border-t p-2">
                <button
                  onClick={async () => {
                    try {
                      console.log('[ACTUALIZAR] Forzando actualización a última versión...');
                      // 1. Eliminar TODOS los Service Workers
                      if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        for (const reg of registrations) {
                          await reg.unregister();
                        }
                      }
                      // 2. Eliminar TODOS los caches
                      if ('caches' in window) {
                        const cacheNames = await caches.keys();
                        await Promise.all(cacheNames.map(name => caches.delete(name)));
                      }
                      // 3. Limpiar localStorage (preservar proyecto y datos offline)
                      const proyectoGuardado = localStorage.getItem('selectedProjectId');
                      const offlineData = localStorage.getItem('oqc_offline_queue');
                      localStorage.clear();
                      sessionStorage.clear();
                      if (proyectoGuardado) localStorage.setItem('selectedProjectId', proyectoGuardado);
                      if (offlineData) localStorage.setItem('oqc_offline_queue', offlineData);
                      // 4. Marcar versión como 0 para forzar actualización
                      localStorage.setItem('oqc_app_version', '0');
                      localStorage.setItem('oqc_installed_version', '0');
                      // 5. Recargar con cache-bust agresivo
                      window.location.href = window.location.origin + '?force_update=' + Date.now();
                    } catch (e) {
                      window.location.href = window.location.origin + '?force_update=' + Date.now();
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-500/10 text-blue-700 border border-blue-500/30 hover:bg-blue-500/20 transition-colors text-sm font-semibold"
                >
                  <RefreshCw className="h-5 w-5" />
                  <span>🔄 Actualizar Versión</span>
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
        <main className="flex-1 p-2 sm:p-3 md:p-4 lg:p-6 overflow-x-hidden max-w-full">
          <div className="max-w-full overflow-hidden">
            {children}
          </div>
        </main>
        
        {/* Botón flotante de escáner QR */}
        <QRScannerButton />
        
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
