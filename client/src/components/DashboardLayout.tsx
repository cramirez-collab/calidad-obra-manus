import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { 
  LayoutDashboard, 
  LogOut, 
  PanelLeft, 
  Building2, 
  MapPin, 
  Wrench, 
  Tags, 
  Users, 
  ClipboardCheck, 
  BarChart3,
  QrCode,
  Settings,
  Camera,
  TrendingUp,
  History,
  Target,
  Menu,
  X,
  ChevronRight,
  FileCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileImage,
  FolderKanban,
  ListOrdered,
  FileSpreadsheet,
  FolderOpen
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import NotificationCenter from "./NotificationCenter";
import OnlineUsers from "./OnlineUsers";
import { BadgeNotifications } from "./BadgeNotifications";
import { QRScannerButton } from "./QRScanner";
import { ProjectSelector } from "./ProjectSelector";
import { useRealTimeItems } from "@/hooks/useRealTimeData";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

// Definición de menú según rol - Solo iconos, tooltips para explicar
const getMenuItems = (role: string) => {
  const baseItems = [
    { icon: LayoutDashboard, label: "Inicio", path: "/", shortLabel: "" },
    { icon: Camera, label: "Nuevo", path: "/nuevo-item", shortLabel: "" },
    { icon: ClipboardCheck, label: "Ítems", path: "/items", shortLabel: "" },
  ];

  const jefeResidenteItems = [
    { icon: FileCheck, label: "Revisión", path: "/items/revision", shortLabel: "" },
  ];

  const supervisorItems = [
    { icon: CheckCircle2, label: "Aprobación", path: "/items/aprobacion", shortLabel: "" },
  ];

  const adminItems = [
    { icon: FolderKanban, label: "Proyectos", path: "/proyectos", shortLabel: "" },
    { icon: BarChart3, label: "Estadísticas", path: "/estadisticas", shortLabel: "" },
    { icon: TrendingUp, label: "KPIs", path: "/kpis", shortLabel: "" },
    { icon: QrCode, label: "QR", path: "/generar-qr", shortLabel: "" },
    { icon: Building2, label: "Empresas", path: "/empresas", shortLabel: "" },
    { icon: MapPin, label: "Unidades", path: "/unidades", shortLabel: "" },
    { icon: Wrench, label: "Especialidades", path: "/especialidades", shortLabel: "" },
    { icon: Tags, label: "Atributos", path: "/atributos", shortLabel: "" },
    { icon: AlertTriangle, label: "Defectos", path: "/defectos", shortLabel: "" },
    { icon: Users, label: "Usuarios", path: "/usuarios", shortLabel: "" },
    { icon: FileImage, label: "Reportes", path: "/reportes", shortLabel: "" },
    { icon: History, label: "Bitácora", path: "/bitacora", shortLabel: "" },
    { icon: ListOrdered, label: "Secuencias", path: "https://www.appsheet.com/start/bad5370e-61b3-4a42-8347-643e96d15f32?platform=desktop#appName=Secuencias-226234876&vss=H4sIAAAAAAAAA6WQwU7EIBCG32XOYADb7ZaretgYPejGg-KBFpoQW2iAqpuGdxd0jR68qMf5Z74vf2aFZ6NfbqPsn4A_rF_TpT4Ah1XA_jBrAVzAmbPRu1EAEnAtp2O46BCNs9IbJyBBekSfjqgD8PX3Cv7_FgiM0jaawWhffIXOniOb14UswTcOEoJpibIb9Xv5wh2Bn64R3DgXczo4P-XpXEaZuWnOESOsxpRhQveM8YpyUp1UrKkZq-9Lt7CzF8rEK6eyNvpFI4he2iD7ot-prOi3XUNOhy1WVLa4aliLO8IoZq3qN5SQtt_UkFLuPLh-CVrd5Zf98VWlzussrfooNMgx6PQGxeoKAhkCAAA=&view=Cuestionario", shortLabel: "", external: true },
    { icon: FileSpreadsheet, label: "Visor", path: "https://docs.google.com/spreadsheets/d/1QhfpVCXE2SwpTazhH96wrc2Q0HIFMS3SpO6GXvS2DJA/edit?gid=464225867#gid=464225867", shortLabel: "", external: true },
    { icon: FolderOpen, label: "Planos", path: "https://drive.google.com/drive/folders/1BsaAtPcfOmmGkJMgtLw_zJujxFQmfiro", shortLabel: "", external: true },
  ];

  const configItems = [
    { icon: Settings, label: "Configuración", path: "/configuracion", shortLabel: "" },
    { icon: Target, label: "Metas", path: "/metas", shortLabel: "" },
  ];

  let items = [...baseItems];

  if (role === 'jefe_residente' || role === 'supervisor' || role === 'admin' || role === 'superadmin') {
    items = [...items, ...jefeResidenteItems];
  }

  if (role === 'supervisor' || role === 'admin' || role === 'superadmin') {
    items = [...items, ...supervisorItems];
  }

  if (role === 'admin' || role === 'superadmin') {
    items = [...items, ...adminItems];
  }

  // Configuración solo para superadmin y supervisor
  if (role === 'superadmin' || role === 'supervisor') {
    items = [...items, ...configItems];
  }

  return items;
};

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 220;
const MIN_WIDTH = 180;
const MAX_WIDTH = 320;

const roleLabels: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  supervisor: "Supervisor",
  jefe_residente: "Jefe Residente",
  residente: "Residente",
};

