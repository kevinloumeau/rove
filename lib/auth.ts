import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { verifyAccessToken } from "./access-jwt";

export type AppUser = { userId: string; email: string };

const ACCESS_HEADER = "cf-access-jwt-assertion";
const ACCESS_COOKIE = "CF_Authorization";

/**
 * Returns the visitor signed in through Cloudflare Access, or null.
 *
 * Every request is verified against the Access application's signing keys and AUD tag, so a
 * request that reaches the Worker without going through Access (for example on a workers.dev
 * URL left unprotected) is treated as signed out rather than trusted.
 */
export async function getUser(): Promise<AppUser | null> {
  const teamDomain = normalizeTeamDomain(env.ACCESS_TEAM_DOMAIN);
  const audience = env.ACCESS_AUD?.trim();

  if (!teamDomain || !audience) {
    // `vinext dev` simulates one signed-in user; production builds never take this branch.
    if (import.meta.env.DEV) {
      const email = env.DEV_USER_EMAIL?.trim() || "you@localhost";
      return { userId: `dev:${email}`, email };
    }
    throw new Error("Sign-in is not configured. Set ACCESS_TEAM_DOMAIN and ACCESS_AUD in wrangler.jsonc.");
  }

  const requestHeaders = await headers();
  const token = requestHeaders.get(ACCESS_HEADER) ?? readCookie(requestHeaders.get("cookie"), ACCESS_COOKIE);
  if (!token) return null;

  const claims = await verifyAccessToken(token, teamDomain, audience);
  if (!claims?.sub || !claims.email) return null;
  return { userId: claims.sub, email: claims.email };
}

function normalizeTeamDomain(value: string | undefined) {
  const trimmed = value
    ?.trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  return trimmed || null;
}

function readCookie(header: string | null, name: string) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}
