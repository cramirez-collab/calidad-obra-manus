import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  formatearMensajeWhatsApp, 
  generarEnlaceWhatsApp,
  esHoraDeEnvio
} from './services/whatsappService';

describe('WhatsApp Service', () => {
  describe('formatearMensajeWhatsApp', () => {
    it('debe formatear correctamente un reporte vacío', () => {
      const reporte = {
        fecha: 'viernes, 31 de enero de 2025',
        hora: '09:00',
        proyectoNombre: 'Hidalma',
        sinCapturarCalidad: [],
        sinCapturarSecuencias: [],
        conPendientesMas3Dias: [],
        conRechazadosMas3Dias: [],
        tiempoPromedioGlobal: null,
      };

      const mensaje = formatearMensajeWhatsApp(reporte);

      expect(mensaje).toContain('📊 *REPORTE DE CALIDAD*');
      expect(mensaje).toContain('viernes, 31 de enero de 2025');
      expect(mensaje).toContain('09:00');
      expect(mensaje).toContain('*Hidalma*');
      expect(mensaje).toContain('✅ Todos revisaron CALIDAD hoy');
      expect(mensaje).toContain('✅ Todos revisaron SECUENCIAS hoy');
      expect(mensaje).toContain('🎉 *¡Excelente! Todo al día.*');
    });

    it('debe listar residentes sin capturar calidad', () => {
      const reporte = {
        fecha: 'viernes, 31 de enero de 2025',
        hora: '09:00',
        proyectoNombre: 'Hidalma',
        sinCapturarCalidad: [
          { id: 1, nombre: 'Juan Pérez', email: 'juan@test.com', clickCalidad: false, clickSecuencias: true, pendientesMas3Dias: 0, rechazadosMas3Dias: 0, tiempoPromedioResolucion: null },
          { id: 2, nombre: 'María López', email: 'maria@test.com', clickCalidad: false, clickSecuencias: true, pendientesMas3Dias: 0, rechazadosMas3Dias: 0, tiempoPromedioResolucion: null },
        ],
        sinCapturarSecuencias: [],
        conPendientesMas3Dias: [],
        conRechazadosMas3Dias: [],
        tiempoPromedioGlobal: null,
      };

      const mensaje = formatearMensajeWhatsApp(reporte);

      expect(mensaje).toContain('❌ *Sin revisar CALIDAD hoy:*');
      expect(mensaje).toContain('• Juan Pérez');
      expect(mensaje).toContain('• María López');
      expect(mensaje).toContain('📌 *Total de observaciones: 2*');
    });

    it('debe listar residentes con pendientes de más de 3 días', () => {
      const reporte = {
        fecha: 'viernes, 31 de enero de 2025',
        hora: '09:00',
        proyectoNombre: 'Hidalma',
        sinCapturarCalidad: [],
        sinCapturarSecuencias: [],
        conPendientesMas3Dias: [
          { id: 1, nombre: 'Juan Pérez', email: 'juan@test.com', clickCalidad: true, clickSecuencias: true, pendientesMas3Dias: 5, rechazadosMas3Dias: 0, tiempoPromedioResolucion: 12.5 },
        ],
        conRechazadosMas3Dias: [],
        tiempoPromedioGlobal: 24.5,
      };

      const mensaje = formatearMensajeWhatsApp(reporte);

      expect(mensaje).toContain('⚠️ *PENDIENTES +3 días sin atender:*');
      expect(mensaje).toContain('• Juan Pérez: 5 ítem(s)');
    });

    it('debe listar residentes con rechazados de más de 3 días', () => {
      const reporte = {
        fecha: 'viernes, 31 de enero de 2025',
        hora: '09:00',
        proyectoNombre: 'Hidalma',
        sinCapturarCalidad: [],
        sinCapturarSecuencias: [],
        conPendientesMas3Dias: [],
        conRechazadosMas3Dias: [
          { id: 1, nombre: 'María López', email: 'maria@test.com', clickCalidad: true, clickSecuencias: true, pendientesMas3Dias: 0, rechazadosMas3Dias: 3, tiempoPromedioResolucion: 8.2 },
        ],
        tiempoPromedioGlobal: 18.3,
      };

      const mensaje = formatearMensajeWhatsApp(reporte);

      expect(mensaje).toContain('🔴 *RECHAZADOS +3 días sin corregir:*');
      expect(mensaje).toContain('• María López: 3 ítem(s)');
    });

    it('debe mostrar tiempo promedio de resolución global', () => {
      const reporte = {
        fecha: 'viernes, 31 de enero de 2025',
        hora: '09:00',
        proyectoNombre: 'Hidalma',
        sinCapturarCalidad: [],
        sinCapturarSecuencias: [],
        conPendientesMas3Dias: [],
        conRechazadosMas3Dias: [],
        tiempoPromedioGlobal: 12.5, // 12.5 horas
      };

      const mensaje = formatearMensajeWhatsApp(reporte);

      expect(mensaje).toContain('⏱️ *Tiempo promedio de resolución:*');
      expect(mensaje).toContain('12.5 hrs');
    });

    it('debe mostrar tiempo promedio en días cuando es mayor a 24 horas', () => {
      const reporte = {
        fecha: 'viernes, 31 de enero de 2025',
        hora: '09:00',
        proyectoNombre: 'Hidalma',
        sinCapturarCalidad: [],
        sinCapturarSecuencias: [],
        conPendientesMas3Dias: [],
        conRechazadosMas3Dias: [],
        tiempoPromedioGlobal: 48.0, // 48 horas = 2 días
      };

      const mensaje = formatearMensajeWhatsApp(reporte);

      expect(mensaje).toContain('⏱️ *Tiempo promedio de resolución:*');
      expect(mensaje).toContain('2 días');
    });
  });

  describe('generarEnlaceWhatsApp', () => {
    it('debe generar enlace válido con mensaje codificado', () => {
      const grupoUrl = 'https://chat.whatsapp.com/CBYjOPZU6z21FGKh6R49K5';
      const mensaje = 'Hola mundo';

      const enlace = generarEnlaceWhatsApp(grupoUrl, mensaje);

      expect(enlace).toContain('https://wa.me/');
      expect(enlace).toContain('text=Hola%20mundo');
    });

    it('debe lanzar error con URL inválida', () => {
      const grupoUrl = 'https://invalid-url.com';
      const mensaje = 'Test';

      expect(() => generarEnlaceWhatsApp(grupoUrl, mensaje)).toThrow('Enlace de grupo de WhatsApp inválido');
    });

    it('debe codificar caracteres especiales en el mensaje', () => {
      const grupoUrl = 'https://chat.whatsapp.com/ABC123';
      const mensaje = '📊 *REPORTE* con acentos: áéíóú';

      const enlace = generarEnlaceWhatsApp(grupoUrl, mensaje);

      expect(enlace).toContain('text=');
      expect(enlace).not.toContain(' '); // Los espacios deben estar codificados
    });
  });

  describe('esHoraDeEnvio', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('debe retornar false los domingos', () => {
      // Domingo 2 de febrero de 2025 a las 9:00 AM
      vi.setSystemTime(new Date(2025, 1, 2, 9, 0, 0));
      expect(esHoraDeEnvio()).toBe(false);
    });

    it('debe retornar true a las 9:00 AM de lunes a viernes', () => {
      // Lunes 3 de febrero de 2025 a las 9:00 AM
      vi.setSystemTime(new Date(2025, 1, 3, 9, 0, 0));
      expect(esHoraDeEnvio()).toBe(true);
    });

    it('debe retornar true a las 12:00 PM de lunes a viernes', () => {
      // Martes 4 de febrero de 2025 a las 12:00 PM
      vi.setSystemTime(new Date(2025, 1, 4, 12, 0, 0));
      expect(esHoraDeEnvio()).toBe(true);
    });

    it('debe retornar true a las 5:00 PM de lunes a viernes', () => {
      // Miércoles 5 de febrero de 2025 a las 5:00 PM
      vi.setSystemTime(new Date(2025, 1, 5, 17, 0, 0));
      expect(esHoraDeEnvio()).toBe(true);
    });

    it('debe retornar true a las 5:00 PM los sábados (ahora incluido por defecto)', () => {
      // Sábado 1 de febrero de 2025 a las 5:00 PM
      // Con la nueva configuración por defecto [1,2,3,4,5,6] y ['09:00','12:00','17:00']
      // Los sábados (6) ahora están incluidos en los días de envío
      vi.setSystemTime(new Date(2025, 1, 1, 17, 0, 0));
      expect(esHoraDeEnvio()).toBe(true);
    });

    it('debe retornar true a las 9:00 AM los sábados', () => {
      // Sábado 1 de febrero de 2025 a las 9:00 AM
      vi.setSystemTime(new Date(2025, 1, 1, 9, 0, 0));
      expect(esHoraDeEnvio()).toBe(true);
    });

    it('debe retornar false fuera de los horarios programados', () => {
      // Lunes 3 de febrero de 2025 a las 10:00 AM (fuera de horario)
      vi.setSystemTime(new Date(2025, 1, 3, 10, 0, 0));
      expect(esHoraDeEnvio()).toBe(false);
    });
  });
});