const roleColors: Record<string, string> = {
  superadmin: "bg-purple-500",
  admin: "bg-blue-500",
  supervisor: "bg-green-500",
  jefe_residente: "bg-orange-500",
  residente: "bg-gray-500",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

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

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Activar sincronización en tiempo real
  useRealTimeItems();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const menuItems = getMenuItems(user?.role || 'residente');
  const activeMenuItem = menuItems.find(item => location.startsWith(item.path) && item.path !== '/') || menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  // Cerrar menú móvil al navegar
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  // Menú móvil con Sheet (hamburguesa a la derecha)
  const MobileMenu = () => (
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[280px] p-0">
        <div className="flex flex-col h-full">
          {/* Header del menú móvil */}
          <div className="flex items-center justify-between p-4 border-b">
            <img 
              src="/logo-objetiva.jpg" 
              alt="ObjetivaQC" 
              className="h-8 object-contain"
            />
          </div>
          
          {/* Items del menú */}
          <div className="flex-1 overflow-y-auto py-2">
            {menuItems.map(item => {
              const isActive = item.path === '/' ? location === '/' : location.startsWith(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    if ((item as any).external) {
                      window.open(item.path, '_blank');
                    } else {
                      setLocation(item.path);
                    }
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-colors ${
                    isActive 
                      ? "bg-primary/10 text-primary border-r-2 border-primary" 
                      : "hover:bg-accent"
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm ${isActive ? "font-medium" : ""}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
          
          {/* Footer con usuario */}
          <div className="border-t p-4">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-10 w-10 border">
                <AvatarFallback className={`text-white text-sm font-medium ${roleColors[user?.role || 'residente']}`}>
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || "-"}</p>
                <p className="text-xs text-muted-foreground">{roleLabels[user?.role || 'residente']}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full justify-start text-destructive hover:text-destructive"
              onClick={logout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <>
      {/* Sidebar para desktop/tablet */}
      <div className="relative hidden md:block" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="border-b">
            <div className="h-14 flex items-center gap-2 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <img 
                  src="/logo-objetiva.jpg" 
                  alt="ObjetivaQC" 
                  className="h-7 object-contain"
                />
              )}
            </div>
            <ProjectSelector collapsed={isCollapsed} />
          </SidebarHeader>

          <SidebarContent className="gap-0 py-2">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = item.path === '/' ? location === '/' : location.startsWith(item.path);
                return (
                  <SidebarMenuItem key={item.path}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => {
                            if ((item as any).external) {
                              window.open(item.path, '_blank');
                            } else {
                              setLocation(item.path);
                            }
                          }}
                          tooltip={item.label}
                          className={`h-10 transition-all font-normal`}
                        >
                          <item.icon
                            className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                          />
                          <span className="truncate">{item.label}</span>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right">
                          {item.label}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-2 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none">
                  <Avatar className="h-8 w-8 border shrink-0">
                    <AvatarFallback className={`text-white text-xs font-medium ${roleColors[user?.role || 'residente']}`}>
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-xs font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {roleLabels[user?.role || 'residente']}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Salir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="flex flex-col min-h-screen">
        {/* Header responsivo */}
        <header className="flex border-b h-14 items-center justify-between bg-background/95 px-3 md:px-4 backdrop-blur sticky top-0 z-40">
          {/* Lado izquierdo - Logo en móvil, título en desktop */}
          <div className="flex items-center gap-2">
            {/* Logo solo en móvil */}
            <div className="md:hidden">
              <img 
                src="/logo-objetiva.jpg" 
                alt="ObjetivaQC" 
                className="h-7 object-contain"
              />
            </div>
            {/* Título de página en desktop */}
            <div className="hidden md:flex items-center gap-2">
              {isMobile && <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />}
              <span className="text-sm font-medium text-foreground">
                {activeMenuItem?.label ?? "Menú"}
              </span>
            </div>
          </div>
          
          {/* Lado derecho - Acciones */}
          <div className="flex items-center gap-1 sm:gap-2">
            <BadgeNotifications />
            <OnlineUsers />
            <NotificationCenter />
            {/* Menú hamburguesa a la DERECHA en móvil */}
            <MobileMenu />
          </div>
        </header>
        
        {/* Contenido principal */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden">{children}</main>
        
        {/* Barra de navegación rápida en móvil (bottom nav) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t safe-area-inset-bottom z-50">
          <div className="flex items-center justify-around h-14 px-2">
            {menuItems.slice(0, 5).map(item => {
              const isActive = item.path === '/' ? location === '/' : location.startsWith(item.path);
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setLocation(item.path)}
                      className={`flex flex-col items-center justify-center h-12 w-12 rounded-lg transition-colors ${
                        isActive 
                          ? "text-primary bg-primary/10" 
                          : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </nav>
        
        {/* Espaciador para la barra inferior en móvil */}
        <div className="h-14 md:hidden" />
        
        {/* Botón flotante de escáner QR */}
        <QRScannerButton />
      </SidebarInset>
    </>
  );
}
