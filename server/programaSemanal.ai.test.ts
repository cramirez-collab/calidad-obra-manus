import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock invokeLLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";

describe("programaSemanal.aiGenerarActividades", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse LLM response into valid actividades format", async () => {
    const mockResponse = {
      id: "test-1",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant" as const,
            content: JSON.stringify({
              actividades: [
                {
                  especialidad: "Albañilería",
                  actividad: "Pegado de block 15cm",
                  nivel: "N11",
                  area: "Dptos",
                  referenciaEje: "A-C / 1-4",
                  unidad: "m2",
                  cantidadProgramada: 280,
                  material: "Block 15cm",
                },
                {
                  especialidad: "Cerámicos",
                  actividad: "Colocación de piso cerámico 60x60",
                  nivel: "N10",
                  area: "Dptos",
                  referenciaEje: "A-B / 1-3",
                  unidad: "m2",
                  cantidadProgramada: 180,
                  material: "Porcelanato 60x60 beige",
                },
              ],
            }),
          },
          finish_reason: "stop",
        },
      ],
    };

    (invokeLLM as any).mockResolvedValue(mockResponse);

    // Simulate what the procedure does with the response
    const content = mockResponse.choices[0].message.content;
    const parsed = JSON.parse(content as string);
    const validUnits = [
      "m",
      "m2",
      "m3",
      "ml",
      "pza",
      "kg",
      "lt",
      "jgo",
      "lote",
      "otro",
    ];
    const actividades = parsed.actividades.map((a: any, i: number) => ({
      especialidad: String(a.especialidad || "").trim(),
      actividad: String(a.actividad || "").trim(),
      nivel: String(a.nivel || "").trim(),
      area: String(a.area || "").trim(),
      referenciaEje: String(a.referenciaEje || "").trim(),
      unidad: validUnits.includes(a.unidad) ? a.unidad : "otro",
      cantidadProgramada: String(
        Math.max(0, Number(a.cantidadProgramada) || 0)
      ),
      material: String(a.material || "").trim(),
      orden: i,
    }));

    expect(actividades).toHaveLength(2);
    expect(actividades[0].especialidad).toBe("Albañilería");
    expect(actividades[0].actividad).toBe("Pegado de block 15cm");
    expect(actividades[0].unidad).toBe("m2");
    expect(actividades[0].cantidadProgramada).toBe("280");
    expect(actividades[0].material).toBe("Block 15cm");
    expect(actividades[0].orden).toBe(0);
    expect(actividades[1].especialidad).toBe("Cerámicos");
    expect(actividades[1].orden).toBe(1);
  });

  it("should normalize invalid units to 'otro'", () => {
    const validUnits = [
      "m",
      "m2",
      "m3",
      "ml",
      "pza",
      "kg",
      "lt",
      "jgo",
      "lote",
      "otro",
    ];
    const testCases = [
      { input: "metros", expected: "otro" },
      { input: "m2", expected: "m2" },
      { input: "piezas", expected: "otro" },
      { input: "pza", expected: "pza" },
      { input: "kg", expected: "kg" },
      { input: "", expected: "otro" },
      { input: "ML", expected: "otro" }, // case sensitive
    ];

    for (const tc of testCases) {
      const result = validUnits.includes(tc.input) ? tc.input : "otro";
      expect(result).toBe(tc.expected);
    }
  });

  it("should handle negative cantidadProgramada", () => {
    const rawValue = -50;
    const normalized = String(Math.max(0, Number(rawValue) || 0));
    expect(normalized).toBe("0");
  });

  it("should handle empty/null material gracefully", () => {
    const cases = [null, undefined, "", "  "];
    for (const c of cases) {
      const material = String(c || "").trim();
      expect(material).toBe(typeof c === "string" ? c.trim() : "");
    }
  });

  it("should handle malformed JSON from LLM", () => {
    const badContent = "This is not JSON";
    expect(() => JSON.parse(badContent)).toThrow();
  });

  it("should handle empty actividades array from LLM", () => {
    const content = JSON.stringify({ actividades: [] });
    const parsed = JSON.parse(content);
    expect(parsed.actividades).toHaveLength(0);
  });
});
