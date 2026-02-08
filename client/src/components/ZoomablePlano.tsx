import { useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2, Minimize2 } from "lucide-react";

export interface PlanoPin {
  id: number;
  codigo: string;
  descripcion?: string | null;
  status?: string | null;
  pinPosX: string | null;
  pinPosY: string | null;
  numeroInterno?: number | null;
}

interface ZoomablePlanoProps {
  imagenUrl: string;
  nombre: string;
  editingPin?: boolean;
  pinX?: number | string | null;
  pinY?: number | string | null;
  itemCodigo?: string;
  pinColor?: "red" | "yellow";
  onPinPlace?: (x: number, y: number) => void;
  imgRef?: React.RefObject<HTMLImageElement | null>;
  className?: string;
  allPins?: PlanoPin[];
  currentItemId?: number;
  onPinClick?: (itemId: number) => void;
}

function getStatusColor(status?: string | null) {
  switch (status) {
    case "aprobado": return { fill: "#22c55e", stroke: "#16a34a", bg: "bg-green-500" };
    case "rechazado": return { fill: "#ef4444", stroke: "#dc2626", bg: "bg-red-500" };
    case "pendiente_aprobacion": return { fill: "#f59e0b", stroke: "#d97706", bg: "bg-amber-500" };
    case "pendiente_foto_despues": return { fill: "#3b82f6", stroke: "#2563eb", bg: "bg-blue-500" };
    default: return { fill: "#6b7280", stroke: "#4b5563", bg: "bg-gray-500" };
  }
}

