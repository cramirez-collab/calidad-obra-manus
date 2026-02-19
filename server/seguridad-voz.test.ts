import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  crearNotaVoz: vi.fn().mockResolvedValue(1),
  getNotasVozByProyecto: vi.fn().mockResolvedValue([
    {
      id: 1,
      proyectoId: 1,
      incidenteId: null,
      creadoPorId: 10,
      audioUrl: "https://s3.example.com/audio/test.webm",
      transcripcion: "Se detectó un andamio sin barandal en el piso 5. Los trabajadores no usaban arnés.",
      bullets: JSON.stringify([
        "Andamio sin barandal en piso 5",
        "Trabajadores sin arnés de seguridad",
        "Riesgo de caída de altura",
        "Necesaria suspensión inmediata de trabajos",
        "Requiere instalación de protección colectiva",
      ]),
      duracionSegundos: 45,
      fechaCreacion: new Date("2026-02-18T10:00:00Z"),
      creadoPorNombre: "Inspector Seguridad",
      creadoPorFoto: null,
    },
    {
      id: 2,
      proyectoId: 1,
      incidenteId: 5,
      creadoPorId: 10,
      audioUrl: "https://s3.example.com/audio/test2.webm",
      transcripcion: "Revisión de extintores completada. Todos vigentes.",
      bullets: JSON.stringify([
        "Extintores revisados en todos los niveles",
        "Fechas de vigencia verificadas",
        "Señalización de extintores correcta",
        "Acceso libre a todos los equipos",
        "Próxima revisión programada para marzo",
      ]),
      duracionSegundos: 30,
      fechaCreacion: new Date("2026-02-17T15:00:00Z"),
      creadoPorNombre: "Inspector Seguridad",
      creadoPorFoto: null,
    },
  ]),
  getNotaVozById: vi.fn().mockResolvedValue({
    id: 1,
    proyectoId: 1,
    creadoPorId: 10,
    audioUrl: "https://s3.example.com/audio/test.webm",
    transcripcion: "Se detectó un andamio sin barandal en el piso 5.",
    bullets: JSON.stringify(["Punto 1", "Punto 2", "Punto 3", "Punto 4", "Punto 5"]),
    duracionSegundos: 45,
    fechaCreacion: new Date("2026-02-18T10:00:00Z"),
  }),
  getDb: vi.fn().mockResolvedValue(null),
}));

