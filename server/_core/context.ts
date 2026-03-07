import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  ip: string;
  userAgent: string;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
    // Renovar cookie en cada request para que la sesión nunca expire
    if (user) {
      const { COOKIE_NAME, ONE_YEAR_MS } = await import("@shared/const");
      const { getSessionCookieOptions } = await import("./cookies");
      const sessionCookie = opts.req.cookies?.[COOKIE_NAME] || opts.req.headers.cookie?.split(COOKIE_NAME + '=')[1]?.split(';')[0];
      if (sessionCookie) {
        const cookieOptions = getSessionCookieOptions(opts.req);
        opts.res.cookie(COOKIE_NAME, sessionCookie, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  const ip = (opts.req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || opts.req.socket.remoteAddress
    || 'unknown';
  const userAgent = opts.req.headers['user-agent'] || 'unknown';

  return {
    req: opts.req,
    res: opts.res,
    user,
    ip,
    userAgent,
  };
}
