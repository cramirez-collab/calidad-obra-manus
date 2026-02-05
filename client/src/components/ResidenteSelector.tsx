import { useState, useEffect, useRef } from "react";
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
import { User, Search, Check, ChevronDown, X, AtSign } from "lucide-react";
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
  const [showMentionHint, setShowMentionHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Encontrar el residente seleccionado
  const selectedResidente = residentes.find(r => r.id.toString() === value);

  // Procesar búsqueda - remover @ si está presente
  const processedSearchTerm = searchTerm.startsWith("@") ? searchTerm.slice(1) : searchTerm;

  // Filtrar residentes por búsqueda
  const filteredResidentes = residentes.filter(r => {
    const searchLower = processedSearchTerm.toLowerCase();
    return (
      r.name.toLowerCase().includes(searchLower) ||
      r.empresaNombre.toLowerCase().includes(searchLower)
    );
  });

  // Limpiar búsqueda al cerrar
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setShowMentionHint(false);
    }
  }, [isOpen]);

  // Mostrar hint cuando se escribe @
  useEffect(() => {
    if (searchTerm.startsWith("@")) {
      setShowMentionHint(true);
    } else {
      setShowMentionHint(false);
    }
  }, [searchTerm]);

  const handleSelect = (residenteId: string) => {
    onValueChange(residenteId);
    setIsOpen(false);
  };

  // Insertar @ al hacer clic en el botón de mención
  const handleMentionClick = () => {
    setSearchTerm("@");
    inputRef.current?.focus();
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
          <DrawerHeader className="border-b pb-4 space-y-0">
            <div className="flex items-center justify-between mb-3">
              <DrawerTitle className="text-lg font-semibold text-[#002C63]">
                Seleccionar Residente
              </DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
            {/* Barra de búsqueda con @mentions */}
            <div className="relative z-50 bg-white">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
              <Input
                ref={inputRef}
                placeholder="Buscar o escribe @ para mencionar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  "pl-9 pr-10 h-10 relative z-20 bg-white border-[#02B381] focus:border-[#02B381] focus:ring-[#02B381]",
                  showMentionHint && "border-blue-500 focus:border-blue-500 focus:ring-blue-500"
                )}
                autoFocus
              />
              {/* Botón de @ para insertar mención */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 z-30",
                  showMentionHint && "text-blue-500"
                )}
                onClick={handleMentionClick}
                title="Mencionar con @"
              >
                <AtSign className="h-4 w-4" />
              </Button>
            </div>
            {/* Hint de @mentions */}
            {showMentionHint && (
              <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                <AtSign className="h-3 w-3" />
                Escribe el nombre del residente después de @
              </p>
            )}
          </DrawerHeader>

          {/* Lista de residentes - con margen superior para evitar encimamiento */}
          <ScrollArea className="flex-1 px-4 pt-4 pb-2" style={{ maxHeight: 'calc(85vh - 180px)' }}>
            <div className="space-y-1 mt-2">
              {filteredResidentes.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No se encontraron residentes</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Intenta con otro nombre o usa @nombre
                  </p>
                </div>
              ) : (
                <>
                  {/* Mostrar indicador de búsqueda con @ */}
                  {showMentionHint && processedSearchTerm && (
                    <div className="mb-2 px-2 py-1 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-center gap-1">
                      <AtSign className="h-3 w-3" />
                      Buscando: <span className="font-semibold">{processedSearchTerm}</span>
                    </div>
                  )}
                  {filteredResidentes.map((residente) => {
                    const isSelected = residente.id.toString() === value;
                    // Resaltar coincidencia con @
                    const highlightName = showMentionHint && processedSearchTerm;
                    
                    return (
                      <button
                        key={`${residente.id}-${residente.empresaId}`}
                        type="button"
                        onClick={() => handleSelect(residente.id.toString())}
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors",
                          isSelected
                            ? "bg-[#02B381]/10 border-2 border-[#02B381]"
                            : highlightName
                              ? "hover:bg-blue-50 border-2 border-blue-200"
                              : "hover:bg-gray-100 border-2 border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm",
                            isSelected ? "bg-[#02B381]" : highlightName ? "bg-blue-500" : "bg-gray-400"
                          )}>
                            {highlightName ? (
                              <AtSign className="h-5 w-5" />
                            ) : (
                              residente.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className={cn(
                              "font-medium text-sm",
                              isSelected && "text-[#02B381]",
                              highlightName && !isSelected && "text-blue-700"
                            )}>
                              {highlightName && <span className="text-blue-500">@</span>}
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
                  })}
                </>
              )}
            </div>
          </ScrollArea>
          
          {/* Footer con instrucciones */}
          <div className="border-t px-4 py-2 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              💡 Tip: Escribe <span className="font-mono bg-gray-200 px-1 rounded">@nombre</span> para buscar rápidamente
            </p>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
