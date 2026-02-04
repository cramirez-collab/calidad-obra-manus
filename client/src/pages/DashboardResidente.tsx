import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { 
  Camera, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  ChevronRight,
  Plus,
  Image,
  Eye,
  FileDown
} from "lucide-react";
import { generatePDFHeader, generatePDFFooter } from "@/lib/pdfTemplate";
import { useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadPDFBestMethod } from "@/lib/pdfDownload";

export default function DashboardResidente() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { selectedProjectId } = useProject();
  
  // Dashboard del residente con tareas pendientes
  const { data: dashboard, isLoading } = trpc.flujoRapido.dashboardResidente.useQuery(
    selectedProjectId ? { proyectoId: selectedProjectId } : {},
    { enabled: !!selectedProjectId }
  );

  const formatFecha = (fecha: Date | string) => {
    const d = new Date(fecha);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const getUrgenciaColor = (urgencia: string) => {
    switch (urgencia) {
      case 'critico': return 'bg-red-500 text-white';
      case 'alto': return 'bg-orange-500 text-white';
      default: return 'bg-blue-500 text-white';
    }
  };

  const getUrgenciaLabel = (urgencia: string) => {
    switch (urgencia) {
      case 'critico': return 'Urgente';
      case 'alto': return 'Pronto';
      default: return 'Normal';
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#02B381]"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header con estadísticas rápidas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-[#002C63]">Mis Tareas</h1>
            <p className="text-xs text-gray-500">
              {dashboard?.urgentes || 0} urgentes • {dashboard?.estadisticas?.pendientesFoto || 0} fotos pendientes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              size="icon"
              className="h-10 w-10"
              onClick={() => {
                const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
                const pageWidth = doc.internal.pageSize.getWidth();
                const VERDE_OBJETIVA: [number, number, number] = [2, 179, 129];
                const AZUL_OBJETIVA: [number, number, number] = [0, 44, 99];
                
                // Header
                doc.setFillColor(...AZUL_OBJETIVA);
                doc.rect(0, 0, pageWidth, 25, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(20);
                doc.setFont('helvetica', 'bold');
                doc.text('OBJETIVA', 15, 16);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text('Dashboard Residente', pageWidth - 15, 12, { align: 'right' });
                doc.text(new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }), pageWidth - 15, 18, { align: 'right' });
                
                let yPos = 35;
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text(`Residente: ${user?.name || 'N/A'}`, 15, yPos);
                yPos += 10;
                
                const statsData = [
                  ['Pendientes Foto', String(dashboard?.estadisticas?.pendientesFoto || 0)],
                  ['Pendientes Aprobacion', String(dashboard?.estadisticas?.pendientesAprobacion || 0)],
                  ['Aprobados', String(dashboard?.estadisticas?.aprobados || 0)],
                  ['Rechazados', String(dashboard?.estadisticas?.rechazados || 0)]
                ];
                
                autoTable(doc, {
                  startY: yPos,
                  head: [['Metrica', 'Cantidad']],
                  body: statsData,
                  theme: 'striped',
                  headStyles: { fillColor: VERDE_OBJETIVA, textColor: [255, 255, 255] },
                  margin: { left: 15, right: 15 }
                });
                
                // Footer
                doc.setFontSize(8);
                doc.setTextColor(128, 128, 128);
                doc.text('OQC - Control de Calidad de Obra | Pagina 1 de 1', pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
                
                downloadPDFBestMethod(doc, `dashboard_residente_${new Date().toISOString().split('T')[0]}.pdf`);
              }}
              title="Exportar PDF"
            >
              <FileDown className="h-4 w-4" />
            </Button>
            <Button 
              onClick={() => setLocation('/nuevo-item')}
              className="bg-[#02B381] hover:bg-[#02B381]/90 h-10 px-4"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nuevo
            </Button>
          </div>
        </div>

        {/* Stats compactas */}
        <div className="grid grid-cols-4 gap-2">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-2 text-center">
              <div className="flex items-center justify-center h-8 w-8 mx-auto rounded-full bg-orange-100">
                <Image className="h-4 w-4 text-orange-600" />
              </div>
              <span className="text-lg font-bold text-[#002C63]">{dashboard?.estadisticas?.pendientesFoto || 0}</span>
              <p className="text-[9px] text-gray-500">Fotos</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-2 text-center">
              <div className="flex items-center justify-center h-8 w-8 mx-auto rounded-full bg-blue-100">
                <Eye className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-lg font-bold text-[#002C63]">{dashboard?.estadisticas?.pendientesAprobacion || 0}</span>
              <p className="text-[9px] text-gray-500">Revisión</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-2 text-center">
              <div className="flex items-center justify-center h-8 w-8 mx-auto rounded-full bg-green-100">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-lg font-bold text-[#002B381]">{dashboard?.estadisticas?.aprobados || 0}</span>
              <p className="text-[9px] text-gray-500">OK</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-2 text-center">
              <div className="flex items-center justify-center h-8 w-8 mx-auto rounded-full bg-red-100">
                <XCircle className="h-4 w-4 text-red-600" />
              </div>
              <span className="text-lg font-bold text-[#002C63]">{dashboard?.estadisticas?.rechazados || 0}</span>
              <p className="text-[9px] text-gray-500">No</p>
            </CardContent>
          </Card>
        </div>

        {/* Pendientes de foto - Prioridad máxima */}
        {(dashboard?.pendientesFoto?.length || 0) > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Camera className="h-4 w-4 text-orange-600" />
              <h2 className="text-sm font-semibold text-[#002C63]">Necesitan Foto "Después"</h2>
              <Badge variant="secondary" className="text-[10px]">{dashboard?.pendientesFoto?.length}</Badge>
            </div>
            <div className="space-y-2">
              {dashboard?.pendientesFoto?.slice(0, 5).map((item: any) => (
                <Card 
                  key={item.id} 
                  className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setLocation(`/items/${item.id}`)}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    {/* Indicador de urgencia */}
                    <div className={`h-10 w-1 rounded-full ${
                      item.urgencia === 'critico' ? 'bg-red-500' : 
                      item.urgencia === 'alto' ? 'bg-orange-500' : 'bg-blue-500'
                    }`} />
                    
                    {/* Info del ítem */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-500">{item.codigo}</span>
                        <Badge className={`text-[9px] ${getUrgenciaColor(item.urgencia)}`}>
                          {item.diasPendiente}d
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-[#002C63] truncate">{item.titulo}</p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <span>{item.empresa?.nombre}</span>
                        <span>•</span>
                        <span>{item.unidad?.nombre}</span>
                      </div>
                    </div>
                    
                    {/* Acción rápida */}
                    <Button 
                      size="sm" 
                      className="bg-[#02B381] hover:bg-[#02B381]/90 h-8 px-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/items/${item.id}?action=foto`);
                      }}
                    >
                      <Camera className="h-3 w-3 mr-1" />
                      Foto
                    </Button>
                  </CardContent>
                </Card>
              ))}
              
              {(dashboard?.pendientesFoto?.length || 0) > 5 && (
                <Button 
                  variant="ghost" 
                  className="w-full text-[#002C63]"
                  onClick={() => setLocation('/items?status=pendiente_foto_despues')}
                >
                  Ver todos ({dashboard?.pendientesFoto?.length})
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Pendientes de aprobación */}
        {(dashboard?.pendientesAprobacion?.length || 0) > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-[#002C63]">En Revisión</h2>
              <Badge variant="secondary" className="text-[10px]">{dashboard?.pendientesAprobacion?.length}</Badge>
            </div>
            <div className="space-y-2">
              {dashboard?.pendientesAprobacion?.slice(0, 3).map((item: any) => (
                <Card 
                  key={item.id} 
                  className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setLocation(`/items/${item.id}`)}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="h-10 w-1 rounded-full bg-blue-500" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-500">{item.codigo}</span>
                      </div>
                      <p className="text-sm font-medium text-[#002C63] truncate">{item.titulo}</p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <span>{item.empresa?.nombre}</span>
                        <span>•</span>
                        <span>{item.unidad?.nombre}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Mensaje si no hay pendientes */}
        {(dashboard?.estadisticas?.pendientesFoto || 0) === 0 && 
         (dashboard?.estadisticas?.pendientesAprobacion || 0) === 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-[#02B381] mb-2" />
              <p className="text-sm font-medium text-[#002C63]">¡Todo al día!</p>
              <p className="text-xs text-gray-500">Sin pendientes</p>
            </CardContent>
          </Card>
        )}

        {/* Tasa de aprobación - Diseño minimalista */}
        {(dashboard?.estadisticas?.total || 0) > 0 && (
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#02B381]/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-[#02B381]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tasa de aprobación</p>
                    <p className="text-xl font-bold text-[#002C63]">{dashboard?.estadisticas?.tasaAprobacion || 0}%</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-lg font-semibold text-[#002C63]">{dashboard?.estadisticas?.total || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
