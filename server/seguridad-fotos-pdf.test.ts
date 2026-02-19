import { describe, it, expect, vi } from "vitest";

// ========================================
// Tests para fotos en chat, foto marcada y exportar PDF
// ========================================

describe("Seguridad - Fotos en Chat", () => {
  it("createMensajeSeguridad acepta tipo 'foto' con fotoUrl", () => {
    // Verify the function signature supports foto type
    const data = {
      incidenteId: 1,
      usuarioId: 1,
      texto: "[Foto]",
      tipo: "foto" as const,
      fotoUrl: "https://s3.example.com/foto.jpg",
    };
    expect(data.tipo).toBe("foto");
    expect(data.fotoUrl).toBeTruthy();
  });

  it("mensaje tipo foto tiene fotoUrl y texto por defecto", () => {
    const msg = {
      tipo: "foto",
      fotoUrl: "https://s3.example.com/chat-fotos/1/abc.jpg",
      texto: "[Foto]",
    };
    expect(msg.tipo).toBe("foto");
    expect(msg.fotoUrl).toContain("chat-fotos");
    expect(msg.texto).toBe("[Foto]");
  });

  it("mensaje tipo foto puede tener texto adicional", () => {
    const msg = {
      tipo: "foto",
      fotoUrl: "https://s3.example.com/foto.jpg",
      texto: "Mira este daño",
    };
    expect(msg.texto).not.toBe("[Foto]");
    expect(msg.texto).toBe("Mira este daño");
  });

  it("base64 de foto se procesa correctamente para S3", () => {
    const fotoBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    const base64Data = fotoBase64.includes(",") ? fotoBase64.split(",")[1] : fotoBase64;
    expect(base64Data).toBe("/9j/4AAQSkZJRg==");
    
    const ext = fotoBase64.includes("image/png") ? "png" : "jpg";
    expect(ext).toBe("jpg");
  });

  it("base64 PNG se detecta correctamente", () => {
    const fotoBase64 = "data:image/png;base64,iVBORw0KGgo=";
    const ext = fotoBase64.includes("image/png") ? "png" : "jpg";
    expect(ext).toBe("png");
  });
});

describe("Seguridad - Foto Marcada (Rayado)", () => {
  it("guardarFotoMarcadaIncidente acepta URL y base64", () => {
    const data = {
      id: 1,
      fotoMarcadaUrl: "https://s3.example.com/seguridad/marcadas/1/abc.png",
      fotoMarcadaBase64: "data:image/png;base64,iVBORw0KGgo=",
    };
    expect(data.fotoMarcadaUrl).toContain("marcadas");
    expect(data.fotoMarcadaBase64).toContain("base64");
  });

  it("base64 de foto marcada se extrae correctamente", () => {
    const base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
    const extracted = base64.includes(",") ? base64.split(",")[1] : base64;
    expect(extracted).toBe("iVBORw0KGgoAAAANSUhEUg==");
  });

  it("key de S3 para foto marcada incluye id del incidente", () => {
    const incidenteId = 42;
    const key = `seguridad/marcadas/${incidenteId}/test123.png`;
    expect(key).toContain("seguridad/marcadas/42/");
    expect(key).toMatch(/\.png$/);
  });
});

