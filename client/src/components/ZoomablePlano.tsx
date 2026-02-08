import { useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2, Minimize2, ExternalLink } from "lucide-react";

export interface PlanoPin {
  id: number;
  codigo: string;
  descripcion?: string | null;
  status?: string | null;
  pinPosX: string | null;
  pinPosY: string | null;
  numeroInterno?: number | null;
  residenteNombre?: string | null;
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
    case "aprobado": return { bg: "#22c55e", border: "#16a34a", text: "white" };
    case "rechazado": return { bg: "#ef4444", border: "#dc2626", text: "white" };
    case "pendiente_aprobacion": return { bg: "#f59e0b", border: "#d97706", text: "white" };
    case "pendiente_foto_despues": return { bg: "#3b82f6", border: "#2563eb", text: "white" };
    default: return { bg: "#6b7280", border: "#4b5563", text: "white" };
  }
}

function getStatusLabel(status?: string | null) {
  switch (status) {
    case "aprobado": return "Aprobado";
    case "rechazado": return "Rechazado";
    case "pendiente_aprobacion": return "Pend. Aprob.";
    case "pendiente_foto_despues": return "Pend. Foto";
    default: return "Pendiente";
  }
}

function getItemNumber(pin: PlanoPin): string {
  if (pin.numeroInterno) return `${pin.numeroInterno}`;
  if (pin.codigo) {
    const parts = pin.codigo.split("-");
    return parts[parts.length - 1] || `${pin.id}`;
  }
  return `${pin.id}`;
}

