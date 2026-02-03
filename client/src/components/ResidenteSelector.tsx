import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Search, Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Residente {
  id: number;
  name: string;
  empresaId: number;
  empresaNombre: string;
  especialidadId: number | null;
  tipoResidente?: string;
}

interface ResidenteSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  residentes: Residente[];
  placeholder?: string;
  className?: string;
}

export default function ResidenteSelector({
  value,
  onValueChange,
  residentes,
  placeholder = "Seleccionar Residente *",
  className,
}: ResidenteSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Encontrar el residente seleccionado
  const selectedResidente = residentes.find(r => r.id.toString() === value);

  // Filtrar residentes por búsqueda
  const filteredResidentes = residentes.filter(r => {
    const searchLower = searchTerm.toLowerCase();
    return (
      r.name.toLowerCase().includes(searchLower) ||
      r.empresaNombre.toLowerCase().includes(searchLower)
    );
  });

  // Limpiar búsqueda al cerrar
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  const handleSelect = (residenteId: string) => {
    onValueChange(residenteId);
    setIsOpen(false);
  };

  return (
    <>
      {/* Botón trigger que abre el drawer */}
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        className={cn(
          "w-full justify-between h-9 text-xs font-normal",
          !value && "text-muted-foreground",
          className
        )}
        onClick={() => setIsOpen(true)}
      >
        <div className="flex items-center gap-1 truncate">
          <User className="h-3 w-3 text-gray-400 shrink-0" />
          {selectedResidente ? (
            <span className="truncate">
              {selectedResidente.name}{" "}
              <span className="text-gray-400">({selectedResidente.empresaNombre})</span>
            </span>
          ) : (
            <span>{placeholder}</span>
          )}
        </div>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
      </Button>

      {/* Drawer que se abre desde abajo - funciona perfecto en móvil */}
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-lg font-semibold text-[#002C63]">
                Seleccionar Residente
              </DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
            {/* Barra de búsqueda */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre o empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10"
                autoFocus
              />
            </div>
          </DrawerHeader>

          {/* Lista de residentes */}
          <ScrollArea className="flex-1 px-4 py-2" style={{ maxHeight: 'calc(85vh - 140px)' }}>
            <div className="space-y-1">
              {filteredResidentes.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No se encontraron residentes</p>
                </div>
              ) : (
                filteredResidentes.map((residente) => {
                  const isSelected = residente.id.toString() === value;
                  return (
                    <button
                      key={`${residente.id}-${residente.empresaId}`}
                      type="button"
                      onClick={() => handleSelect(residente.id.toString())}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors",
                        isSelected
                          ? "bg-[#02B381]/10 border-2 border-[#02B381]"
                          : "hover:bg-gray-100 border-2 border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm",
                          isSelected ? "bg-[#02B381]" : "bg-gray-400"
                        )}>
                          {residente.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className={cn(
                            "font-medium text-sm",
                            isSelected && "text-[#02B381]"
                          )}>
                            {residente.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {residente.empresaNombre}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="h-5 w-5 text-[#02B381]" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </>
  );
}
