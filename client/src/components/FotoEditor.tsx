import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Eraser, Undo2, Save, X, Minus, Plus } from "lucide-react";

interface FotoEditorProps {
  fotoUrl: string;
  onSave: (base64: string) => void;
  onCancel: () => void;
  saving?: boolean;
}

export default function FotoEditor({ fotoUrl, onSave, onCancel, saving }: FotoEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [lineWidth, setLineWidth] = useState(4);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Load image into canvas
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      // Fit to container width
      const maxW = container.clientWidth;
      const maxH = window.innerHeight * 0.6;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
      setImgLoaded(true);
    };
    img.src = fotoUrl;
  }, [fotoUrl]);

  const getPos = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    lastPosRef.current = pos;
  }, [getPos]);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    const pos = getPos(e);
    const last = lastPosRef.current || pos;

    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === "pen" ? "#EF4444" : "rgba(255,255,255,1)";
    ctx.lineWidth = tool === "eraser" ? lineWidth * 4 : lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";

    lastPosRef.current = pos;
  }, [isDrawing, tool, lineWidth, getPos]);

  const endDraw = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPosRef.current = null;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    setHistory(prev => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
  }, [isDrawing]);

  const undo = () => {
    if (history.length <= 1) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);
    ctx.putImageData(newHistory[newHistory.length - 1], 0, 0);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Redraw image + marks at full resolution for quality
    const img = imgRef.current;
    if (!img) return;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = img.width;
    exportCanvas.height = img.height;
    const ectx = exportCanvas.getContext("2d");
    if (!ectx) return;

    // Draw original image
    ectx.drawImage(img, 0, 0, img.width, img.height);
    // Draw marks on top (scale from canvas to full res)
    ectx.drawImage(canvas, 0, 0, img.width, img.height);

    const base64 = exportCanvas.toDataURL("image/png");
    onSave(base64);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 flex-wrap bg-muted/50 rounded-lg p-1.5">
        <Button
          size="sm"
          variant={tool === "pen" ? "default" : "outline"}
          onClick={() => setTool("pen")}
          className="h-8 px-2"
        >
          <Pencil className="w-3.5 h-3.5 mr-1" />
          <span className="text-[10px]">Lápiz</span>
        </Button>
        <Button
          size="sm"
          variant={tool === "eraser" ? "default" : "outline"}
          onClick={() => setTool("eraser")}
          className="h-8 px-2"
        >
          <Eraser className="w-3.5 h-3.5 mr-1" />
          <span className="text-[10px]">Borrar</span>
        </Button>
        <div className="flex items-center gap-1 ml-1">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setLineWidth(Math.max(1, lineWidth - 1))}>
            <Minus className="w-3 h-3" />
          </Button>
          <span className="text-[10px] w-4 text-center">{lineWidth}</span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setLineWidth(Math.min(12, lineWidth + 1))}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        <Button size="sm" variant="ghost" className="h-8 px-2 ml-auto" onClick={undo} disabled={history.length <= 1}>
          <Undo2 className="w-3.5 h-3.5 mr-1" />
          <span className="text-[10px]">Deshacer</span>
        </Button>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative w-full overflow-hidden rounded-lg border bg-black/5">
        {!imgLoaded && (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-xs">
            Cargando imagen...
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full touch-none cursor-crosshair"
          style={{ display: imgLoaded ? "block" : "none" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onCancel} className="flex-1 h-9" disabled={saving}>
          <X className="w-3.5 h-3.5 mr-1" /> Cancelar
        </Button>
        <Button size="sm" onClick={handleSave} className="flex-1 h-9 bg-red-600 hover:bg-red-700 text-white" disabled={saving || !imgLoaded}>
          <Save className="w-3.5 h-3.5 mr-1" /> {saving ? "Guardando..." : "Guardar Marcas"}
        </Button>
      </div>
    </div>
  );
}
