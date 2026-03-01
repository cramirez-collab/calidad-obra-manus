import { useState, useRef, useCallback, useEffect } from "react";
import { X, Pencil, Eraser, Undo2, Palette, Download, Trash2, ZoomIn, ZoomOut, Save } from "lucide-react";

interface DrawableCanvasProps {
  imageUrl: string;
  onClose: () => void;
  onSave?: (dataUrl: string) => void;
  title?: string;
}

const COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#000000", // black
  "#ffffff", // white
];

const BRUSH_SIZES = [2, 4, 8, 12, 20];

export function DrawableCanvas({ imageUrl, onClose, onSave, title }: DrawableCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState("#ef4444");
  const [brushSize, setBrushSize] = useState(4);
  const [showColors, setShowColors] = useState(false);
  const [showBrushSizes, setShowBrushSizes] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Load image and setup canvas
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Size canvas to fit container while maintaining aspect ratio
      const container = containerRef.current;
      if (!container) return;

      const maxW = container.clientWidth - 16;
      const maxH = container.clientHeight - 120; // space for toolbar
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);

      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Save initial state
      const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([initialState]);
      setImageLoaded(true);
    };
    img.onerror = () => {
      // Try without crossOrigin
      const img2 = new Image();
      img2.onload = () => {
        imgRef.current = img2;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const container = containerRef.current;
        if (!container) return;
        const maxW = container.clientWidth - 16;
        const maxH = container.clientHeight - 120;
        const ratio = Math.min(maxW / img2.width, maxH / img2.height, 1);
        canvas.width = img2.width * ratio;
        canvas.height = img2.height * ratio;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img2, 0, 0, canvas.width, canvas.height);
        const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory([initialState]);
        setImageLoaded(true);
      };
      img2.src = imageUrl;
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const getCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const drawLine = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = tool === "eraser" ? "rgba(255,255,255,0)" : color;
    ctx.lineWidth = brushSize * (tool === "eraser" ? 3 : 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
    }

    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }, [tool, color, brushSize]);

  const startDrawing = useCallback((clientX: number, clientY: number) => {
    const point = getCanvasPoint(clientX, clientY);
    lastPointRef.current = point;
    setIsDrawing(true);

    // Draw a dot for single taps
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
    }
    ctx.beginPath();
    ctx.arc(point.x, point.y, (brushSize * (tool === "eraser" ? 3 : 1)) / 2, 0, Math.PI * 2);
    ctx.fillStyle = tool === "eraser" ? "rgba(255,255,255,0)" : color;
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }, [getCanvasPoint, tool, color, brushSize]);

  const draw = useCallback((clientX: number, clientY: number) => {
    if (!isDrawing || !lastPointRef.current) return;
    const point = getCanvasPoint(clientX, clientY);
    drawLine(lastPointRef.current, point);
    lastPointRef.current = point;
  }, [isDrawing, getCanvasPoint, drawLine]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPointRef.current = null;

    // Save state to history
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const state = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev.slice(-20), state]); // Keep last 20 states
  }, [isDrawing]);

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startDrawing(e.clientX, e.clientY);
  }, [startDrawing]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    draw(e.clientX, e.clientY);
  }, [draw]);

  const handleMouseUp = useCallback(() => {
    stopDrawing();
  }, [stopDrawing]);

  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      startDrawing(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, [startDrawing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      draw(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, [draw]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    stopDrawing();
  }, [stopDrawing]);

  // Undo
  const handleUndo = useCallback(() => {
    if (history.length <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const newHistory = history.slice(0, -1);
    const prevState = newHistory[newHistory.length - 1];
    ctx.putImageData(prevState, 0, 0);
    setHistory(newHistory);
  }, [history]);

  // Clear all drawings (restore original image)
  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);

    const state = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([state]);
  }, []);

  // Download
  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `plano-anotado-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // Save (send back annotated image)
  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onSave) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
  }, [onSave]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); handleUndo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, handleUndo]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col" ref={containerRef}>
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/80 border-b border-white/20 flex-shrink-0">
        <div className="flex items-center gap-1">
          {title && <span className="text-white text-sm font-medium mr-2 hidden sm:block">{title}</span>}

          {/* Pen tool */}
          <button
            onClick={() => { setTool("pen"); setShowColors(false); setShowBrushSizes(false); }}
            className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
              tool === "pen" ? "bg-white/30 text-white" : "bg-white/10 text-white/70"
            }`}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <Pencil className="w-5 h-5" />
          </button>

          {/* Eraser tool */}
          <button
            onClick={() => { setTool("eraser"); setShowColors(false); setShowBrushSizes(false); }}
            className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
              tool === "eraser" ? "bg-white/30 text-white" : "bg-white/10 text-white/70"
            }`}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <Eraser className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-white/30 mx-1" />

          {/* Color picker */}
          <button
            onClick={() => { setShowColors(!showColors); setShowBrushSizes(false); }}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <div className="w-6 h-6 rounded-full border-2 border-white/50" style={{ backgroundColor: color }} />
          </button>

          {/* Brush size */}
          <button
            onClick={() => { setShowBrushSizes(!showBrushSizes); setShowColors(false); }}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 text-white/70 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <div className="rounded-full bg-white" style={{ width: Math.min(brushSize * 2, 20), height: Math.min(brushSize * 2, 20) }} />
          </button>

          <div className="w-px h-6 bg-white/30 mx-1" />

          {/* Undo */}
          <button
            onClick={handleUndo}
            disabled={history.length <= 1}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 text-white/70 disabled:opacity-30 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <Undo2 className="w-5 h-5" />
          </button>

          {/* Clear */}
          <button
            onClick={handleClear}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 text-white/70 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Download */}
          <button
            onClick={handleDownload}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 text-white/70 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <Download className="w-5 h-5" />
          </button>

          {/* Save if callback provided */}
          {onSave && (
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 h-10 rounded-lg bg-emerald-600 text-white text-sm font-medium transition-colors active:bg-emerald-700"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">Guardar</span>
            </button>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 text-white transition-colors active:bg-white/30"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Color picker dropdown */}
      {showColors && (
        <div className="absolute top-14 left-28 z-50 bg-gray-900 border border-white/20 rounded-lg p-2 flex gap-1.5 flex-wrap max-w-[200px]">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => { setColor(c); setShowColors(false); }}
              className={`w-9 h-9 rounded-full border-2 transition-transform ${
                c === color ? "border-white scale-110" : "border-white/30"
              }`}
              style={{ backgroundColor: c, WebkitTapHighlightColor: "transparent" }}
            />
          ))}
        </div>
      )}

      {/* Brush size dropdown */}
      {showBrushSizes && (
        <div className="absolute top-14 left-40 z-50 bg-gray-900 border border-white/20 rounded-lg p-2 flex gap-2 items-center">
          {BRUSH_SIZES.map(s => (
            <button
              key={s}
              onClick={() => { setBrushSize(s); setShowBrushSizes(false); }}
              className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                s === brushSize ? "bg-white/30" : "bg-white/10"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <div className="rounded-full bg-white" style={{ width: Math.min(s * 2, 24), height: Math.min(s * 2, 24) }} />
            </button>
          ))}
        </div>
      )}

      {/* Canvas area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
        {!imageLoaded && (
          <div className="text-white text-sm animate-pulse">Cargando imagen...</div>
        )}
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full rounded-lg shadow-2xl"
          style={{
            touchAction: "none",
            cursor: tool === "pen" ? "crosshair" : "cell",
            display: imageLoaded ? "block" : "none",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>

      {/* Bottom hint */}
      <div className="flex-shrink-0 text-center py-1.5 text-white/40 text-xs">
        Dibuja con el dedo o mouse sobre el plano &bull; Pellizca para zoom
      </div>
    </div>
  );
}
