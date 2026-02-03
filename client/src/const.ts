export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Siempre redirigir a la página de login local con usuario y contraseña
export const getLoginUrl = () => {
  return '/login';
};

// Función para obtener URL de OAuth de Manus (si se necesita en el futuro)
export const getOAuthUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
