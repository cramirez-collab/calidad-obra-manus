/**
 * PlanoImage — Componente robusto para mostrar imágenes de planos.
 * 
 * Características:
 * - Retry automático (hasta 3 intentos con backoff)
 * - Loading skeleton mientras carga
 * - Fallback visual si falla definitivamente
 * - Cache-busting en reintentos
 * - Compatible con móvil (iOS Safari, Android Chrome)
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { getImageUrl } from '@/lib/imageUrl';
import { ImageOff, RefreshCw } from 'lucide-react';

interface PlanoImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  onClick?: () => void;
  fallbackText?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 5000]; // ms

export function PlanoImage({ src, alt = 'Plano', className = '', onClick, fallbackText = 'Error al cargar plano' }: PlanoImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [currentSrc, setCurrentSrc] = useState('');
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Resolver la URL al montar o cuando cambia src
  useEffect(() => {
    mountedRef.current = true;
    if (!src) {
      setStatus('error');
      return;
    }
    const resolved = getImageUrl(src);
    if (!resolved) {
      setStatus('error');
      return;
    }
    setCurrentSrc(resolved);
    setStatus('loading');
    setRetryCount(0);

    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [src]);

  const handleLoad = useCallback(() => {
    if (mountedRef.current) setStatus('loaded');
  }, []);

  const handleError = useCallback(() => {
    if (!mountedRef.current) return;
    
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount] || 5000;
      retryTimerRef.current = setTimeout(() => {
        if (!mountedRef.current || !src) return;
        // Cache-bust: agregar timestamp para forzar re-fetch
        const resolved = getImageUrl(src);
        const separator = resolved.includes('?') ? '&' : '?';
        setCurrentSrc(`${resolved}${separator}_r=${Date.now()}`);
        setRetryCount(prev => prev + 1);
        setStatus('loading');
      }, delay);
    } else {
      setStatus('error');
    }
  }, [retryCount, src]);

  const handleManualRetry = useCallback(() => {
    if (!src) return;
    setRetryCount(0);
    const resolved = getImageUrl(src);
    const separator = resolved.includes('?') ? '&' : '?';
    setCurrentSrc(`${resolved}${separator}_r=${Date.now()}`);
    setStatus('loading');
  }, [src]);

  // Error state
  if (status === 'error') {
    return (
      <div 
        className={`flex flex-col items-center justify-center bg-slate-100 border rounded-lg text-muted-foreground ${className}`}
        onClick={handleManualRetry}
        role="button"
        title="Toca para reintentar"
      >
        <ImageOff className="w-6 h-6 mb-1 text-slate-400" />
        <span className="text-xs text-center px-2">{fallbackText}</span>
        <button className="flex items-center gap-1 text-xs text-emerald-600 mt-1 hover:underline">
          <RefreshCw className="w-3 h-3" /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Loading skeleton */}
      {status === 'loading' && (
        <div className={`absolute inset-0 bg-slate-100 animate-pulse rounded-lg flex items-center justify-center`}>
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <img
        src={currentSrc}
        alt={alt}
        className={`w-full h-full object-cover rounded-lg border ${status === 'loading' ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300 ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
        onLoad={handleLoad}
        onError={handleError}
        onClick={onClick}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

export default PlanoImage;
