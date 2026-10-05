// Verifies Cloudflare Access JWTs (RS256) against the team's published signing keys.
// Kept free of Worker and framework imports so it can be tested with plain Node.

export type AccessClaims = {
  aud?: string | string[];
  iss?: string;
  exp?: number;
  nbf?: number;
  sub?: string;
  email?: string;
};
type Jwk = JsonWebKey & { kid?: string };

const KEY_CACHE_MS = 10 * 60 * 1000;

let cachedKeys: { teamDomain: string; fetchedAt: number; keys: Map<string, CryptoKey> } | null = null;

function base64UrlDecode(value: string) {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signingKeys(teamDomain: string, forceRefresh = false) {
  if (!forceRefresh && cachedKeys?.teamDomain === teamDomain && Date.now() - cachedKeys.fetchedAt < KEY_CACHE_MS)
    return cachedKeys.keys;
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Could not load Cloudflare Access signing keys (${response.status}).`);
  const { keys = [] } = (await response.json()) as { keys?: Jwk[] };
  const imported = new Map<string, CryptoKey>();
  for (const jwk of keys) {
    if (!jwk.kid || jwk.kty !== "RSA") continue;
    imported.set(
      jwk.kid,
      await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]),
    );
  }
  cachedKeys = { teamDomain, fetchedAt: Date.now(), keys: imported };
  return imported;
}

export async function verifyAccessToken(
  token: string,
  teamDomain: string,
  audience: string,
): Promise<AccessClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  let header: { alg?: string; kid?: string };
  let claims: AccessClaims;
  try {
    const decoder = new TextDecoder();
    header = JSON.parse(decoder.decode(base64UrlDecode(encodedHeader)));
    claims = JSON.parse(decoder.decode(base64UrlDecode(encodedPayload)));
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;

  // Access rotates keys; refetch once when a token names a key we have not seen.
  let key = (await signingKeys(teamDomain)).get(header.kid);
  if (!key) key = (await signingKeys(teamDomain, true)).get(header.kid);
  if (!key) return null;

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlDecode(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!valid) return null;

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(audience)) return null;
  if (claims.iss !== `https://${teamDomain}`) return null;
  if (!claims.exp || claims.exp < now) return null;
  if (claims.nbf && claims.nbf > now + 60) return null;
  return claims;
}
