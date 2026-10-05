// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyAccessToken } from "../lib/access-jwt.ts";

const TEAM = "example.cloudflareaccess.com";
const AUD = "test-aud";

const { privateKey, publicKey } = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
);
const publicJwk = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid: "key-1" };
globalThis.fetch = async (input) => {
  assert.equal(String(input), `https://${TEAM}/cdn-cgi/access/certs`);
  return Response.json({ keys: [publicJwk] });
};

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
async function sign(claims: Record<string, unknown>, header: Record<string, unknown> = { alg: "RS256", kid: "key-1" }) {
  const unsigned = `${encode(header)}.${encode(claims)}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(unsigned));
  return `${unsigned}.${Buffer.from(signature).toString("base64url")}`;
}
const now = Math.floor(Date.now() / 1000);
const good = { aud: [AUD], iss: `https://${TEAM}`, exp: now + 300, sub: "user-123", email: "kevin@example.com" };

test("accepts a valid Access token", async () => {
  const claims = await verifyAccessToken(await sign(good), TEAM, AUD);
  assert.equal(claims?.sub, "user-123");
});

test("rejects the wrong audience, issuer or an expired token", async () => {
  assert.equal(await verifyAccessToken(await sign({ ...good, aud: ["other"] }), TEAM, AUD), null);
  assert.equal(await verifyAccessToken(await sign({ ...good, iss: "https://evil.example" }), TEAM, AUD), null);
  assert.equal(await verifyAccessToken(await sign({ ...good, exp: now - 10 }), TEAM, AUD), null);
});

test("rejects a tampered payload or an unsigned token", async () => {
  const [header, , signature] = (await sign(good)).split(".");
  const forged = `${header}.${encode({ ...good, sub: "someone-else" })}.${signature}`;
  assert.equal(await verifyAccessToken(forged, TEAM, AUD), null);
  assert.equal(await verifyAccessToken(`${encode({ alg: "none" })}.${encode(good)}.`, TEAM, AUD), null);
  assert.equal(await verifyAccessToken("not-a-jwt", TEAM, AUD), null);
});

test("rejects a token signed by an unknown key", async () => {
  assert.equal(await verifyAccessToken(await sign(good, { alg: "RS256", kid: "unknown" }), TEAM, AUD), null);
});
