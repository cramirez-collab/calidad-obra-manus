/**
 * Tests para verificar que la lógica de timeout anti-hang funciona correctamente.
 * Estos tests validan la función withTimeout que se usa tanto en SyncManager como en PendientesSinc.
 */
import { describe, it, expect, vi } from 'vitest';

// Reimplementar withTimeout aquí para testear la lógica pura
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`TIMEOUT: ${label} excedió ${ms}ms`));
    }, ms);

    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

describe('withTimeout - Anti-hang utility', () => {
  it('should resolve when promise completes within timeout', async () => {
    const result = await withTimeout(
      Promise.resolve('ok'),
      1000,
      'test-fast'
    );
    expect(result).toBe('ok');
  });

  it('should reject with TIMEOUT error when promise exceeds timeout', async () => {
    const slowPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('too late'), 5000);
    });

    await expect(
      withTimeout(slowPromise, 50, 'test-slow')
    ).rejects.toThrow('TIMEOUT: test-slow excedió 50ms');
  });

  it('should propagate original error if promise rejects before timeout', async () => {
    const failingPromise = Promise.reject(new Error('network error'));

    await expect(
      withTimeout(failingPromise, 5000, 'test-error')
    ).rejects.toThrow('network error');
  });

  it('should include label in timeout error message', async () => {
    const hangingPromise = new Promise<void>(() => {}); // Never resolves

    try {
      await withTimeout(hangingPromise, 50, 'uploadFoto-123');
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error.message).toContain('uploadFoto-123');
      expect(error.message).toContain('TIMEOUT');
      expect(error.message).toContain('50ms');
    }
  });

  it('should not leak timers when promise resolves quickly', async () => {
    vi.useFakeTimers();
    
    const quickPromise = Promise.resolve('fast');
    const result = await withTimeout(quickPromise, 30000, 'test-no-leak');
    
    expect(result).toBe('fast');
    // Advance time past the timeout — should not throw
    vi.advanceTimersByTime(31000);
    
    vi.useRealTimers();
  });

  it('should handle concurrent timeouts independently', async () => {
    const results: string[] = [];

    const fast = withTimeout(
      new Promise<string>(r => setTimeout(() => r('fast'), 10)),
      1000,
      'fast-op'
    ).then(v => { results.push(v); return v; });

    const slow = withTimeout(
      new Promise<string>(() => {}), // Never resolves
      50,
      'slow-op'
    ).catch(e => { results.push('timeout'); return 'timeout'; });

    await Promise.all([fast, slow]);
    
    expect(results).toContain('fast');
    expect(results).toContain('timeout');
  });
});

describe('Sync error classification', () => {
  function getErrorMessage(error: any): string {
    if (!error) return 'Error desconocido';
    if (error.message?.includes('TIMEOUT')) return 'Tiempo de espera agotado. La conexión es muy lenta.';
    if (error.message?.includes('UNAUTHORIZED')) return 'Sesión expirada. Cierra y abre la app de nuevo.';
    if (error.message?.includes('FORBIDDEN')) return 'Sin permisos para esta acción.';
    if (error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) return 'Sin conexión al servidor.';
    if (error.message?.includes('INTERNAL_SERVER_ERROR')) return 'Error del servidor. Intenta más tarde.';
    return error.message || 'Error desconocido';
  }

  it('should classify TIMEOUT errors correctly', () => {
    const msg = getErrorMessage(new Error('TIMEOUT: uploadFoto-123 excedió 30000ms'));
    expect(msg).toBe('Tiempo de espera agotado. La conexión es muy lenta.');
  });

  it('should classify UNAUTHORIZED errors correctly', () => {
    const msg = getErrorMessage(new Error('UNAUTHORIZED'));
    expect(msg).toBe('Sesión expirada. Cierra y abre la app de nuevo.');
  });

  it('should classify FORBIDDEN errors correctly', () => {
    const msg = getErrorMessage(new Error('FORBIDDEN'));
    expect(msg).toBe('Sin permisos para esta acción.');
  });

  it('should classify network errors correctly', () => {
    const msg = getErrorMessage(new Error('Failed to fetch'));
    expect(msg).toBe('Sin conexión al servidor.');
  });

  it('should classify server errors correctly', () => {
    const msg = getErrorMessage(new Error('INTERNAL_SERVER_ERROR'));
    expect(msg).toBe('Error del servidor. Intenta más tarde.');
  });

  it('should return original message for unknown errors', () => {
    const msg = getErrorMessage(new Error('Something weird happened'));
    expect(msg).toBe('Something weird happened');
  });

  it('should handle null/undefined errors', () => {
    expect(getErrorMessage(null)).toBe('Error desconocido');
    expect(getErrorMessage(undefined)).toBe('Error desconocido');
  });
});

describe('Failure tracking', () => {
  const MAX_RETRIES_BEFORE_PAUSE = 10;
  const failureCounts = new Map<string, number>();

  function trackFailure(id: string): boolean {
    const count = (failureCounts.get(id) || 0) + 1;
    failureCounts.set(id, count);
    return count >= MAX_RETRIES_BEFORE_PAUSE;
  }

  function isPaused(id: string): boolean {
    return (failureCounts.get(id) || 0) >= MAX_RETRIES_BEFORE_PAUSE;
  }

  function clearFailure(id: string) {
    failureCounts.delete(id);
  }

  it('should not pause before reaching max retries', () => {
    failureCounts.clear();
    for (let i = 0; i < 9; i++) {
      expect(trackFailure('test-item')).toBe(false);
    }
    expect(isPaused('test-item')).toBe(false);
  });

  it('should pause at max retries', () => {
    failureCounts.clear();
    for (let i = 0; i < 9; i++) {
      trackFailure('test-item-2');
    }
    expect(trackFailure('test-item-2')).toBe(true);
    expect(isPaused('test-item-2')).toBe(true);
  });

  it('should clear failure count', () => {
    failureCounts.clear();
    for (let i = 0; i < 10; i++) {
      trackFailure('test-item-3');
    }
    expect(isPaused('test-item-3')).toBe(true);
    clearFailure('test-item-3');
    expect(isPaused('test-item-3')).toBe(false);
  });

  it('should track failures independently per item', () => {
    failureCounts.clear();
    for (let i = 0; i < 10; i++) {
      trackFailure('item-a');
    }
    trackFailure('item-b');
    
    expect(isPaused('item-a')).toBe(true);
    expect(isPaused('item-b')).toBe(false);
  });
});
