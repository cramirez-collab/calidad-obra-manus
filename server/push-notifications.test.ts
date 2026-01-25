import { describe, it, expect, vi } from 'vitest';
import { router, publicProcedure, protectedProcedure } from './_core/trpc';
import { appRouter } from './routers';

describe('Push Notifications', () => {
  it('debe tener endpoint para obtener clave VAPID pública', async () => {
    // Verificar que el router tiene el endpoint
    expect(appRouter.notificaciones.getVapidPublicKey).toBeDefined();
  });

  it('debe tener endpoint para suscribirse a push', async () => {
    expect(appRouter.notificaciones.subscribePush).toBeDefined();
  });

  it('debe tener endpoint para desuscribirse de push', async () => {
    expect(appRouter.notificaciones.unsubscribePush).toBeDefined();
  });

  it('debe tener endpoint para enviar notificación de prueba', async () => {
    expect(appRouter.notificaciones.testPush).toBeDefined();
  });
});

describe('Notificaciones In-App', () => {
  it('debe tener endpoint para listar notificaciones', async () => {
    expect(appRouter.notificaciones.list).toBeDefined();
  });

  it('debe tener endpoint para contar notificaciones no leídas', async () => {
    expect(appRouter.notificaciones.count).toBeDefined();
  });

  it('debe tener endpoint para marcar notificación como leída', async () => {
    expect(appRouter.notificaciones.marcarLeida).toBeDefined();
  });

  it('debe tener endpoint para marcar todas las notificaciones como leídas', async () => {
    expect(appRouter.notificaciones.marcarTodasLeidas).toBeDefined();
  });
});
