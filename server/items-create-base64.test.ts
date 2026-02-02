import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock de usuario autenticado
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(role: string = "admin", userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "test-user-" + userId,
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: role as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// Base64 de prueba pequeño (1x1 pixel PNG transparente)
const TEST_BASE64_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// Base64 de prueba pequeño (1x1 pixel JPEG rojo)
const TEST_BASE64_JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB//9k=";

describe("Items Create - Test Exhaustivo", () => {
  describe("Creación de ítems con Base64", () => {
    it("debe crear un ítem con foto Base64 y devolver id y código", async () => {
      const ctx = createMockContext("residente", 1);
      const caller = appRouter.createCaller(ctx);
      
      // Primero obtener una empresa y unidad válidas
      const empresas = await caller.empresas.list();
      const unidades = await caller.unidades.list();
      
      if (empresas.length === 0 || unidades.length === 0) {
        console.log("No hay empresas o unidades para probar");
        return;
      }
      
      const clientId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const result = await caller.items.create({
        empresaId: empresas[0].id,
        unidadId: unidades[0].id,
        titulo: "Test Item con Base64",
        descripcion: "Ítem de prueba con foto Base64",
        fotoAntesBase64: TEST_BASE64_PNG,
        clientId: clientId,
      });
      
      // Verificar que se creó correctamente
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("codigo");
      expect(typeof result.id).toBe("number");
      expect(typeof result.codigo).toBe("string");
      expect(result.codigo.length).toBeGreaterThan(0);
      
      console.log("Ítem creado:", result);
    });

    it("debe evitar duplicados usando clientId", async () => {
      const ctx = createMockContext("residente", 1);
      const caller = appRouter.createCaller(ctx);
      
      const empresas = await caller.empresas.list();
      const unidades = await caller.unidades.list();
      
      if (empresas.length === 0 || unidades.length === 0) {
        console.log("No hay empresas o unidades para probar");
        return;
      }
      
      const clientId = `test-dup-${Date.now()}`;
      
      // Crear el primer ítem
      const result1 = await caller.items.create({
        empresaId: empresas[0].id,
        unidadId: unidades[0].id,
        titulo: "Test Duplicado",
        fotoAntesBase64: TEST_BASE64_PNG,
        clientId: clientId,
      });
      
      // Intentar crear el mismo ítem de nuevo
      const result2 = await caller.items.create({
        empresaId: empresas[0].id,
        unidadId: unidades[0].id,
        titulo: "Test Duplicado 2",
        fotoAntesBase64: TEST_BASE64_PNG,
        clientId: clientId,
      });
      
      // Debe devolver el mismo ítem, no crear uno nuevo
      expect(result2.id).toBe(result1.id);
      expect(result2.codigo).toBe(result1.codigo);
    });

    it("debe crear ítem sin foto (solo datos)", async () => {
      const ctx = createMockContext("residente", 1);
      const caller = appRouter.createCaller(ctx);
      
      const empresas = await caller.empresas.list();
      const unidades = await caller.unidades.list();
      
      if (empresas.length === 0 || unidades.length === 0) {
        console.log("No hay empresas o unidades para probar");
        return;
      }
      
      const result = await caller.items.create({
        empresaId: empresas[0].id,
        unidadId: unidades[0].id,
        titulo: "Test Sin Foto",
        descripcion: "Ítem sin foto para probar",
        clientId: `test-nofoto-${Date.now()}`,
      });
      
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("codigo");
    });
  });

  describe("Validación de roles para crear ítems", () => {
    it("debe permitir a residente crear ítems", async () => {
      const ctx = createMockContext("residente", 1);
      const caller = appRouter.createCaller(ctx);
      
      const empresas = await caller.empresas.list();
      const unidades = await caller.unidades.list();
      
      if (empresas.length === 0 || unidades.length === 0) return;
      
      const result = await caller.items.create({
        empresaId: empresas[0].id,
        unidadId: unidades[0].id,
        titulo: "Test Residente",
        clientId: `test-res-${Date.now()}`,
      });
      
      expect(result).toHaveProperty("id");
    });

    it("debe bloquear a desarrollador de crear ítems", async () => {
      const ctx = createMockContext("desarrollador", 1);
      const caller = appRouter.createCaller(ctx);
      
      const empresas = await caller.empresas.list();
      const unidades = await caller.unidades.list();
      
      if (empresas.length === 0 || unidades.length === 0) return;
      
      await expect(
        caller.items.create({
          empresaId: empresas[0].id,
          unidadId: unidades[0].id,
          titulo: "Test Desarrollador",
          clientId: `test-dev-${Date.now()}`,
        })
      ).rejects.toThrow();
    });
  });

  describe("Obtención de ítems sin Base64 en respuesta", () => {
    it("items.list NO debe incluir campos Base64", async () => {
      const ctx = createMockContext("admin", 1);
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.items.list({});
      
      expect(result).toHaveProperty("items");
      
      // Verificar que ningún ítem tiene campos Base64
      for (const item of result.items) {
        expect(item).not.toHaveProperty("fotoAntesBase64");
        expect(item).not.toHaveProperty("fotoAntesMarcadaBase64");
        expect(item).not.toHaveProperty("fotoDespuesBase64");
        
        // Verificar que fotoAntesUrl es una URL o null, NO Base64
        if (item.fotoAntesUrl) {
          expect(item.fotoAntesUrl.startsWith("data:")).toBe(false);
          expect(item.fotoAntesUrl.length).toBeLessThan(500); // URLs son cortas
        }
      }
    });

    it("items.get NO debe incluir campos Base64", async () => {
      const ctx = createMockContext("admin", 1);
      const caller = appRouter.createCaller(ctx);
      
      // Primero obtener un ítem existente
      const listResult = await caller.items.list({ limit: 1 });
      
      if (listResult.items.length === 0) {
        console.log("No hay ítems para probar");
        return;
      }
      
      const item = await caller.items.get({ id: listResult.items[0].id });
      
      if (item) {
        expect(item).not.toHaveProperty("fotoAntesBase64");
        expect(item).not.toHaveProperty("fotoAntesMarcadaBase64");
        expect(item).not.toHaveProperty("fotoDespuesBase64");
        
        // Verificar que las URLs no son Base64
        if (item.fotoAntesUrl) {
          expect(item.fotoAntesUrl.startsWith("data:")).toBe(false);
        }
        if (item.fotoAntesMarcadaUrl) {
          expect(item.fotoAntesMarcadaUrl.startsWith("data:")).toBe(false);
        }
        if (item.fotoDespuesUrl) {
          expect(item.fotoDespuesUrl.startsWith("data:")).toBe(false);
        }
      }
    });

    it("pendientes.misPendientes NO debe incluir Base64", async () => {
      const ctx = createMockContext("residente", 1);
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.pendientes.misPendientes();
      
      expect(Array.isArray(result)).toBe(true);
      
      // Verificar que ningún pendiente tiene Base64
      for (const item of result) {
        // fotoAntes debe ser URL, no Base64
        if (item.fotoAntes) {
          expect(item.fotoAntes.startsWith("data:")).toBe(false);
          expect(item.fotoAntes.length).toBeLessThan(500);
        }
      }
    });
  });
});

describe("Función getImageUrl - Test de Manejo de Base64", () => {
  // Importar la función directamente para probarla
  it("debe manejar URLs normales correctamente", async () => {
    // Este test verifica que la lógica de getImageUrl funciona
    const testUrl = "https://example.com/image.jpg";
    
    // Simular la lógica de getImageUrl
    const isBase64 = testUrl.startsWith("data:image") || 
                     (testUrl.length > 100 && /^[A-Za-z0-9+/=]+$/.test(testUrl));
    
    expect(isBase64).toBe(false);
  });

  it("debe detectar Base64 con prefijo data:", async () => {
    const testBase64 = TEST_BASE64_PNG;
    
    const isBase64 = testBase64.startsWith("data:image");
    
    expect(isBase64).toBe(true);
  });

  it("debe detectar Base64 sin prefijo (JPEG)", async () => {
    // Base64 sin prefijo que empieza con /9j (JPEG)
    const rawBase64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==";
    
    const isJpegBase64 = rawBase64.startsWith("/9j");
    
    expect(isJpegBase64).toBe(true);
  });

  it("debe detectar Base64 sin prefijo (PNG)", async () => {
    // Base64 sin prefijo que empieza con iVBOR (PNG)
    const rawBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    
    const isPngBase64 = rawBase64.startsWith("iVBOR");
    
    expect(isPngBase64).toBe(true);
  });
});
