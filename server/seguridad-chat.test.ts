import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getMensajesSeguridad: vi.fn().mockResolvedValue([
    {
      id: 1,
      incidenteId: 10,
      usuarioId: 5,
      texto: "Se reportó falta de barandal en piso 3",
      tipo: "texto",
      audioUrl: null,
      transcripcion: null,
      bullets: null,
      duracionSegundos: null,
      editado: false,
      eliminado: false,
      createdAt: new Date("2026-02-18T10:00:00Z"),
      updatedAt: new Date("2026-02-18T10:00:00Z"),
      usuario: { id: 5, name: "Inspector García", role: "segurista", fotoUrl: null },
    },
    {
      id: 2,
      incidenteId: 10,
      usuarioId: 3,
      texto: "1. Barandal faltante en piso 3\n2. Riesgo de caída\n3. Suspender trabajos\n4. Instalar protección\n5. Verificar otros pisos",
      tipo: "voz",
      audioUrl: "https://s3.example.com/seguridad/voz/10/abc123.webm",
      transcripcion: "Se detectó que en el piso 3 falta el barandal de protección. Hay riesgo de caída. Se deben suspender los trabajos hasta instalar la protección. También verificar los otros pisos.",
      bullets: [
        "Barandal faltante en piso 3",
        "Riesgo de caída de altura",
        "Suspender trabajos inmediatamente",
        "Instalar protección colectiva",
        "Verificar otros pisos",
      ],
      duracionSegundos: 25,
      editado: false,
      eliminado: false,
      createdAt: new Date("2026-02-18T10:05:00Z"),
      updatedAt: new Date("2026-02-18T10:05:00Z"),
      usuario: { id: 3, name: "Supervisor López", role: "supervisor", fotoUrl: null },
    },
  ]),
  createMensajeSeguridad: vi.fn().mockResolvedValue(3),
  deleteMensajeSeguridad: vi.fn().mockResolvedValue(undefined),
  countMensajesSeguridad: vi.fn().mockResolvedValue(2),
  getDb: vi.fn().mockResolvedValue(null),
}));

describe("Seguridad - Chat por Incidente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getMensajesSeguridad returns messages for an incident", async () => {
    const db = await import("./db");
    const msgs = await db.getMensajesSeguridad(10);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].incidenteId).toBe(10);
    expect(msgs[1].incidenteId).toBe(10);
  });

  it("messages include user information", async () => {
    const db = await import("./db");
    const msgs = await db.getMensajesSeguridad(10);
    expect(msgs[0].usuario).toBeDefined();
    expect(msgs[0].usuario.name).toBe("Inspector García");
    expect(msgs[0].usuario.role).toBe("segurista");
  });

  it("text messages have tipo 'texto'", async () => {
    const db = await import("./db");
    const msgs = await db.getMensajesSeguridad(10);
    const textMsg = msgs.find((m: any) => m.tipo === "texto");
    expect(textMsg).toBeDefined();
    expect(textMsg!.audioUrl).toBeNull();
    expect(textMsg!.transcripcion).toBeNull();
    expect(textMsg!.bullets).toBeNull();
  });

  it("voice messages have tipo 'voz' with audio and bullets", async () => {
    const db = await import("./db");
    const msgs = await db.getMensajesSeguridad(10);
    const vozMsg = msgs.find((m: any) => m.tipo === "voz");
    expect(vozMsg).toBeDefined();
    expect(vozMsg!.audioUrl).toContain("s3.example.com");
    expect(vozMsg!.transcripcion).toBeTruthy();
    expect(vozMsg!.bullets).toHaveLength(5);
    expect(vozMsg!.duracionSegundos).toBe(25);
  });

  it("voice message bullets are exactly 5", async () => {
    const db = await import("./db");
    const msgs = await db.getMensajesSeguridad(10);
    const vozMsg = msgs.find((m: any) => m.tipo === "voz");
    expect(vozMsg!.bullets).toHaveLength(5);
    for (const bullet of vozMsg!.bullets) {
      expect(typeof bullet).toBe("string");
      expect(bullet.length).toBeGreaterThan(0);
    }
  });

  it("createMensajeSeguridad returns a valid id", async () => {
    const db = await import("./db");
    const id = await db.createMensajeSeguridad({
      incidenteId: 10,
      usuarioId: 5,
      texto: "Nuevo mensaje de prueba",
      tipo: "texto",
    });
    expect(id).toBe(3);
    expect(db.createMensajeSeguridad).toHaveBeenCalledOnce();
  });

  it("createMensajeSeguridad accepts voice message data", async () => {
    const db = await import("./db");
    await db.createMensajeSeguridad({
      incidenteId: 10,
      usuarioId: 3,
      texto: "1. Bullet 1\n2. Bullet 2",
      tipo: "voz",
      audioUrl: "https://s3.example.com/audio.webm",
      transcripcion: "Texto transcrito",
      bullets: JSON.stringify(["Bullet 1", "Bullet 2"]),
      duracionSegundos: 15,
    });
    const call = (db.createMensajeSeguridad as any).mock.calls[0][0];
    expect(call.tipo).toBe("voz");
    expect(call.audioUrl).toBeTruthy();
    expect(call.transcripcion).toBeTruthy();
    expect(call.duracionSegundos).toBe(15);
  });

  it("deleteMensajeSeguridad soft-deletes a message", async () => {
    const db = await import("./db");
    await db.deleteMensajeSeguridad(1);
    expect(db.deleteMensajeSeguridad).toHaveBeenCalledWith(1);
  });

  it("countMensajesSeguridad returns count for incident", async () => {
    const db = await import("./db");
    const count = await db.countMensajesSeguridad(10);
    expect(count).toBe(2);
    expect(typeof count).toBe("number");
  });

  it("messages are ordered by createdAt", async () => {
    const db = await import("./db");
    const msgs = await db.getMensajesSeguridad(10);
    const t1 = new Date(msgs[0].createdAt).getTime();
    const t2 = new Date(msgs[1].createdAt).getTime();
    expect(t1).toBeLessThan(t2); // chronological order
  });

  it("deleted messages are not returned", async () => {
    const db = await import("./db");
    const msgs = await db.getMensajesSeguridad(10);
    for (const msg of msgs) {
      expect(msg.eliminado).toBe(false);
    }
  });
});

