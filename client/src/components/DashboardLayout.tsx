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
  MessageCircle
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
    { icon: TrendingUp, label: "KPIs", path: "/kpis" },
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

  // Submenú de Configuración (ordenado alfabéticamente)
  const configSubItems: MenuItem[] = [
    { icon: History, label: "Bitácora", path: "/bitacora" },
    { icon: Settings, label: "Configuración General", path: "/configuracion" },
    { icon: AlertTriangle, label: "Defectos", path: "/defectos" },
    { icon: Building2, label: "Empresas", path: "/empresas" },
    { icon: Link2, label: "Enlaces Externos", path: "/enlaces-externos" },
    { icon: Layers, label: "Espacios", path: "/espacios" },
    { icon: Wrench, label: "Especialidades", path: "/especialidades" },
    { icon: ListOrdered, label: "Lista Especialidades", path: "/lista-especialidades" },
    { icon: FolderKanban, label: "Proyectos", path: "/proyectos" },
    { icon: QrCode, label: "QR", path: "/generar-qr" },
    { icon: MapPin, label: "Unidades", path: "/unidades" },
    { icon: Users, label: "Usuarios", path: "/usuarios" },
    { icon: MessageCircle, label: "WhatsApp", path: "/configuracion#whatsapp" },
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

            {/* OQC CENTRADO - oculto en móvil para ahorrar espacio */}
            <div className="flex-1 flex justify-center">
              <span className="font-bold text-base sm:text-lg md:text-xl text-primary tracking-wide hidden sm:block">OQC</span>
            </div>

            {/* Separador */}
            <div className="h-6 w-px bg-border mx-1 sm:mx-2" />

            {/* Acciones del lado derecho */}
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <OnlineUsers />
              <NotificationBell />

              {/* Menú de usuario - solo desktop */}
              {!isMobile && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 rounded-lg px-1 sm:px-2 py-1 hover:bg-accent transition-colors focus:outline-none">
                      <Avatar className="h-8 w-8 border">
                        <AvatarImage src={(user as any)?.fotoBase64 || (user?.fotoUrl ? `/api/image/${user.fotoUrl}` : '')} alt={user?.name || 'Usuario'} className="object-cover" />
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

              {/* Link a Términos y Condiciones */}
              <div className="border-t p-2">
                <button
                  onClick={() => setLocation('/terminos')}
                  className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-sm"
                >
                  <FileText className="h-4 w-4" />
                  <span>Términos y Privacidad</span>
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
