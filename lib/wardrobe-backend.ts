import { env } from "cloudflare:workers";
import { getUser } from "@/lib/auth";

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function requireApiUser() {
  const user = await getUser();
  if (!user)
    throw new Response(JSON.stringify({ error: "Sign in to use your closet." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  return user;
}

export function getWardrobeBindings() {
  if (!env.DB || !env.BUCKET) throw new Error("Wardrobe storage is not configured.");
  return { db: env.DB, bucket: env.BUCKET };
}

export function apiError(error: unknown, fallback = "Rove could not complete that request.") {
  if (error instanceof Response) return error;
  console.error(error);
  const message = error instanceof Error && error.message.includes("not configured") ? error.message : fallback;
  return Response.json({ error: message }, { status: 500 });
}

export function assetUrl(key: string) {
  return `/api/assets/${encodeURIComponent(key)}`;
}

export function safeJsonArray(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function toWardrobeItem(row: Record<string, unknown>) {
  const imageKey = String(row.image_key ?? "");
  return {
    id: String(row.id),
    importId: row.import_id ? String(row.import_id) : null,
    name: String(row.name),
    category: String(row.category),
    color: String(row.color),
    season: String(row.season),
    description: String(row.description),
    image: assetUrl(imageKey),
    favorite: Boolean(row.favorite),
    tags: safeJsonArray(row.tags),
  };
}
