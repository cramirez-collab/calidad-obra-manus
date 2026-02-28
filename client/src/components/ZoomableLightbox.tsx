import { useState, useRef, useCallback, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ZoomableLightboxProps {
  url: string;
  onClose: () => void;
}

export function ZoomableLightbox({ url, onClose }: ZoomableLightboxProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPinchDist, setLastPinchDist] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 5;

  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(s * 1.3, MAX_SCALE));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(s / 1.3, MIN_SCALE));
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Scroll wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.min(Math.max(s * delta, MIN_SCALE), MAX_SCALE));
  }, []);

  // Mouse drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch pinch zoom + drag
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setLastPinchDist(dist);
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  }, [scale, position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDist !== null) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / lastPinchDist;
      setScale((s) => Math.min(Math.max(s * ratio, MIN_SCALE), MAX_SCALE));
      setLastPinchDist(dist);
    } else if (e.touches.length === 1 && isDragging) {
      e.preventDefault();
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  }, [lastPinchDist, isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setLastPinchDist(null);
    setIsDragging(false);
  }, []);

  // Double tap to zoom
  const lastTapRef = useRef(0);
  const handleDoubleTap = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      if (scale > 1.5) {
        handleReset();
      } else {
        setScale(2.5);
      }
    }
    lastTapRef.current = now;
  }, [scale, handleReset]);

  // Keyboard: Escape to close, +/- to zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") handleZoomIn();
      if (e.key === "-") handleZoomOut();
      if (e.key === "0") handleReset();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, handleZoomIn, handleZoomOut, handleReset]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      onClose();
    }
  }, [onClose]);

  const zoomPercent = Math.round(scale * 100);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center select-none"
      onClick={handleBackdropClick}
      onWheel={handleWheel}
      style={{ touchAction: "none" }}
    >
      {/* Top controls */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
        {/* Zoom indicator */}
        <div className="bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-medium pointer-events-auto">
          {zoomPercent}%
        </div>

        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 pointer-events-auto"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Bottom zoom controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-white hover:bg-white/20"
          onClick={handleZoomOut}
          disabled={scale <= MIN_SCALE}
        >
          <ZoomOut className="h-5 w-5" />
        </Button>

        {/* Zoom slider visual */}
        <div className="w-24 h-1 bg-white/30 rounded-full relative mx-1">
          <div
            className="absolute top-0 left-0 h-full bg-white rounded-full transition-all duration-100"
            style={{ width: `${Math.min(((scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE)) * 100, 100)}%` }}
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-white hover:bg-white/20"
          onClick={handleZoomIn}
          disabled={scale >= MAX_SCALE}
        >
          <ZoomIn className="h-5 w-5" />
        </Button>

        <div className="w-px h-6 bg-white/30" />

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-white hover:bg-white/20"
          onClick={handleReset}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Image container */}
      <div
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={(e) => { handleTouchStart(e); handleDoubleTap(e); }}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
      >
        <img
          ref={imgRef}
          src={url}
          alt="Foto ampliada"
          className="max-w-[95vw] max-h-[85vh] object-contain rounded-lg shadow-2xl transition-transform duration-100"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
