import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    console.log("[OAuth] Callback recibido, procesando autenticación...");

    if (!code || !state) {
      console.error("[OAuth] Faltan parámetros code o state");
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      // Paso 1: Intercambiar código por token
      console.log("[OAuth] Intercambiando código por token...");
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      
      // Paso 2: Obtener información del usuario
      console.log("[OAuth] Obteniendo información del usuario...");
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        console.error("[OAuth] openId no encontrado en la respuesta");
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      console.log(`[OAuth] Usuario autenticado: ${userInfo.email || userInfo.name || userInfo.openId}`);

      // Paso 3: Crear o actualizar usuario en la base de datos
      try {
        await db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: new Date(),
        });
        console.log("[OAuth] Usuario guardado/actualizado en BD");
      } catch (dbError) {
        console.error("[OAuth] Error al guardar usuario en BD:", dbError);
        // Continuar de todos modos, el usuario puede autenticarse
      }

      // Paso 4: Crear token de sesión
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      // Paso 5: Establecer cookie de sesión
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      console.log("[OAuth] Sesión creada exitosamente, redirigiendo a inicio...");
      res.redirect(302, "/");
    } catch (error: any) {
      console.error("[OAuth] Callback failed:", error?.message || error);
      
      // Proporcionar más información sobre el error
      const errorMessage = error?.message || "OAuth callback failed";
      const errorDetails = error?.response?.data || error?.toString() || "Unknown error";
      console.error("[OAuth] Error details:", errorDetails);
      
      // Redirigir a login con mensaje de error
      res.redirect(302, `/login?error=${encodeURIComponent(errorMessage)}`);
    }
  });

  // Ruta para verificar estado de autenticación (útil para debugging)
  app.get("/api/auth/status", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ 
        authenticated: true, 
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          role: user.role,
          empresaId: user.empresaId 
        } 
      });
    } catch (error) {
      res.json({ authenticated: false, error: "No session" });
    }
  });
}