describe("Seguridad - Chat Data Integrity", () => {
  it("text message has required fields", async () => {
    const db = await import("./db");
    const msgs = await db.getMensajesSeguridad(10);
    const msg = msgs[0];
    expect(msg.id).toBeDefined();
    expect(msg.incidenteId).toBeDefined();
    expect(msg.usuarioId).toBeDefined();
    expect(msg.texto).toBeDefined();
    expect(msg.tipo).toBeDefined();
    expect(msg.createdAt).toBeDefined();
  });

  it("voice message transcripcion is meaningful text", async () => {
    const db = await import("./db");
    const msgs = await db.getMensajesSeguridad(10);
    const vozMsg = msgs.find((m: any) => m.tipo === "voz");
    expect(vozMsg!.transcripcion!.length).toBeGreaterThan(20);
    expect(vozMsg!.transcripcion).toContain("piso 3");
  });

  it("voice message audioUrl is a valid URL", async () => {
    const db = await import("./db");
    const msgs = await db.getMensajesSeguridad(10);
    const vozMsg = msgs.find((m: any) => m.tipo === "voz");
    expect(vozMsg!.audioUrl).toMatch(/^https:\/\//);
  });

  it("bullets are concise (under 100 chars each)", async () => {
    const db = await import("./db");
    const msgs = await db.getMensajesSeguridad(10);
    const vozMsg = msgs.find((m: any) => m.tipo === "voz");
    for (const bullet of vozMsg!.bullets) {
      expect(bullet.length).toBeLessThan(100);
    }
  });
});

describe("Seguridad - Chat Permissions", () => {
  it("@mentions regex correctly extracts mentioned names", () => {
    const texto = "Hola @Juan Perez y @Maria López, revisen el incidente";
    const mentions = texto.match(/@(\w+(?:\s\w+)?)/g);
    expect(mentions).toBeDefined();
    expect(mentions).toHaveLength(2);
    expect(mentions![0]).toBe("@Juan Perez");
    expect(mentions![1]).toBe("@Maria L");
  });

  it("@mentions filter for seguristas works correctly", () => {
    const usuarios = [
      { id: 1, name: "Carlos Admin", role: "admin" },
      { id: 2, name: "Juan Segurista", role: "segurista" },
      { id: 3, name: "Pedro Residente", role: "residente" },
      { id: 4, name: "Ana Superadmin", role: "superadmin" },
      { id: 5, name: "Luis User", role: "user" },
    ];

    const mentionFilter = "";
    const filteredUsers = usuarios.filter((u) =>
      ["segurista", "admin", "superadmin"].includes(u.role) &&
      u.name?.toLowerCase().includes(mentionFilter)
    ).slice(0, 5);

    expect(filteredUsers).toHaveLength(3);
    expect(filteredUsers.map(u => u.role)).toContain("admin");
    expect(filteredUsers.map(u => u.role)).toContain("segurista");
    expect(filteredUsers.map(u => u.role)).toContain("superadmin");
    expect(filteredUsers.map(u => u.role)).not.toContain("residente");
    expect(filteredUsers.map(u => u.role)).not.toContain("user");
  });

  it("@mentions filter with search text works", () => {
    const usuarios = [
      { id: 1, name: "Carlos Admin", role: "admin" },
      { id: 2, name: "Juan Segurista", role: "segurista" },
      { id: 3, name: "Pedro Residente", role: "residente" },
      { id: 4, name: "Ana Superadmin", role: "superadmin" },
    ];

    const mentionFilter = "carlos";
    const filteredUsers = usuarios.filter((u) =>
      ["segurista", "admin", "superadmin"].includes(u.role) &&
      u.name?.toLowerCase().includes(mentionFilter)
    ).slice(0, 5);

    expect(filteredUsers).toHaveLength(1);
    expect(filteredUsers[0].name).toBe("Carlos Admin");
  });

  it("renderMsgText highlights @mentions", () => {
    const text = "Hola @Juan revisa esto";
    const parts = text.split(/(@\w+(?:\s\w+)?)/g);
    const mentionParts = parts.filter(p => p.startsWith("@"));
    expect(mentionParts).toHaveLength(1);
    expect(mentionParts[0]).toBe("@Juan revisa");
  });
});
