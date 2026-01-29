import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Pencil, 
  Eraser, 
  RotateCcw, 
  Download, 
  ZoomIn, 
  ZoomOut,
  Circle
} from "lucide-react";

interface ImageMarkerProps {
  imageUrl: string;
  onSave: (markedImageBase64: string) => void;
  onCancel?: () => void;
  initialBrushSize?: number; // Tamaño inicial del pincel
  autoStartDrawing?: boolean; // Iniciar con lápiz activo
}

export default function ImageMarker({ imageUrl, onSave, onCancel, initialBrushSize = 5, autoStartDrawing = false }: ImageMarkerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [brushSize, setBrushSize] = useState(initialBrushSize);
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
      ctx.lineWidth = brushSize * 2;
    } else {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = brushSize * 4;
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
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Button
            variant={tool === "pen" ? "default" : "secondary"}
            size="sm"
            onClick={() => setTool("pen")}
            className={tool === "pen" ? "bg-red-600 hover:bg-red-700" : ""}
          >
            <Pencil className="h-4 w-4 mr-1" />
            Marcar
          </Button>
          <Button
            variant={tool === "eraser" ? "default" : "secondary"}
            size="sm"
            onClick={() => setTool("eraser")}
          >
            <Eraser className="h-4 w-4 mr-1" />
            Borrar
          </Button>
          
          <div className="h-6 w-px bg-slate-600 mx-2" />
          
          <div className="flex items-center gap-2 min-w-[150px]">
            <Circle className="h-4 w-4 text-slate-400" />
            <Slider
              value={[brushSize]}
              onValueChange={([value]) => setBrushSize(value)}
              min={1}
              max={20}
              step={1}
              className="w-24"
            />
            <span className="text-xs text-slate-400 w-6">{brushSize}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={historyIndex <= 0}
            className="text-slate-300"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetCanvas}
            className="text-slate-300"
          >
            Reiniciar
          </Button>
          
          <div className="h-6 w-px bg-slate-600 mx-2" />
          
          <Button variant="ghost" size="sm" onClick={zoomOut} className="text-slate-300">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-slate-400 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="ghost" size="sm" onClick={zoomIn} className="text-slate-300">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-950"
        style={{ minHeight: "400px" }}
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

      {/* Actions */}
      <div className="flex items-center justify-between p-3 bg-slate-800 border-t border-slate-700">
        <p className="text-xs text-slate-400">
          Usa el lápiz rojo para marcar las áreas con problemas
        </p>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} className="text-slate-300">
              Cancelar
            </Button>
          )}
          <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700">
            <Download className="h-4 w-4 mr-2" />
            Guardar Marcado
          </Button>
        </div>
      </div>
    </div>
  );
}
