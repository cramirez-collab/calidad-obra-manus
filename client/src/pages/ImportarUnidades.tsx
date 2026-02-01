import { useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { useProject } from "@/contexts/ProjectContext";
import { useLocation } from "wouter";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  ArrowLeft,
  Download,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type UnidadPreview = {
  nombre: string;
  codigo?: string;
  nivel?: number;
  fechaInicio?: Date;
  fechaFin?: Date;
  valid: boolean;
  error?: string;
};

export default function ImportarUnidades() {
  const { selectedProjectId } = useProject();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UnidadPreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const importMutation = trpc.unidades.importarExcel.useMutation({
    onSuccess: (data) => {
      toast.success(`Se importaron ${data.count} unidades correctamente`);
      utils.unidades.panoramica.invalidate();
      utils.unidades.list.invalidate();
      setLocation("/panoramica");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const parseExcelDate = (value: any): Date | undefined => {
    if (!value) return undefined;
    
    // Si es un número (fecha de Excel)
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      return new Date(date.y, date.m - 1, date.d);
    }
    
    // Si es string, intentar parsear
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    
    return undefined;
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Encontrar encabezados (primera fila con datos)
      let headerRow = 0;
      for (let i = 0; i < jsonData.length; i++) {
        if (jsonData[i].some(cell => cell)) {
          headerRow = i;
          break;
        }
      }

      const headers = jsonData[headerRow].map((h: any) => 
        String(h || '').toLowerCase().trim()
      );

      // Mapear columnas
      const colMap = {
        nombre: headers.findIndex((h: string) => h.includes('nombre') || h.includes('unidad')),
        codigo: headers.findIndex((h: string) => h.includes('codigo') || h.includes('código')),
        nivel: headers.findIndex((h: string) => h.includes('nivel') || h.includes('piso') || h.includes('floor')),
        fechaInicio: headers.findIndex((h: string) => h.includes('inicio') || h.includes('start')),
        fechaFin: headers.findIndex((h: string) => h.includes('fin') || h.includes('end') || h.includes('termino')),
      };

      if (colMap.nombre === -1) {
        toast.error("No se encontró la columna 'Nombre' o 'Unidad' en el archivo");
        setPreview([]);
        setIsProcessing(false);
        return;
      }

      // Procesar filas de datos
      const unidades: UnidadPreview[] = [];
      for (let i = headerRow + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || !row[colMap.nombre]) continue;

        const nombre = String(row[colMap.nombre]).trim();
        if (!nombre) continue;

        const unidad: UnidadPreview = {
          nombre,
          codigo: colMap.codigo >= 0 ? String(row[colMap.codigo] || '').trim() || undefined : undefined,
          nivel: colMap.nivel >= 0 ? parseInt(String(row[colMap.nivel])) || 1 : 1,
          fechaInicio: colMap.fechaInicio >= 0 ? parseExcelDate(row[colMap.fechaInicio]) : undefined,
          fechaFin: colMap.fechaFin >= 0 ? parseExcelDate(row[colMap.fechaFin]) : undefined,
          valid: true,
        };

        // Validaciones
        if (!unidad.nombre) {
          unidad.valid = false;
          unidad.error = "Nombre requerido";
        }

        unidades.push(unidad);
      }

      setPreview(unidades);
      toast.success(`Se encontraron ${unidades.length} unidades en el archivo`);
    } catch (error) {
      console.error("Error al procesar Excel:", error);
      toast.error("Error al procesar el archivo Excel");
      setPreview([]);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleImport = () => {
    if (!selectedProjectId) {
      toast.error("Selecciona un proyecto primero");
      return;
    }

    const validUnidades = preview.filter(u => u.valid);
    if (validUnidades.length === 0) {
      toast.error("No hay unidades válidas para importar");
      return;
    }

    importMutation.mutate({
      proyectoId: selectedProjectId,
      unidades: validUnidades.map(u => ({
        nombre: u.nombre,
        codigo: u.codigo,
        nivel: u.nivel,
        fechaInicio: u.fechaInicio,
        fechaFin: u.fechaFin,
      })),
    });
  };

  const handleClear = () => {
    setFile(null);
    setPreview([]);
  };

  const downloadTemplate = () => {
    const template = [
      ["Nombre", "Código", "Nivel", "Fecha Inicio", "Fecha Fin"],
      ["Depto 101", "D-101", 1, "2024-01-15", "2024-03-15"],
      ["Depto 102", "D-102", 1, "2024-01-15", "2024-03-15"],
      ["Depto 201", "D-201", 2, "2024-02-01", "2024-04-01"],
      ["Depto 202", "D-202", 2, "2024-02-01", "2024-04-01"],
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Unidades");
    XLSX.writeFile(wb, "plantilla_unidades.xlsx");
    toast.success("Plantilla descargada");
  };

  if (!selectedProjectId) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <FileSpreadsheet className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Selecciona un Proyecto</h2>
          <p className="text-muted-foreground">
            Usa el selector de proyecto en el menú lateral para importar unidades.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const validCount = preview.filter(u => u.valid).length;
  const invalidCount = preview.filter(u => !u.valid).length;

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/panoramica")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Upload className="h-6 w-6 text-primary" />
              Importar Unidades desde Excel
            </h1>
            <p className="text-muted-foreground">
              Sube un archivo Excel con las unidades del proyecto
            </p>
          </div>
        </div>

        {/* Instrucciones */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Formato del archivo</CardTitle>
            <CardDescription>
              El archivo Excel debe contener las siguientes columnas:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="font-medium">Nombre *</p>
                <p className="text-xs text-muted-foreground">Requerido</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="font-medium">Código</p>
                <p className="text-xs text-muted-foreground">Opcional</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="font-medium">Nivel</p>
                <p className="text-xs text-muted-foreground">Piso/Nivel</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="font-medium">Fecha Inicio</p>
                <p className="text-xs text-muted-foreground">Opcional</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="font-medium">Fecha Fin</p>
                <p className="text-xs text-muted-foreground">Opcional</p>
              </div>
            </div>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Descargar Plantilla
            </Button>
          </CardContent>
        </Card>

        {/* Subir archivo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Subir archivo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="excel-file" className="sr-only">Archivo Excel</Label>
                  <Input
                    id="excel-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    disabled={isProcessing}
                  />
                </div>
                {file && (
                  <Button variant="outline" size="icon" onClick={handleClear}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {file && (
                <Alert>
                  <FileSpreadsheet className="h-4 w-4" />
                  <AlertDescription>
                    Archivo: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        {preview.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">Vista previa</CardTitle>
                  <CardDescription>
                    {validCount} válidas, {invalidCount} con errores
                  </CardDescription>
                </div>
                <Button 
                  onClick={handleImport} 
                  disabled={validCount === 0 || importMutation.isPending}
                >
                  {importMutation.isPending ? (
                    <>Importando...</>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Importar {validCount} unidades
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estado</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Nivel</TableHead>
                      <TableHead>Fecha Inicio</TableHead>
                      <TableHead>Fecha Fin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((unidad, idx) => (
                      <TableRow key={idx} className={!unidad.valid ? "bg-red-50" : ""}>
                        <TableCell>
                          {unidad.valid ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{unidad.nombre}</TableCell>
                        <TableCell>{unidad.codigo || "-"}</TableCell>
                        <TableCell>{unidad.nivel || 1}</TableCell>
                        <TableCell>
                          {unidad.fechaInicio 
                            ? new Date(unidad.fechaInicio).toLocaleDateString() 
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {unidad.fechaFin 
                            ? new Date(unidad.fechaFin).toLocaleDateString() 
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