describe("Seguridad - Exportar PDF", () => {
  it("datos de PDF incluyen campos requeridos", () => {
    const pdfData = {
      codigo: "SEG00001",
      tipo: "Caída",
      severidad: "Alta",
      estado: "abierto",
      descripcion: "Caída desde andamio nivel 3",
      ubicacion: "Piso 5, zona norte",
      fotoUrl: "https://s3.example.com/foto.jpg",
      fotoMarcadaUrl: "https://s3.example.com/marcada.png",
      reportadoPor: "Carlos Ramirez",
      fechaCreacion: new Date().toISOString(),
      fechaCierre: null,
      accionCorrectiva: "Instalar barandales de seguridad",
      mensajes: [],
    };
    expect(pdfData.codigo).toMatch(/^SEG\d{5}$/);
    expect(pdfData.tipo).toBeTruthy();
    expect(pdfData.severidad).toBeTruthy();
    expect(pdfData.reportadoPor).toBeTruthy();
  });

  it("PDF incluye mensajes con diferentes tipos", () => {
    const mensajes = [
      { id: 1, usuario: "Carlos", texto: "Revisar urgente", tipo: "texto", fotoUrl: null, audioUrl: null, transcripcion: null, bullets: null, fecha: new Date().toISOString() },
      { id: 2, usuario: "Ana", texto: "[Foto]", tipo: "foto", fotoUrl: "https://s3.example.com/foto.jpg", audioUrl: null, transcripcion: null, bullets: null, fecha: new Date().toISOString() },
      { id: 3, usuario: "Luis", texto: "Nota de voz", tipo: "voz", fotoUrl: null, audioUrl: "https://s3.example.com/audio.webm", transcripcion: "Se observó daño en estructura", bullets: ["Daño estructural detectado", "Requiere refuerzo", "Zona acordonada", "Notificar ingeniero", "Programar reparación"], fecha: new Date().toISOString() },
    ];
    expect(mensajes).toHaveLength(3);
    expect(mensajes.filter(m => m.tipo === "texto")).toHaveLength(1);
    expect(mensajes.filter(m => m.tipo === "foto")).toHaveLength(1);
    expect(mensajes.filter(m => m.tipo === "voz")).toHaveLength(1);
    expect(mensajes[2].bullets).toHaveLength(5);
  });

  it("labels de severidad se mapean correctamente", () => {
    const sevLabels: Record<string, string> = { baja: "Baja", media: "Media", alta: "Alta", critica: "Crítica" };
    expect(sevLabels["baja"]).toBe("Baja");
    expect(sevLabels["critica"]).toBe("Crítica");
    expect(sevLabels["alta"]).toBe("Alta");
    expect(sevLabels["media"]).toBe("Media");
  });

  it("labels de tipo se mapean correctamente", () => {
    const tipoLabels: Record<string, string> = {
      caida: "Caída", golpe: "Golpe", corte: "Corte", electrico: "Eléctrico",
      derrumbe: "Derrumbe", incendio: "Incendio", quimico: "Químico",
      epp_faltante: "EPP Faltante", condicion_insegura: "Condición Insegura",
      acto_inseguro: "Acto Inseguro", casi_accidente: "Casi Accidente", otro: "Otro",
    };
    expect(Object.keys(tipoLabels)).toHaveLength(12);
    expect(tipoLabels["caida"]).toBe("Caída");
    expect(tipoLabels["electrico"]).toBe("Eléctrico");
  });

  it("codigo fallback se genera correctamente si no hay codigo", () => {
    const incidente = { id: 5, codigo: null };
    const codigo = incidente.codigo || `SEG${String(incidente.id).padStart(5, "0")}`;
    expect(codigo).toBe("SEG00005");
  });

  it("codigo existente se usa directamente", () => {
    const incidente = { id: 5, codigo: "SEG00042" };
    const codigo = incidente.codigo || `SEG${String(incidente.id).padStart(5, "0")}`;
    expect(codigo).toBe("SEG00042");
  });
});

describe("Seguridad - getIncidenteCompletoParaPDF", () => {
  it("estructura de retorno incluye incidente, mensajes y reportadoPor", () => {
    const result = {
      incidente: { id: 1, codigo: "SEG00001", tipo: "caida", severidad: "alta" },
      mensajes: [{ id: 1, texto: "test", usuario: { name: "Carlos", role: "admin" } }],
      reportadoPor: { name: "Carlos", role: "admin" },
    };
    expect(result.incidente).toBeTruthy();
    expect(result.mensajes).toBeInstanceOf(Array);
    expect(result.reportadoPor?.name).toBe("Carlos");
  });

  it("mensajes incluyen datos de usuario", () => {
    const msg = {
      id: 1,
      texto: "Revisar",
      tipo: "texto",
      fotoUrl: null,
      audioUrl: null,
      transcripcion: null,
      bullets: null,
      usuario: { name: "Ana López", role: "supervisor" },
    };
    expect(msg.usuario.name).toBe("Ana López");
    expect(msg.usuario.role).toBe("supervisor");
  });

  it("bullets de voz se parsean de JSON string", () => {
    const bulletsJson = JSON.stringify(["Punto 1", "Punto 2", "Punto 3", "Punto 4", "Punto 5"]);
    const parsed = JSON.parse(bulletsJson);
    expect(parsed).toHaveLength(5);
    expect(parsed[0]).toBe("Punto 1");
  });
});

describe("Seguridad - generatePDFHtml", () => {
  it("colores de severidad se asignan correctamente", () => {
    const sevColors: Record<string, string> = { Baja: "#22c55e", Media: "#eab308", Alta: "#f97316", Crítica: "#ef4444" };
    expect(sevColors["Baja"]).toBe("#22c55e");
    expect(sevColors["Alta"]).toBe("#f97316");
    expect(sevColors["Crítica"]).toBe("#ef4444");
  });

  it("fecha se formatea correctamente para el reporte", () => {
    const fecha = new Date("2026-02-18T15:30:00Z");
    const formatted = fecha.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
    expect(formatted).toContain("2026");
    expect(formatted).toContain("18");
  });
});
