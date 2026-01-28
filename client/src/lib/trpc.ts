import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

// Función para obtener la URL de login OAuth
export function getLoginUrl() {
  const appId = import.meta.env.VITE_APP_ID;
  const portalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);
  return `${portalUrl}?app_id=${appId}&state=${state}`;
}
