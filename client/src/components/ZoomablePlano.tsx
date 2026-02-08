import { useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface ZoomablePlanoProps {
  imagenUrl: string;
  nombre: string;
  /** Si true, click coloca pin en vez de hacer zoom */
  editingPin?: boolean;
  /** Posición del pin en % (0-100) */
  pinX?: number | string | null;
  pinY?: number | string | null;
  /** Código del ítem para mostrar en el label del pin */
  itemCodigo?: string;
  /** Color del pin: 'red' | 'yellow' */
  pinColor?: "red" | "yellow";
  /** Callback cuando se hace click para colocar pin */
  onPinPlace?: (x: number, y: number) => void;
  /** Ref para la imagen (usado en NuevoItem) */
  imgRef?: React.RefObject<HTMLImageElement | null>;
  /** Clase CSS adicional para el contenedor */
  className?: string;
}

export default function ZoomablePlano({
  imagenUrl,
  nombre,
  editingPin = false,
  pinX,
  pinY,
  itemCodigo,
  pinColor = "red",
  onPinPlace,
  imgRef: externalImgRef,
  className = "",
}: ZoomablePlanoProps) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const internalImgRef = useRef<HTMLImageElement>(null);
  const imgRef = externalImgRef || internalImgRef;

  // Touch state
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);
  const isPanning = useRef(false);
  const lastPanPos = useRef<{ x: number; y: number } | null>(null);
  const lastTapTime = useRef(0);
  const lastTapPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Clamp scale
  const MIN_SCALE = 1;
  const MAX_SCALE = 5;

  const clampScale = useCallback((s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s)), []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    setScale((s) => clampScale(s * 1.5));
  }, [clampScale]);

  const zoomOut = useCallback(() => {
    const newScale = clampScale(scale / 1.5);
    setScale(newScale);
    if (newScale <= 1) setTranslate({ x: 0, y: 0 });
  }, [scale, clampScale]);

  // Clamp translate to keep image in bounds
  const clampTranslate = useCallback(
    (tx: number, ty: number, s: number) => {
      if (s <= 1) return { x: 0, y: 0 };
      const container = containerRef.current;
      if (!container) return { x: tx, y: ty };
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const maxX = (cw * (s - 1)) / 2;
      const maxY = (ch * (s - 1)) / 2;
      return {
        x: Math.min(maxX, Math.max(-maxX, tx)),
        y: Math.min(maxY, Math.max(-maxY, ty)),
      };
    },
    []
  );

  // Get distance between two touches
  const getTouchDistance = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (t1: React.Touch, t2: React.Touch) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  });

  // Handle click/tap for pin placement
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // If zoomed in and not editing, ignore (it was probably a pan end)
      if (!editingPin && scale > 1) return;

      if (editingPin && onPinPlace && imgRef.current) {
        const rect = imgRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
          onPinPlace(x, y);
        }
      }
    },
    [editingPin, onPinPlace, imgRef, scale]
  );

  // Double tap to zoom
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      // Reset pinch state
      lastTouchDistance.current = null;
      lastTouchCenter.current = null;
      isPanning.current = false;
      lastPanPos.current = null;

      if (e.touches.length > 0) return;

      const now = Date.now();
      const touch = e.changedTouches[0];
      const tapPos = { x: touch.clientX, y: touch.clientY };
      const timeDiff = now - lastTapTime.current;
      const posDiff = Math.abs(tapPos.x - lastTapPos.current.x) + Math.abs(tapPos.y - lastTapPos.current.y);

      if (timeDiff < 350 && posDiff < 50 && !editingPin) {
        // Double tap detected
        e.preventDefault();
        if (scale > 1.5) {
          // Zoom out
          resetZoom();
        } else {
          // Zoom in to 3x centered on tap point
          const container = containerRef.current;
          if (container) {
            const rect = container.getBoundingClientRect();
            const cx = tapPos.x - rect.left - rect.width / 2;
            const cy = tapPos.y - rect.top - rect.height / 2;
            const newScale = 3;
            const newTranslate = clampTranslate(-cx * (newScale - 1), -cy * (newScale - 1), newScale);
            setScale(newScale);
            setTranslate(newTranslate);
          }
        }
      }

      lastTapTime.current = now;
      lastTapPos.current = tapPos;
    },
    [scale, editingPin, resetZoom, clampTranslate]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Start pinch
      lastTouchDistance.current = getTouchDistance(e.touches[0], e.touches[1]);
      lastTouchCenter.current = getTouchCenter(e.touches[0], e.touches[1]);
      e.preventDefault();
    } else if (e.touches.length === 1 && scale > 1) {
      // Start pan
      isPanning.current = true;
      lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, [scale]);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && lastTouchDistance.current !== null) {
        // Pinch zoom
        e.preventDefault();
        const newDist = getTouchDistance(e.touches[0], e.touches[1]);
        const newCenter = getTouchCenter(e.touches[0], e.touches[1]);
        const ratio = newDist / lastTouchDistance.current;
        const newScale = clampScale(scale * ratio);

        // Pan while pinching
        if (lastTouchCenter.current) {
          const dx = newCenter.x - lastTouchCenter.current.x;
          const dy = newCenter.y - lastTouchCenter.current.y;
          const newTranslate = clampTranslate(translate.x + dx, translate.y + dy, newScale);
          setTranslate(newTranslate);
        }

        setScale(newScale);
        lastTouchDistance.current = newDist;
        lastTouchCenter.current = newCenter;
      } else if (e.touches.length === 1 && isPanning.current && lastPanPos.current && scale > 1) {
        // Pan
        const dx = e.touches[0].clientX - lastPanPos.current.x;
        const dy = e.touches[0].clientY - lastPanPos.current.y;
        const newTranslate = clampTranslate(translate.x + dx, translate.y + dy, scale);
        setTranslate(newTranslate);
        lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        e.preventDefault();
      }
    },
    [scale, translate, clampScale, clampTranslate]
  );

  // Mouse wheel zoom (desktop)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = clampScale(scale * delta);
      setScale(newScale);
      if (newScale <= 1) setTranslate({ x: 0, y: 0 });
      else {
        const rect = container.getBoundingClientRect();
        const cx = e.clientX - rect.left - rect.width / 2;
        const cy = e.clientY - rect.top - rect.height / 2;
        const newT = clampTranslate(
          translate.x - cx * (delta - 1),
          translate.y - cy * (delta - 1),
          newScale
        );
        setTranslate(newT);
      }
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [scale, translate, clampScale, clampTranslate]);

  const pinFill = pinColor === "yellow" ? "#f59e0b" : "#ef4444";
  const pinStroke = pinColor === "yellow" ? "#d97706" : "#dc2626";

  return (
    <div className={`relative ${className}`}>
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-20 flex flex-col gap-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); zoomIn(); }}
          className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm"
          title="Acercar"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); zoomOut(); }}
          className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm"
          title="Alejar"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        {scale > 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); resetZoom(); }}
            className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm"
            title="Restablecer zoom"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Scale indicator */}
      {scale > 1 && (
        <div className="absolute bottom-2 left-2 z-20 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm">
          {scale.toFixed(1)}x
        </div>
      )}

      {/* Zoomable container */}
      <div
        ref={containerRef}
        className={`overflow-hidden ${editingPin ? "cursor-crosshair" : scale > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{ touchAction: "none" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        <div
          className="relative"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: isPanning.current || lastTouchDistance.current ? "none" : "transform 0.2s ease-out",
          }}
        >
          <img
            ref={imgRef as React.RefObject<HTMLImageElement>}
            src={imagenUrl}
            alt={nombre}
            className="max-w-full max-h-[80vh] object-contain"
            draggable={false}
          />
          {/* Pin */}
          {pinX != null && pinY != null && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: `${pinX}%`,
                top: `${pinY}%`,
                transform: "translate(-50%, -100%)",
                zIndex: 10,
              }}
            >
              <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
                <path
                  d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z"
                  fill={pinFill}
                  stroke={pinStroke}
                  strokeWidth="2"
                />
                <circle cx="14" cy="13" r="5" fill="white" fillOpacity="0.9" />
              </svg>
              {itemCodigo && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap">
                  {itemCodigo}
                </div>
              )}
            </div>
          )}
          {/* Placeholder when editing and no pin */}
          {editingPin && pinX == null && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/60 text-white px-4 py-2 rounded-lg text-sm">
                Toca el plano para colocar el pin
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