function truncate(str: string, max: number) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "…" : str;
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
  const [hoveredPin, setHoveredPin] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgWrapperRef = useRef<HTMLDivElement>(null);
  const internalImgRef = useRef<HTMLImageElement>(null);
  const imgRef = externalImgRef || internalImgRef;

  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);
  const isPanning = useRef(false);
  const lastPanPos = useRef<{ x: number; y: number } | null>(null);
  const lastTapTime = useRef(0);
  const lastTapPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchMoved = useRef(false);

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

  const calcPinPos = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const img = imgRef.current;
      if (!img) return null;
      const rect = img.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
        return { x, y };
      }
      return null;
    },
    [imgRef]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!editingPin || !onPinPlace) return;
      if (scale > 1) return;
      const pos = calcPinPos(e.clientX, e.clientY);
      if (pos) {
        onPinPlace(pos.x, pos.y);
      }
    },
    [editingPin, onPinPlace, scale, calcPinPos]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchMoved.current = false;
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
      touchMoved.current = true;
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

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const wasPanning = isPanning.current;
      const wasPinching = lastTouchDistance.current !== null;
      lastTouchDistance.current = null;
      lastTouchCenter.current = null;
      isPanning.current = false;
      lastPanPos.current = null;

      if (e.touches.length > 0) return;
      if (touchMoved.current && (wasPanning || wasPinching)) return;

      const now = Date.now();
      const touch = e.changedTouches[0];
      const tapPos = { x: touch.clientX, y: touch.clientY };
      const timeDiff = now - lastTapTime.current;
      const posDiff = Math.abs(tapPos.x - lastTapPos.current.x) + Math.abs(tapPos.y - lastTapPos.current.y);

      if (timeDiff < 350 && posDiff < 50) {
        e.preventDefault();
        if (editingPin) {
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
        } else if (!isFullscreen) {
          setIsFullscreen(true);
          resetZoom();
        } else {
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
        lastTapTime.current = 0;
        lastTapPos.current = tapPos;
        return;
      }

      if (editingPin && onPinPlace) {
        const pos = calcPinPos(tapPos.x, tapPos.y);
        if (pos) {
          onPinPlace(pos.x, pos.y);
        }
      }

      lastTapTime.current = now;
      lastTapPos.current = tapPos;
    },
    [scale, editingPin, isFullscreen, resetZoom, clampTranslate, onPinPlace, calcPinPos]
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
  const otherPins = allPins.filter((p) => p.id !== currentItemId && p.pinPosX && p.pinPosY);

  // Pin sizes - REDUCED 50% from previous
  const basePinW = Math.max(10, 14 / scale);
  const basePinH = basePinW * 1.3;
  const mainPinW = Math.max(14, 20 / scale);
  const mainPinH = mainPinW * 1.3;
  const labelScale = Math.max(0.4, 0.7 / scale);

  // Check if pin is "aprobado" - render as small green dot only
  const isAprobado = (status?: string | null) => status === "aprobado";

  const renderPlanoContent = () => (
    <div
      ref={containerRef}
      className={`overflow-hidden ${editingPin ? "cursor-crosshair" : scale > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{ touchAction: "none", width: "100%", height: "100%" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        handleClick(e);
        if (!editingPin && hoveredPin !== null) {
          setHoveredPin(null);
        }
      }}
    >
      <div
        className="relative w-full h-full flex items-center justify-center"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: "center center",
          transition: isPanning.current || lastTouchDistance.current ? "none" : "transform 0.2s ease-out",
        }}
      >
        <div ref={imgWrapperRef} className="relative inline-block" style={{ lineHeight: 0 }}>
          <img
            ref={imgRef as React.RefObject<HTMLImageElement>}
            src={imagenUrl}
            alt={nombre}
            className={isFullscreen ? "max-w-full max-h-full object-contain" : "max-w-full max-h-[80vh] object-contain"}
            draggable={false}
            style={{ display: "block" }}
          />

          {/* Other pins */}
          {!editingPin && otherPins.map((pin) => {
            const colors = getStatusColor(pin.status);
            const px = parseFloat(pin.pinPosX!);
            const py = parseFloat(pin.pinPosY!);
            const isHovered = hoveredPin === pin.id;
            const aprobado = isAprobado(pin.status);

            // Aprobado pins: small green dot only
            if (aprobado) {
              return (
                <div
                  key={pin.id}
                  className="absolute"
                  style={{
                    left: `${px}%`,
                    top: `${py}%`,
                    zIndex: isHovered ? 20 : 3,
                    pointerEvents: "auto",
                  }}
                >
                  <div
                    className="rounded-full cursor-pointer"
                    style={{
                      width: `${Math.max(6, 8 / scale)}px`,
                      height: `${Math.max(6, 8 / scale)}px`,
                      backgroundColor: "#22c55e",
                      border: "1.5px solid white",
                      transform: "translate(-50%, -50%)",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
                    }}
                    onMouseEnter={() => setHoveredPin(pin.id)}
                    onMouseLeave={() => setHoveredPin(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPinClick?.(pin.id);
                    }}
                  />
                  {/* Hover tooltip */}
                  {isHovered && (
                    <div
                      className="absolute rounded-lg shadow-lg border overflow-hidden pointer-events-none"
                      style={{
                        left: "50%",
                        bottom: `${Math.max(8, 10 / scale)}px`,
                        transform: `translateX(-50%) scale(${labelScale})`,
                        transformOrigin: "bottom center",
                        backgroundColor: "rgba(0,0,0,0.9)",
                        borderColor: colors.bg,
                        minWidth: "100px",
                        maxWidth: "160px",
                        zIndex: 30,
                      }}
                    >
                      <div className="px-2 py-1 text-white text-[10px] font-bold border-b border-white/10">
                        {getItemNumber(pin)} - Aprobado
                      </div>
                      {pin.descripcion && (
                        <div className="px-2 py-1 text-white text-[10px] leading-tight border-b border-white/10">
                          <span className="text-white/60">Defecto: </span>
                          <span>{truncate(pin.descripcion, 30)}</span>
                        </div>
                      )}
                      {pin.residenteNombre && (
                        <div className="px-2 py-1 text-white text-[10px] leading-tight">
                          <span className="text-white/60">Residente: </span>
                          <span>{truncate(pin.residenteNombre, 25)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // Non-aprobado pins: small pin with number, hover shows defecto
            return (
              <div
                key={pin.id}
                className="absolute"
                style={{
                  left: `${px}%`,
                  top: `${py}%`,
                  zIndex: isHovered ? 20 : 5,
                  pointerEvents: "auto",
                }}
              >
                {/* Pin SVG marker - 50% smaller */}
                <svg
                  width={basePinW}
                  height={basePinH}
                  viewBox="0 0 24 31"
                  className="cursor-pointer"
                  style={{
                    transform: "translate(-50%, -100%)",
                    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
                  }}
                  onMouseEnter={() => setHoveredPin(pin.id)}
                  onMouseLeave={() => setHoveredPin(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPinClick?.(pin.id);
                  }}
                >
                  <path
                    d="M12 0C5.4 0 0 5.4 0 12c0 9 12 19 12 19s12-10 12-19C24 5.4 18.6 0 12 0z"
                    fill={colors.bg}
                    stroke="white"
                    strokeWidth="2"
                  />
                  <circle cx="12" cy="11" r="4.5" fill="white" fillOpacity="0.9" />
                </svg>

                {/* Number label below pin - no # symbol */}
                <div
                  className="absolute flex items-center justify-center"
                  style={{
                    left: "0",
                    top: "2px",
                    transform: `translateX(-50%) scale(${labelScale})`,
                    transformOrigin: "top center",
                    pointerEvents: "none",
                  }}
                >
                  <span
                    className="font-bold text-white rounded-full px-1.5 py-0.5 shadow-sm whitespace-nowrap"
                    style={{
                      backgroundColor: colors.bg,
                      border: `1.5px solid ${colors.border}`,
                      fontSize: "9px",
                      lineHeight: 1,
                    }}
                  >
                    {getItemNumber(pin)}
                  </span>
                </div>

                {/* Hover tooltip with defecto info */}
                {isHovered && (
                  <div
                    className="absolute rounded-lg shadow-lg border overflow-hidden pointer-events-none"
                    style={{
                      left: "50%",
                      bottom: `${basePinH + 4}px`,
                      transform: `translateX(-50%) scale(${Math.max(0.6, 1 / scale)})`,
                      transformOrigin: "bottom center",
                      backgroundColor: "rgba(0,0,0,0.9)",
                      borderColor: colors.bg,
                      minWidth: "110px",
                      maxWidth: "180px",
                      zIndex: 30,
                    }}
                  >
                    <div className="px-2 py-1 text-white text-[10px] font-bold border-b border-white/10 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors.bg }} />
                      <span>{getItemNumber(pin)} - {getStatusLabel(pin.status)}</span>
                    </div>
                    {pin.descripcion && (
                      <div className="px-2 py-1 text-white text-[10px] leading-tight border-b border-white/10">
                        <span className="text-white/60">Defecto: </span>
                        <span className="font-medium">{truncate(pin.descripcion, 30)}</span>
                      </div>
                    )}
                    {pin.residenteNombre && (
                      <div className="px-2 py-1 text-white text-[10px] leading-tight border-b border-white/10">
                        <span className="text-white/60">Residente: </span>
                        <span>{truncate(pin.residenteNombre, 25)}</span>
                      </div>
                    )}
                    <div className="px-2 py-1 text-[9px] text-blue-300 flex items-center gap-1">
                      <ExternalLink className="w-2.5 h-2.5" />
                      <span>Click para ver ítem</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Main pin (current item) */}
          {pinX != null && pinY != null && (
            <div
              className="absolute"
              style={{
                left: `${pinX}%`,
                top: `${pinY}%`,
                zIndex: 10,
              }}
            >
              {/* Pulse ring */}
              <div
                className="absolute animate-ping rounded-full"
                style={{
                  width: `${mainPinW}px`,
                  height: `${mainPinW}px`,
                  left: `${-mainPinW / 2}px`,
                  top: `${-mainPinW}px`,
                  backgroundColor: pinFill,
                  opacity: 0.3,
                }}
              />
              {/* Pin SVG marker */}
              <svg
                width={mainPinW}
                height={mainPinH}
                viewBox="0 0 24 31"
                style={{
                  transform: "translate(-50%, -100%)",
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                }}
              >
                <path
                  d="M12 0C5.4 0 0 5.4 0 12c0 9 12 19 12 19s12-10 12-19C24 5.4 18.6 0 12 0z"
                  fill={pinFill}
                  stroke="white"
                  strokeWidth="2.5"
                />
                <circle cx="12" cy="11" r="4.5" fill="white" />
              </svg>
              {/* Main pin label - just number and code */}
              {itemCodigo && (
                <div
                  className="absolute whitespace-nowrap flex flex-col items-center"
                  style={{
                    left: "0",
                    top: "4px",
                    transform: `translateX(-50%) scale(${labelScale})`,
                    transformOrigin: "top center",
                  }}
                >
                  <span
                    className="font-bold text-white rounded-full px-2 py-0.5 shadow-md"
                    style={{
                      backgroundColor: pinFill,
                      border: "2px solid white",
                      fontSize: "10px",
                      lineHeight: 1.2,
                    }}
                  >
                    {(() => {
                      const mainPin = allPins.find(p => p.id === currentItemId);
                      return mainPin ? getItemNumber(mainPin) : itemCodigo;
                    })()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Placeholder when editing */}
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

  // Legend component
  const renderLegend = () => (
    <div className="flex flex-wrap items-center gap-2 px-2 py-1">
      {[
        { label: "Pend. Foto", color: "#3b82f6" },
        { label: "Pend. Aprob.", color: "#f59e0b" },
        { label: "Rechazado", color: "#ef4444" },
        { label: "Aprobado", color: "#22c55e", dot: true },
      ].map((s) => (
        <div key={s.label} className="flex items-center gap-1">
          {s.dot ? (
            <div className="w-2 h-2 rounded-full border border-white/50" style={{ backgroundColor: s.color }} />
          ) : (
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
          )}
          <span className="text-[9px] text-white/70">{s.label}</span>
        </div>
      ))}
    </div>
  );

  if (isFullscreen) {
    return (
      <>
        <div className={`relative ${className}`}>
          <div className="flex items-center justify-center h-32 bg-black/10 rounded-lg text-sm text-muted-foreground">
            Plano en pantalla completa
          </div>
        </div>
        <div className="fixed inset-0 z-[200] bg-black flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 bg-black/80 text-white shrink-0">
            <div className="text-sm font-medium truncate">{nombre}</div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => zoomIn()} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors" title="Acercar">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => zoomOut()} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors" title="Alejar">
                <ZoomOut className="w-4 h-4" />
              </button>
              {scale > 1 && (
                <button type="button" onClick={() => resetZoom()} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors" title="Restablecer">
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
              <button type="button" onClick={() => { setIsFullscreen(false); resetZoom(); setHoveredPin(null); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors" title="Salir">
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden flex items-center justify-center">
            {renderPlanoContent()}
          </div>
          <div className="flex items-center justify-between px-3 py-1 bg-black/80 text-white/70 shrink-0">
            {renderLegend()}
            <div className="flex items-center gap-3 text-[10px]">
              <span>{allPins.length} pin{allPins.length !== 1 ? "es" : ""}</span>
              {scale > 1 && <span>{scale.toFixed(1)}x</span>}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div className="absolute top-2 right-2 z-20 flex flex-col gap-1">
        <button type="button" onClick={(e) => { e.stopPropagation(); zoomIn(); }} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm" title="Acercar">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); zoomOut(); }} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm" title="Alejar">
          <ZoomOut className="w-4 h-4" />
        </button>
        {scale > 1 && (
          <button type="button" onClick={(e) => { e.stopPropagation(); resetZoom(); }} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm" title="Restablecer">
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
        <button type="button" onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); resetZoom(); }} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm" title="Pantalla completa">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

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