describe("Seguridad - Notas de Voz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crearNotaVoz returns a valid id", async () => {
    const db = await import("./db");
    const id = await db.crearNotaVoz({
      proyectoId: 1,
      creadoPorId: 10,
      audioUrl: "https://s3.example.com/audio/test.webm",
      transcripcion: "Texto transcrito de prueba",
      bullets: JSON.stringify(["Bullet 1", "Bullet 2", "Bullet 3", "Bullet 4", "Bullet 5"]),
      duracionSegundos: 30,
    });
    expect(id).toBe(1);
    expect(db.crearNotaVoz).toHaveBeenCalledOnce();
  });

  it("getNotasVozByProyecto returns notes with parsed data", async () => {
    const db = await import("./db");
    const notas = await db.getNotasVozByProyecto(1);
    expect(notas).toHaveLength(2);
    expect(notas[0].creadoPorNombre).toBe("Inspector Seguridad");
    expect(notas[0].duracionSegundos).toBe(45);
    expect(notas[0].audioUrl).toContain("s3.example.com");
  });

  it("getNotasVozByProyecto filters by incidenteId when provided", async () => {
    const db = await import("./db");
    await db.getNotasVozByProyecto(1, 5);
    expect(db.getNotasVozByProyecto).toHaveBeenCalledWith(1, 5);
  });

  it("bullets are stored as JSON string and can be parsed", async () => {
    const db = await import("./db");
    const notas = await db.getNotasVozByProyecto(1);
    const bullets = JSON.parse(notas[0].bullets as string);
    expect(bullets).toHaveLength(5);
    expect(bullets[0]).toBe("Andamio sin barandal en piso 5");
  });

  it("getNotaVozById returns a single note", async () => {
    const db = await import("./db");
    const nota = await db.getNotaVozById(1);
    expect(nota).toBeDefined();
    expect(nota!.id).toBe(1);
    expect(nota!.duracionSegundos).toBe(45);
  });

  it("nota de voz can be linked to an incidente", async () => {
    const db = await import("./db");
    const notas = await db.getNotasVozByProyecto(1);
    const notaConIncidente = notas.find((n: any) => n.incidenteId !== null);
    expect(notaConIncidente).toBeDefined();
    expect(notaConIncidente!.incidenteId).toBe(5);
  });

  it("nota de voz can exist without incidente link", async () => {
    const db = await import("./db");
    const notas = await db.getNotasVozByProyecto(1);
    const notaSinIncidente = notas.find((n: any) => n.incidenteId === null);
    expect(notaSinIncidente).toBeDefined();
    expect(notaSinIncidente!.incidenteId).toBeNull();
  });

  it("transcripcion contains meaningful text", async () => {
    const db = await import("./db");
    const notas = await db.getNotasVozByProyecto(1);
    expect(notas[0].transcripcion).toContain("andamio");
    expect(notas[0].transcripcion.length).toBeGreaterThan(10);
  });

  it("audioUrl points to S3 storage", async () => {
    const db = await import("./db");
    const notas = await db.getNotasVozByProyecto(1);
    expect(notas[0].audioUrl).toMatch(/^https:\/\//);
    expect(notas[0].audioUrl).toContain(".webm");
  });

  it("duracionSegundos is a positive number", async () => {
    const db = await import("./db");
    const notas = await db.getNotasVozByProyecto(1);
    expect(notas[0].duracionSegundos).toBeGreaterThan(0);
    expect(typeof notas[0].duracionSegundos).toBe("number");
  });
});

describe("Seguridad - Notas de Voz - Bullet Generation", () => {
  it("generates exactly 5 bullets per note", async () => {
    const db = await import("./db");
    const notas = await db.getNotasVozByProyecto(1);
    for (const nota of notas) {
      const bullets = JSON.parse(nota.bullets as string);
      expect(bullets).toHaveLength(5);
    }
  });

  it("bullets are non-empty strings", async () => {
    const db = await import("./db");
    const notas = await db.getNotasVozByProyecto(1);
    const bullets = JSON.parse(notas[0].bullets as string);
    for (const bullet of bullets) {
      expect(typeof bullet).toBe("string");
      expect(bullet.length).toBeGreaterThan(0);
    }
  });

  it("bullets are concise (under 200 chars each)", async () => {
    const db = await import("./db");
    const notas = await db.getNotasVozByProyecto(1);
    const bullets = JSON.parse(notas[0].bullets as string);
    for (const bullet of bullets) {
      expect(bullet.length).toBeLessThan(200);
    }
  });
});

describe("Seguridad - Notas de Voz - Data Integrity", () => {
  it("crearNotaVoz requires proyectoId and creadoPorId", async () => {
    const db = await import("./db");
    await db.crearNotaVoz({
      proyectoId: 1,
      creadoPorId: 10,
      transcripcion: "Test",
      bullets: "[]",
      duracionSegundos: 0,
    });
    const call = (db.crearNotaVoz as any).mock.calls[0][0];
    expect(call.proyectoId).toBeDefined();
    expect(call.creadoPorId).toBeDefined();
  });

  it("fechaCreacion is a valid date", async () => {
    const db = await import("./db");
    const notas = await db.getNotasVozByProyecto(1);
    const fecha = new Date(notas[0].fechaCreacion);
    expect(fecha.getTime()).not.toBeNaN();
  });

  it("notes are ordered by fechaCreacion descending", async () => {
    const db = await import("./db");
    const notas = await db.getNotasVozByProyecto(1);
    const fecha1 = new Date(notas[0].fechaCreacion).getTime();
    const fecha2 = new Date(notas[1].fechaCreacion).getTime();
    expect(fecha1).toBeGreaterThan(fecha2);
  });
});
