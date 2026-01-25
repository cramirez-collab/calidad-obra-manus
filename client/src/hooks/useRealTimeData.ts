import { useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import { trpc } from '@/lib/trpc';

// Hook para sincronizar datos en tiempo real
export function useRealTimeItems() {
  const { on, off, isConnected } = useSocket();
  const utils = trpc.useUtils();

  const handleItemCreated = useCallback(() => {
    utils.items.list.invalidate();
    utils.estadisticas.general.invalidate();
    utils.estadisticas.kpis.invalidate();
  }, [utils]);

  const handleItemUpdated = useCallback(() => {
    utils.items.list.invalidate();
    utils.estadisticas.general.invalidate();
    utils.estadisticas.kpis.invalidate();
  }, [utils]);

  const handleItemPhotoUploaded = useCallback(() => {
    utils.items.list.invalidate();
  }, [utils]);

  const handleItemApproved = useCallback(() => {
    utils.items.list.invalidate();
    utils.estadisticas.general.invalidate();
    utils.estadisticas.kpis.invalidate();
  }, [utils]);

  const handleItemRejected = useCallback(() => {
    utils.items.list.invalidate();
    utils.estadisticas.general.invalidate();
    utils.estadisticas.kpis.invalidate();
  }, [utils]);

  const handleStatsUpdated = useCallback(() => {
    utils.estadisticas.general.invalidate();
    utils.estadisticas.kpis.invalidate();
  }, [utils]);

  useEffect(() => {
    if (!isConnected) return;

    on('item:created', handleItemCreated);
    on('item:updated', handleItemUpdated);
    on('item:photo-uploaded', handleItemPhotoUploaded);
    on('item:approved', handleItemApproved);
    on('item:rejected', handleItemRejected);
    on('stats:updated', handleStatsUpdated);

    return () => {
      off('item:created', handleItemCreated);
      off('item:updated', handleItemUpdated);
      off('item:photo-uploaded', handleItemPhotoUploaded);
      off('item:approved', handleItemApproved);
      off('item:rejected', handleItemRejected);
      off('stats:updated', handleStatsUpdated);
    };
  }, [isConnected, on, off, handleItemCreated, handleItemUpdated, handleItemPhotoUploaded, handleItemApproved, handleItemRejected, handleStatsUpdated]);
}

// Hook para notificaciones en tiempo real
export function useRealTimeNotifications(onNotification?: (notification: any) => void) {
  const { on, off, isConnected } = useSocket();
  const utils = trpc.useUtils();

  const handleNotification = useCallback((notification: any) => {
    utils.notificaciones.list.invalidate();
    utils.notificaciones.count.invalidate();
    onNotification?.(notification);
  }, [utils, onNotification]);

  useEffect(() => {
    if (!isConnected) return;

    on('notification', handleNotification);

    return () => {
      off('notification', handleNotification);
    };
  }, [isConnected, on, off, handleNotification]);
}

export default useRealTimeItems;