function getShortCode(pin: PlanoPin): string {
  if (pin.numeroInterno) return String(pin.numeroInterno);
  if (pin.codigo) {
    const parts = pin.codigo.split("-");
    return parts[parts.length - 1] || String(pin.id);
  }
  return String(pin.id);
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
  allPins = [],
  currentItemId,
  onPinClick,
}: ZoomablePlanoProps) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const internalImgRef = useRef<HTMLImageElement>(null);
  const imgRef = externalImgRef || internalImgRef;

  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);
  const isPanning = useRef(false);
  const lastPanPos = useRef<{ x: number; y: number } | null>(null);
  const lastTapTime = useRef(0);
  const lastTapPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const MIN_SCALE = 1;
  const MAX_SCALE = 8;

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

  const getTouchDistance = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (t1: React.Touch, t2: React.Touch) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  });

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
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

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
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

      // Double-tap: toggle fullscreen modal
      if (timeDiff < 350 && posDiff < 50 && !editingPin) {
        e.preventDefault();
        if (!isFullscreen) {
          setIsFullscreen(true);
          resetZoom();
        } else {
          // In fullscreen, double-tap zooms
          if (scale > 1.5) {
            resetZoom();
          } else {
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
      }

      // Single tap in editing mode
      if (editingPin && timeDiff >= 350 && onPinPlace && imgRef.current) {
        const rect = imgRef.current.getBoundingClientRect();
        const x = ((tapPos.x - rect.left) / rect.width) * 100;
        const y = ((tapPos.y - rect.top) / rect.height) * 100;
        if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
          onPinPlace(x, y);
        }
      }

      lastTapTime.current = now;
      lastTapPos.current = tapPos;
    },
    [scale, editingPin, isFullscreen, resetZoom, clampTranslate, onPinPlace, imgRef]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastTouchDistance.current = getTouchDistance(e.touches[0], e.touches[1]);
      lastTouchCenter.current = getTouchCenter(e.touches[0], e.touches[1]);
      e.preventDefault();
    } else if (e.touches.length === 1 && scale > 1) {
      isPanning.current = true;
      lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, [scale]);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && lastTouchDistance.current !== null) {
        e.preventDefault();
        const newDist = getTouchDistance(e.touches[0], e.touches[1]);
        const newCenter = getTouchCenter(e.touches[0], e.touches[1]);
        const ratio = newDist / lastTouchDistance.current;
        const newScale = clampScale(scale * ratio);
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

  // Close fullscreen on Escape
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
        resetZoom();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isFullscreen, resetZoom]);

  const pinFill = pinColor === "yellow" ? "#f59e0b" : "#ef4444";
  const pinStroke = pinColor === "yellow" ? "#d97706" : "#dc2626";

  const otherPins = allPins.filter((p) => p.id !== currentItemId && p.pinPosX && p.pinPosY);

  // Dynamic pin size based on scale
  const pinSize = Math.max(12, 18 / scale);
  const mainPinSize = Math.max(16, 24 / scale);
  const fontSize = Math.max(7, 9 / scale);
  const mainFontSize = Math.max(8, 10 / scale);

  const renderPlanoContent = () => (
    <div
      ref={containerRef}
      className={`overflow-hidden ${editingPin ? "cursor-crosshair" : scale > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{ touchAction: "none", width: "100%", height: "100%" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      <div
        className="relative w-full h-full flex items-center justify-center"
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
          className={isFullscreen ? "max-w-full max-h-full object-contain" : "max-w-full max-h-[80vh] object-contain"}
          draggable={false}
        />

        {/* Other pins - compact dots with number */}
        {otherPins.map((pin) => {
          const colors = getStatusColor(pin.status);
          const shortCode = getShortCode(pin);
          return (
            <div
              key={pin.id}
              className="absolute cursor-pointer group"
              style={{
                left: `${pin.pinPosX}%`,
                top: `${pin.pinPosY}%`,
                transform: "translate(-50%, -50%)",
                zIndex: 5,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onPinClick?.(pin.id);
              }}
            >
              {/* Dot with number inside */}
              <div
                className="rounded-full flex items-center justify-center text-white font-bold shadow-md border border-white/50 hover:scale-125 transition-transform"
                style={{
                  width: `${pinSize}px`,
                  height: `${pinSize}px`,
                  backgroundColor: colors.fill,
                  fontSize: `${fontSize}px`,
                  lineHeight: 1,
                }}
              >
                {shortCode.length <= 3 ? shortCode : ""}
              </div>
              {/* Label below */}
              {shortCode.length > 3 && (
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 bg-black/70 text-white rounded whitespace-nowrap"
                  style={{ fontSize: `${fontSize}px`, padding: "1px 3px" }}
                >
                  {shortCode}
                </div>
              )}
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black/90 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none max-w-[200px] truncate z-30">
                #{shortCode} - {pin.descripcion || pin.codigo}
              </div>
            </div>
          );
        })}

        {/* Main pin (current item - larger, highlighted) */}
        {pinX != null && pinY != null && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${pinX}%`,
              top: `${pinY}%`,
              transform: "translate(-50%, -50%)",
              zIndex: 10,
            }}
          >
            {/* Pulse ring */}
            <div
              className="absolute animate-ping rounded-full"
              style={{
                width: `${mainPinSize + 8}px`,
                height: `${mainPinSize + 8}px`,
                top: `${-(mainPinSize + 8) / 2}px`,
                left: `${-(mainPinSize + 8) / 2}px`,
                backgroundColor: pinFill,
                opacity: 0.3,
              }}
            />
            {/* Main dot */}
            <div
              className="rounded-full flex items-center justify-center text-white font-bold shadow-lg border-2 border-white"
              style={{
                width: `${mainPinSize}px`,
                height: `${mainPinSize}px`,
                backgroundColor: pinFill,
                fontSize: `${mainFontSize}px`,
                lineHeight: 1,
                marginTop: `${-mainPinSize / 2}px`,
                marginLeft: `${-mainPinSize / 2}px`,
              }}
            >
              {itemCodigo ? getShortCode({ id: 0, codigo: itemCodigo, pinPosX: null, pinPosY: null, numeroInterno: null }).slice(0, 4) : ""}
            </div>
            {/* Label */}
            {itemCodigo && (
              <div
                className="absolute left-1/2 -translate-x-1/2 bg-black/80 text-white rounded whitespace-nowrap font-bold"
                style={{
                  top: `${mainPinSize / 2 + 2}px`,
                  fontSize: `${mainFontSize}px`,
                  padding: "1px 4px",
                }}
              >
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
  );

  // Fullscreen modal
  if (isFullscreen) {
    return (
      <>
        {/* Placeholder in original position */}
        <div className={`relative ${className}`}>
          <div className="flex items-center justify-center h-32 bg-black/10 rounded-lg text-sm text-muted-foreground">
            Plano en pantalla completa
          </div>
        </div>
        {/* Fullscreen overlay */}
        <div className="fixed inset-0 z-[200] bg-black flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-black/80 text-white shrink-0">
            <div className="text-sm font-medium truncate">{nombre}</div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => zoomIn()}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                title="Acercar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => zoomOut()}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                title="Alejar"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              {scale > 1 && (
                <button
                  type="button"
                  onClick={() => resetZoom()}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                  title="Restablecer"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => { setIsFullscreen(false); resetZoom(); }}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                title="Salir de pantalla completa"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Plano content */}
          <div className="flex-1 overflow-hidden flex items-center justify-center">
            {renderPlanoContent()}
          </div>
          {/* Footer info */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-black/80 text-white/70 text-[10px] shrink-0">
            <span>{allPins.length} pin{allPins.length !== 1 ? "es" : ""} en este plano</span>
            {scale > 1 && <span>{scale.toFixed(1)}x</span>}
            <span>Doble tap para zoom</span>
          </div>
        </div>
      </>
    );
  }

  // Normal (inline) view
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
            title="Restablecer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); resetZoom(); }}
          className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm"
          title="Pantalla completa"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Pin count + Scale indicator */}
      <div className="absolute bottom-2 left-2 z-20 flex items-center gap-2">
        {allPins.length > 0 && (
          <div className="bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm">
            {allPins.length} pin{allPins.length !== 1 ? "es" : ""}
          </div>
        )}
        {scale > 1 && (
          <div className="bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm">
            {scale.toFixed(1)}x
          </div>
        )}
      </div>

      {renderPlanoContent()}
    </div>
  );
}
