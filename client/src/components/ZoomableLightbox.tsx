import { useState, useRef, useCallback, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Download } from "lucide-react";

interface ZoomableLightboxProps {
  /** URL de la imagen actual (retrocompatible con uso simple) */
  url: string;
  onClose: () => void;
  /** Lista de URLs para navegación entre fotos */
  gallery?: string[];
  /** Índice inicial en la galería */
  initialIndex?: number;
  /** Callback cuando cambia la foto en la galería */
  onIndexChange?: (index: number) => void;
}

export function ZoomableLightbox({ url, onClose, gallery, initialIndex, onIndexChange }: ZoomableLightboxProps) {
  const urls = gallery && gallery.length > 0 ? gallery : [url];
  const [currentIndex, setCurrentIndex] = useState(initialIndex ?? 0);
  const currentUrl = urls[currentIndex] || url;
  const hasMultiple = urls.length > 1;

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPinchDist, setLastPinchDist] = useState<number | null>(null);
  const [isPinching, setIsPinching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const lastTapTimeRef = useRef(0);
  const doubleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const MIN_SCALE = 0.5;
  const MAX_SCALE = 5;

  const resetView = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= urls.length) return;
    setCurrentIndex(idx);
    resetView();
    onIndexChange?.(idx);
  }, [urls.length, resetView, onIndexChange]);

  const goPrev = useCallback(() => goTo(currentIndex - 1), [goTo, currentIndex]);
  const goNext = useCallback(() => goTo(currentIndex + 1), [goTo, currentIndex]);

  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(s * 1.4, MAX_SCALE));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => {
      const newScale = Math.max(s / 1.4, MIN_SCALE);
      if (newScale <= 1) setPosition({ x: 0, y: 0 });
      return newScale;
    });
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(currentUrl);
      const blob = await response.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const ext = currentUrl.split(".").pop()?.split("?")[0] || "jpg";
      a.download = `foto_${currentIndex + 1}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch {
      // Fallback: open in new tab
      window.open(currentUrl, "_blank");
    }
  }, [currentUrl, currentIndex]);

  // Scroll wheel zoom (desktop)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((s) => Math.min(Math.max(s * delta, MIN_SCALE), MAX_SCALE));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // Mouse drag (desktop)
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

  // Touch: pinch zoom + single finger drag
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsPinching(true);
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

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isPinching) {
      setIsPinching(false);
      setLastPinchDist(null);
      setIsDragging(false);
      return;
    }

    setLastPinchDist(null);
    setIsDragging(false);

    // Double tap detection
    if (e.changedTouches.length === 1) {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTimeRef.current;

      if (timeSinceLastTap < 350 && timeSinceLastTap > 50) {
        e.preventDefault();
        if (doubleTapTimerRef.current) {
          clearTimeout(doubleTapTimerRef.current);
          doubleTapTimerRef.current = null;
        }
        if (scale > 1.2) {
          resetView();
        } else {
          setScale(2.5);
          setPosition({ x: 0, y: 0 });
        }
        lastTapTimeRef.current = 0;
      } else {
        lastTapTimeRef.current = now;
      }
    }
  }, [scale, resetView, isPinching]);

  // Keyboard: Escape, +/-, arrows
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") handleZoomIn();
      if (e.key === "-") handleZoomOut();
      if (e.key === "0") resetView();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, handleZoomIn, handleZoomOut, resetView, goPrev, goNext]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Cleanup timer
  useEffect(() => {
    return () => { if (doubleTapTimerRef.current) clearTimeout(doubleTapTimerRef.current); };
  }, []);

  // Prevent browser zoom on multi-touch
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const preventDefault = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    el.addEventListener("touchmove", preventDefault, { passive: false });
    return () => el.removeEventListener("touchmove", preventDefault);
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current) onClose();
  }, [onClose]);

  const zoomPercent = Math.round(scale * 100);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center select-none"
      onClick={handleBackdropClick}
      style={{ touchAction: "none" }}
    >
      {/* Top bar */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
        {/* Left: zoom % + counter */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="bg-black/70 border border-white/30 text-white px-3 py-2 rounded-full text-sm font-bold min-w-[60px] text-center">
            {zoomPercent}%
          </div>
          {hasMultiple && (
            <div className="bg-black/70 border border-white/30 text-white px-3 py-2 rounded-full text-sm font-bold">
              {currentIndex + 1}/{urls.length}
            </div>
          )}
        </div>

        {/* Right: download + close */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={handleDownload}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-black/70 border border-white/30 text-white active:bg-white/30 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}
            title="Descargar foto"
          >
            <Download className="h-5 w-5" />
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-black/70 border border-white/30 text-white active:bg-white/30 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Navigation arrows */}
      {hasMultiple && currentIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center w-12 h-12 rounded-full bg-black/70 border border-white/30 text-white active:bg-white/30 transition-colors"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
      )}
      {hasMultiple && currentIndex < urls.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center w-12 h-12 rounded-full bg-black/70 border border-white/30 text-white active:bg-white/30 transition-colors"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      )}

      {/* Bottom zoom controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-black/70 border border-white/30 backdrop-blur-sm rounded-full px-3 py-2">
        <button
          onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
          disabled={scale <= MIN_SCALE}
          className="flex items-center justify-center w-11 h-11 rounded-full text-white bg-white/10 active:bg-white/30 disabled:opacity-30 transition-colors"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <ZoomOut className="h-6 w-6" />
        </button>

        <div className="w-20 sm:w-28 h-1.5 bg-white/20 rounded-full relative">
          <div
            className="absolute top-0 left-0 h-full bg-white rounded-full"
            style={{ width: `${Math.min(((scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE)) * 100, 100)}%` }}
          />
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
          disabled={scale >= MAX_SCALE}
          className="flex items-center justify-center w-11 h-11 rounded-full text-white bg-white/10 active:bg-white/30 disabled:opacity-30 transition-colors"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <ZoomIn className="h-6 w-6" />
        </button>

        <div className="w-px h-8 bg-white/30" />

        <button
          onClick={(e) => { e.stopPropagation(); resetView(); }}
          className="flex items-center justify-center w-11 h-11 rounded-full text-white bg-white/10 active:bg-white/30 transition-colors"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <RotateCcw className="h-5 w-5" />
        </button>
      </div>

      {/* Double tap hint */}
      <DoubleTapHint />

      {/* Image container */}
      <div
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
      >
        <img
          ref={imgRef}
          src={currentUrl}
          alt="Foto ampliada"
          className="max-w-[95vw] max-h-[80vh] object-contain rounded-lg shadow-2xl"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: isDragging || isPinching ? "none" : "transform 0.15s ease-out",
          }}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Thumbnail strip for gallery */}
      {hasMultiple && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 bg-black/60 border border-white/20 rounded-lg px-2 py-1.5 max-w-[90vw] overflow-x-auto">
          {urls.map((u, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); goTo(i); }}
              className={`w-10 h-10 rounded-md overflow-hidden flex-shrink-0 border-2 transition-all ${
                i === currentIndex ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <img src={u} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DoubleTapHint() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none animate-pulse">
      <div className="bg-black/70 border border-white/30 text-white text-sm px-4 py-2 rounded-lg text-center whitespace-nowrap">
        Doble tap para ampliar
      </div>
    </div>
  );
}
