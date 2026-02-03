import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { 
  Pencil, 
  Eraser, 
  RotateCcw, 
  Check,
  X,
  ZoomIn, 
  ZoomOut
} from "lucide-react";

interface ImageMarkerProps {
  imageUrl: string;
  onSave: (markedImageBase64: string) => void;
  onCancel?: () => void;
}

// Ancho de lápiz fijo en 2 (más fino para precisión)
const BRUSH_SIZE = 2;

export default function ImageMarker({ imageUrl, onSave, onCancel }: ImageMarkerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [scale, setScale] = useState(1);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Cargar imagen
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      initCanvas();
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imageRef.current;
    if (!canvas || !container || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Ajustar tamaño del canvas al contenedor manteniendo aspecto
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight || 500;
    
    const imgAspect = img.width / img.height;
    const containerAspect = containerWidth / containerHeight;

    let canvasWidth, canvasHeight;
    if (imgAspect > containerAspect) {
      canvasWidth = containerWidth;
      canvasHeight = containerWidth / imgAspect;
    } else {
      canvasHeight = containerHeight;
      canvasWidth = containerHeight * imgAspect;
    }

    canvas.width = img.width;
    canvas.height = img.height;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    // Dibujar imagen base
    ctx.drawImage(img, 0, 0);

    // Guardar estado inicial
    const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([initialState]);
    setHistoryIndex(0);
  }, []);

  // Reinicializar cuando cambie el tamaño del contenedor
  useEffect(() => {
    if (imageLoaded) {
      initCanvas();
    }
  }, [imageLoaded, initCanvas]);

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const newState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const newIndex = historyIndex - 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  };

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([initialState]);
    setHistoryIndex(0);
  };

  const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const { x, y } = getCanvasCoordinates(e);
    draw(x, y, true);
  };

  const draw = (x: number, y: number, isStart: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (tool === "pen") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#FF0000"; // Tinta roja
      ctx.lineWidth = BRUSH_SIZE * 2;
    } else {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = BRUSH_SIZE * 4;
    }

    if (isStart) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      // Dibujar un punto
      ctx.lineTo(x + 0.1, y + 0.1);
      ctx.stroke();
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCanvasCoordinates(e);
    draw(x, y, false);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveState();
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Convertir a base64
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    onSave(dataUrl);
  };

  const zoomIn = () => setScale(Math.min(scale + 0.25, 3));
  const zoomOut = () => setScale(Math.max(scale - 0.25, 0.5));

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-lg overflow-hidden">
      {/* Toolbar simplificado */}
      <div className="flex items-center justify-between p-2 sm:p-3 bg-slate-800 border-b border-slate-700">
        {/* Herramientas izquierda */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant={tool === "pen" ? "default" : "secondary"}
            size="icon"
            onClick={() => setTool("pen")}
            className={`h-8 w-8 sm:h-9 sm:w-9 ${tool === "pen" ? "bg-red-600 hover:bg-red-700" : ""}`}
            title="Marcar"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant={tool === "eraser" ? "default" : "secondary"}
            size="icon"
            onClick={() => setTool("eraser")}
            className="h-8 w-8 sm:h-9 sm:w-9"
            title="Borrar"
          >
            <Eraser className="h-4 w-4" />
          </Button>
          
          <div className="h-6 w-px bg-slate-600 mx-1" />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={undo}
            disabled={historyIndex <= 0}
            className="h-8 w-8 sm:h-9 sm:w-9 text-slate-300"
            title="Deshacer"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom y acciones derecha */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={zoomOut} 
            className="h-8 w-8 sm:h-9 sm:w-9 text-slate-300 hidden sm:flex"
            title="Alejar"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={zoomIn} 
            className="h-8 w-8 sm:h-9 sm:w-9 text-slate-300 hidden sm:flex"
            title="Acercar"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <div className="h-6 w-px bg-slate-600 mx-1" />
          
          {onCancel && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onCancel} 
              className="h-8 w-8 sm:h-9 sm:w-9 text-slate-300"
              title="Cancelar"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button 
            size="icon"
            onClick={handleSave} 
            className="h-8 w-8 sm:h-9 sm:w-9 bg-emerald-600 hover:bg-emerald-700"
            title="Guardar"
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-2 sm:p-4 bg-slate-950"
        style={{ minHeight: "350px" }}
      >
        <div 
          style={{ 
            transform: `scale(${scale})`, 
            transformOrigin: "center",
            transition: "transform 0.2s ease"
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={handleMove}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={handleMove}
            onTouchEnd={stopDrawing}
            className="border border-slate-700 rounded cursor-crosshair touch-none"
            style={{ maxWidth: "100%", height: "auto" }}
          />
        </div>
      </div>

      {/* Footer con instrucción */}
      <div className="p-2 bg-slate-800 border-t border-slate-700">
        <p className="text-xs text-slate-400 text-center">
          Dibuja sobre la imagen para marcar el problema
        </p>
      </div>
    </div>
  );
}
