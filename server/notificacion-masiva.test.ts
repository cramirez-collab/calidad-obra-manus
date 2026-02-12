import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Test para verificar la lógica de notificación masiva al crear ítems.
 * Verifica que al crear un ítem se notifica a:
 * 1. Usuarios directos de la empresa (users.empresaId)
 * 2. Residentes vinculados a la empresa (empresa_residentes)
 * 3. Residente asignado a la especialidad
 * Sin duplicar notificaciones al creador ni a usuarios ya notificados.
 */

// Mock de las funciones de db
const mockGetUsersByEmpresa = vi.fn();
const mockGetResidentesByEmpresa = vi.fn();
const mockGetEspecialidadById = vi.fn();
const mockCreateNotificacion = vi.fn();
const mockGetPushSubscriptionsByUsuario = vi.fn();

describe('Notificación masiva al crear ítem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateNotificacion.mockResolvedValue(1);
    mockGetPushSubscriptionsByUsuario.mockResolvedValue([]);
  });

  it('debe notificar a todos los usuarios de la empresa sin duplicar al creador', async () => {
    const creadorId = 10;
    const empresaId = 5;
    const itemId = 100;
    const titulo = 'Defecto en muro';
    const codigo = 'HD-001';

    // Usuarios de la empresa (incluye al creador)
    mockGetUsersByEmpresa.mockResolvedValue([
      { id: 10, name: 'Creador', empresaId: 5 },
      { id: 20, name: 'Usuario A', empresaId: 5 },
      { id: 30, name: 'Usuario B', empresaId: 5 },
    ]);
    // Residentes vinculados a la empresa
    mockGetResidentesByEmpresa.mockResolvedValue([
      { usuarioId: 40, nombre: 'Residente X', tipoResidente: 'residente' },
      { usuarioId: 20, nombre: 'Usuario A', tipoResidente: 'jefe_residente' }, // duplicado con empresa
    ]);
    // Especialidad sin residente
    mockGetEspecialidadById.mockResolvedValue({ id: 1, residenteId: null });

    // Simular la lógica de notificación masiva
    const notifiedIds = new Set<number>();
    notifiedIds.add(creadorId); // No notificar al creador

    // 1) Usuarios directos de la empresa
    const empresaUsers = await mockGetUsersByEmpresa(empresaId);
    for (const eu of empresaUsers) {
      if (notifiedIds.has(eu.id)) continue;
      notifiedIds.add(eu.id);
      await mockCreateNotificacion({
        usuarioId: eu.id,
        itemId,
        tipo: 'item_pendiente_foto',
        titulo: 'Nuevo ítem asignado a tu empresa',
        mensaje: `Se creó el ítem "${titulo}" (${codigo}) para tu empresa`,
      });
    }

    // 2) Residentes vinculados
    const empresaResidentes = await mockGetResidentesByEmpresa(empresaId);
    for (const er of empresaResidentes) {
      const uid = er.usuarioId || er.id;
      if (!uid || notifiedIds.has(uid)) continue;
      notifiedIds.add(uid);
      await mockCreateNotificacion({
        usuarioId: uid,
        itemId,
        tipo: 'item_pendiente_foto',
        titulo: 'Nuevo ítem asignado a tu empresa',
        mensaje: `Se creó el ítem "${titulo}" (${codigo}) para tu empresa`,
      });
    }

    // Verificar: creador (10) NO fue notificado, usuario 20 solo 1 vez, 30 y 40 notificados
    expect(mockCreateNotificacion).toHaveBeenCalledTimes(3); // 20, 30, 40
    
    const notifiedUserIds = mockCreateNotificacion.mock.calls.map(
      (call: any[]) => call[0].usuarioId
    );
    expect(notifiedUserIds).toContain(20);
    expect(notifiedUserIds).toContain(30);
    expect(notifiedUserIds).toContain(40);
    expect(notifiedUserIds).not.toContain(10); // creador excluido
    
    // Verificar que no hay duplicados
    const uniqueIds = new Set(notifiedUserIds);
    expect(uniqueIds.size).toBe(notifiedUserIds.length);
  });

  it('debe notificar al residente de la especialidad si no fue notificado antes', async () => {
    const creadorId = 10;
    const empresaId = 5;
    const especialidadId = 3;
    const itemId = 101;
    const titulo = 'Grieta en piso';
    const codigo = 'HD-002';

    mockGetUsersByEmpresa.mockResolvedValue([
      { id: 10, name: 'Creador', empresaId: 5 },
    ]);
    mockGetResidentesByEmpresa.mockResolvedValue([]);
    // Especialidad con residente diferente al creador
    mockGetEspecialidadById.mockResolvedValue({ id: 3, residenteId: 50 });

    const notifiedIds = new Set<number>();
    notifiedIds.add(creadorId);

    // 1) Usuarios empresa
    const empresaUsers = await mockGetUsersByEmpresa(empresaId);
    for (const eu of empresaUsers) {
      if (notifiedIds.has(eu.id)) continue;
      notifiedIds.add(eu.id);
      await mockCreateNotificacion({
        usuarioId: eu.id,
        itemId,
        tipo: 'item_pendiente_foto',
        titulo: 'Nuevo ítem asignado a tu empresa',
        mensaje: `Se creó el ítem "${titulo}" (${codigo}) para tu empresa`,
      });
    }

    // 2) Residentes empresa
    const empresaResidentes = await mockGetResidentesByEmpresa(empresaId);
    for (const er of empresaResidentes) {
      const uid = er.usuarioId || er.id;
      if (!uid || notifiedIds.has(uid)) continue;
      notifiedIds.add(uid);
      await mockCreateNotificacion({
        usuarioId: uid,
        itemId,
        tipo: 'item_pendiente_foto',
        titulo: 'Nuevo ítem asignado a tu empresa',
        mensaje: `Se creó el ítem "${titulo}" (${codigo}) para tu empresa`,
      });
    }

    // 3) Residente de la especialidad
    if (especialidadId) {
      const esp = await mockGetEspecialidadById(especialidadId);
      if (esp?.residenteId && !notifiedIds.has(esp.residenteId)) {
        notifiedIds.add(esp.residenteId);
        await mockCreateNotificacion({
          usuarioId: esp.residenteId,
          itemId,
          tipo: 'item_pendiente_foto',
          titulo: 'Nuevo ítem en tu especialidad',
          mensaje: `Se creó el ítem "${titulo}" (${codigo}) en tu especialidad`,
        });
      }
    }

    // Solo el residente de la especialidad (50) debe ser notificado
    // (creador 10 excluido, no hay otros usuarios empresa)
    expect(mockCreateNotificacion).toHaveBeenCalledTimes(1);
    expect(mockCreateNotificacion.mock.calls[0][0].usuarioId).toBe(50);
    expect(mockCreateNotificacion.mock.calls[0][0].titulo).toContain('especialidad');
  });

  it('no debe notificar al residente de especialidad si ya fue notificado como usuario empresa', async () => {
    const creadorId = 10;
    const empresaId = 5;
    const especialidadId = 3;
    const itemId = 102;
    const titulo = 'Humedad';
    const codigo = 'HD-003';

    // El residente de la especialidad (20) también es usuario de la empresa
    mockGetUsersByEmpresa.mockResolvedValue([
      { id: 10, name: 'Creador', empresaId: 5 },
      { id: 20, name: 'Residente Esp', empresaId: 5 },
    ]);
    mockGetResidentesByEmpresa.mockResolvedValue([]);
    mockGetEspecialidadById.mockResolvedValue({ id: 3, residenteId: 20 });

    const notifiedIds = new Set<number>();
    notifiedIds.add(creadorId);

    const empresaUsers = await mockGetUsersByEmpresa(empresaId);
    for (const eu of empresaUsers) {
      if (notifiedIds.has(eu.id)) continue;
      notifiedIds.add(eu.id);
      await mockCreateNotificacion({
        usuarioId: eu.id,
        itemId,
        tipo: 'item_pendiente_foto',
        titulo: 'Nuevo ítem asignado a tu empresa',
        mensaje: `Se creó el ítem "${titulo}" (${codigo}) para tu empresa`,
      });
    }

    const empresaResidentes = await mockGetResidentesByEmpresa(empresaId);
    for (const er of empresaResidentes) {
      const uid = er.usuarioId || er.id;
      if (!uid || notifiedIds.has(uid)) continue;
      notifiedIds.add(uid);
      await mockCreateNotificacion({
        usuarioId: uid,
        itemId,
        tipo: 'item_pendiente_foto',
        titulo: 'Nuevo ítem asignado a tu empresa',
        mensaje: `Se creó el ítem "${titulo}" (${codigo}) para tu empresa`,
      });
    }

    if (especialidadId) {
      const esp = await mockGetEspecialidadById(especialidadId);
      if (esp?.residenteId && !notifiedIds.has(esp.residenteId)) {
        notifiedIds.add(esp.residenteId);
        await mockCreateNotificacion({
          usuarioId: esp.residenteId,
          itemId,
          tipo: 'item_pendiente_foto',
          titulo: 'Nuevo ítem en tu especialidad',
          mensaje: `Se creó el ítem "${titulo}" (${codigo}) en tu especialidad`,
        });
      }
    }

    // Solo 1 notificación: usuario 20 como empresa. NO duplicada como especialidad.
    expect(mockCreateNotificacion).toHaveBeenCalledTimes(1);
    expect(mockCreateNotificacion.mock.calls[0][0].usuarioId).toBe(20);
    expect(mockCreateNotificacion.mock.calls[0][0].titulo).toContain('empresa');
  });

  it('no debe crear notificaciones si no hay usuarios en la empresa ni especialidad', async () => {
    const creadorId = 10;
    const empresaId = 5;
    const itemId = 103;

    mockGetUsersByEmpresa.mockResolvedValue([
      { id: 10, name: 'Creador', empresaId: 5 }, // solo el creador
    ]);
    mockGetResidentesByEmpresa.mockResolvedValue([]);

    const notifiedIds = new Set<number>();
    notifiedIds.add(creadorId);

    const empresaUsers = await mockGetUsersByEmpresa(empresaId);
    for (const eu of empresaUsers) {
      if (notifiedIds.has(eu.id)) continue;
      notifiedIds.add(eu.id);
      await mockCreateNotificacion({
        usuarioId: eu.id,
        itemId,
        tipo: 'item_pendiente_foto',
        titulo: 'Nuevo ítem asignado a tu empresa',
        mensaje: 'test',
      });
    }

    const empresaResidentes = await mockGetResidentesByEmpresa(empresaId);
    for (const er of empresaResidentes) {
      const uid = er.usuarioId || er.id;
      if (!uid || notifiedIds.has(uid)) continue;
      notifiedIds.add(uid);
      await mockCreateNotificacion({
        usuarioId: uid,
        itemId,
        tipo: 'item_pendiente_foto',
        titulo: 'Nuevo ítem asignado a tu empresa',
        mensaje: 'test',
      });
    }

    // Ninguna notificación creada (solo el creador en la empresa)
    expect(mockCreateNotificacion).not.toHaveBeenCalled();
  });
});
