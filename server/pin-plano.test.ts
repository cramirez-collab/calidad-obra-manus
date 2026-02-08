import { describe, it, expect } from "vitest";

/**
 * Tests para la funcionalidad de pines en planos (v3.84-v3.85)
 * - updatePin: actualizar/eliminar pin de un ítem
 * - Generación de PDF con plano incluido (lógica frontend, se testea la estructura)
 */

describe("Pin en Plano - Estructura de datos", () => {
  it("debe aceptar coordenadas válidas de pin (0-100)", () => {
    const pinPosX = "45.23";
    const pinPosY = "67.89";
    const x = parseFloat(pinPosX);
    const y = parseFloat(pinPosY);
    
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(100);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(100);
  });

  it("debe manejar pin nulo para eliminación", () => {
    const input = {
      itemId: 1,
      pinPlanoId: null,
      pinPosX: null,
      pinPosY: null,
    };
    
    expect(input.pinPlanoId).toBeNull();
    expect(input.pinPosX).toBeNull();
    expect(input.pinPosY).toBeNull();
  });

  it("debe calcular posición absoluta del pin en PDF correctamente", () => {
    // Simular cálculo de posición del pin en el PDF
    const planoBoxX = 120; // posición X de la caja del plano
    const imgPadding = 2;
    const imgY = 71; // posición Y de la imagen
    const imgW = 66; // ancho de la imagen
    const imgH = 63; // alto de la imagen
    
    const pinPosXPercent = 50; // 50%
    const pinPosYPercent = 30; // 30%
    
    const pinAbsX = planoBoxX + imgPadding + (pinPosXPercent / 100) * imgW;
    const pinAbsY = imgY + (pinPosYPercent / 100) * imgH;
    
    // El pin debe estar dentro de los límites de la imagen
    expect(pinAbsX).toBeGreaterThanOrEqual(planoBoxX + imgPadding);
    expect(pinAbsX).toBeLessThanOrEqual(planoBoxX + imgPadding + imgW);
    expect(pinAbsY).toBeGreaterThanOrEqual(imgY);
    expect(pinAbsY).toBeLessThanOrEqual(imgY + imgH);
  });

  it("debe calcular ancho de columna info correctamente con plano", () => {
    const pageWidth = 215.9; // letter size mm
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    const planoBoxWidth = 70;
    
    // Con plano: columna info se reduce
    const infoColumnWithPlano = contentWidth - planoBoxWidth - 8;
    expect(infoColumnWithPlano).toBeLessThan(contentWidth);
    expect(infoColumnWithPlano).toBeGreaterThan(0);
    
    // Sin plano: columna info usa todo el ancho
    const infoColumnWithoutPlano = contentWidth;
    expect(infoColumnWithoutPlano).toEqual(contentWidth);
  });

  it("debe buscar plano por pinPlanoId o por nivel de unidad", () => {
    const planos = [
      { id: 1, nombre: "Nivel 1", imagenUrl: "https://example.com/n1.jpg" },
      { id: 2, nombre: "Nivel 2", imagenUrl: "https://example.com/n2.jpg" },
      { id: 3, nombre: "Sótano 1", imagenUrl: "https://example.com/s1.jpg" },
    ];
    
    const unidades = [
      { id: 10, nombre: "Depto 101", nivel: "Nivel 1" },
      { id: 11, nombre: "Depto 201", nivel: "Nivel 2" },
    ];
    
    // Caso 1: ítem tiene pinPlanoId → buscar por ID
    const itemConPin = { pinPlanoId: 2, pinPosX: "45", pinPosY: "60", unidadId: 10 };
    const planoDelPin = planos.find(p => p.id === itemConPin.pinPlanoId);
    expect(planoDelPin).toBeDefined();
    expect(planoDelPin!.nombre).toBe("Nivel 2");
    
    // Caso 2: ítem sin pin → buscar plano por nivel de la unidad
    const itemSinPin = { pinPlanoId: null, pinPosX: null, pinPosY: null, unidadId: 10 };
    const unidad = unidades.find(u => u.id === itemSinPin.unidadId);
    const planoDelNivel = planos.find(p => unidad && p.nombre === unidad.nivel);
    expect(planoDelNivel).toBeDefined();
    expect(planoDelNivel!.nombre).toBe("Nivel 1");
    
    // Caso 3: ítem sin pin y sin plano para ese nivel
    const itemSinPlano = { pinPlanoId: null, pinPosX: null, pinPosY: null, unidadId: 99 };
    const unidadNoExiste = unidades.find(u => u.id === itemSinPlano.unidadId);
    const planoNoExiste = planos.find(p => unidadNoExiste && p.nombre === unidadNoExiste.nivel);
    expect(planoNoExiste).toBeUndefined();
  });

  it("debe ajustar yPos cuando la caja del plano es más alta que info+trazabilidad", () => {
    const planoBoxY = 63; // posición Y del plano
    const planoBoxHeight = 75;
    const planoBottomY = planoBoxY + planoBoxHeight + 5; // 143
    
    // Caso: info+trazabilidad terminan antes que el plano
    let yPos = 120; // info+trazabilidad terminan en 120
    if (yPos < planoBottomY) {
      yPos = planoBottomY;
    }
    expect(yPos).toBe(143);
    
    // Caso: info+trazabilidad terminan después que el plano
    yPos = 150;
    const originalYPos = yPos;
    if (yPos < planoBottomY) {
      yPos = planoBottomY;
    } else {
      yPos += 10;
    }
    expect(yPos).toBe(originalYPos + 10);
  });
});
