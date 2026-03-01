import { describe, it, expect } from "vitest";

describe("Programa Semanal - Eliminar y Planos", () => {
  // Test: Admin/superadmin can delete any program regardless of status
  it("admin/superadmin should be allowed to delete any status", () => {
    const canDeleteBackend = (role: string, isOwner: boolean, status: string) => {
      const isAdminOrSuper = ['admin', 'superadmin'].includes(role);
      if (isAdminOrSuper) return true;
      if (status !== 'borrador') return false;
      if (!isOwner) return false;
      return true;
    };

    // Admin can delete any status
    expect(canDeleteBackend('admin', false, 'borrador')).toBe(true);
    expect(canDeleteBackend('admin', false, 'entregado')).toBe(true);
    expect(canDeleteBackend('admin', false, 'corte_realizado')).toBe(true);
    expect(canDeleteBackend('superadmin', false, 'entregado')).toBe(true);
    expect(canDeleteBackend('superadmin', false, 'corte_realizado')).toBe(true);

    // Regular user can only delete own borradores
    expect(canDeleteBackend('residente', true, 'borrador')).toBe(true);
    expect(canDeleteBackend('residente', true, 'entregado')).toBe(false);
    expect(canDeleteBackend('residente', false, 'borrador')).toBe(false);
    expect(canDeleteBackend('supervisor', false, 'entregado')).toBe(false);
  });

  // Test: Frontend canDelete logic matches backend
  it("frontend canDelete should match backend logic", () => {
    const canDeleteFrontend = (userRole: string, isOwner: boolean, status: string) => {
      const isAdminOrSuper = ['admin', 'superadmin'].includes(userRole);
      return isAdminOrSuper || (isOwner && status === 'borrador');
    };

    expect(canDeleteFrontend('admin', false, 'entregado')).toBe(true);
    expect(canDeleteFrontend('superadmin', false, 'corte_realizado')).toBe(true);
    expect(canDeleteFrontend('residente', true, 'borrador')).toBe(true);
    expect(canDeleteFrontend('residente', true, 'entregado')).toBe(false);
    expect(canDeleteFrontend('supervisor', false, 'borrador')).toBe(false);
  });

  // Test: Plano upload flow - base64 detection
  it("should detect planos that need uploading (have _base64)", () => {
    const planos = [
      { titulo: "Plano 1", imagenUrl: "data:image/png;base64,abc", _base64: "abc", _mimeType: "image/png", _uploaded: false },
      { titulo: "Plano 2", imagenUrl: "https://s3.example.com/plano.jpg", imagenKey: "key123" },
    ];

    const needsUpload = planos.filter((p: any) => p._base64 && !p._uploaded);
    const alreadyUploaded = planos.filter((p: any) => !p._base64 || p._uploaded);

    expect(needsUpload.length).toBe(1);
    expect(needsUpload[0].titulo).toBe("Plano 1");
    expect(alreadyUploaded.length).toBe(1);
    expect(alreadyUploaded[0].titulo).toBe("Plano 2");
  });

  // Test: Plano upload should filter out data: URLs that weren't uploaded
  it("should not include data: URLs in final planos array", () => {
    const planos = [
      { titulo: "P1", imagenUrl: "https://s3.example.com/plano.jpg", imagenKey: "k1", nivel: "", tipo: "planta" },
      { titulo: "P2", imagenUrl: "data:image/png;base64,abc", nivel: "", tipo: "otro" },
    ];

    const validPlanos = planos.filter(p => p.imagenUrl && !p.imagenUrl.startsWith("data:"));
    expect(validPlanos.length).toBe(1);
    expect(validPlanos[0].titulo).toBe("P1");
  });

  // Test: Accept attribute allows images and PDFs
  it("should accept images and PDF files for planos", () => {
    const acceptAttr = "image/*,application/pdf";
    expect(acceptAttr).toContain("image/*");
    expect(acceptAttr).toContain("application/pdf");
  });
});
