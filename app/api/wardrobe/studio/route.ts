import { env } from "cloudflare:workers";
import {
  STUDIO_MODEL,
  STUDIO_OUTPUT_SIDE,
  base64ImageType,
  studioErrorMessage,
  studioPrompt,
} from "@/lib/studio-photo";
import { apiError, getWardrobeBindings, requireApiUser } from "@/lib/wardrobe-backend";

export const dynamic = "force-dynamic";

/**
 * Redraws a piece as a clean product photo with Workers AI. `image` is the piece's cutout on
 * white, under 512×512 (see studioInput). Returns the generated photo; nothing is saved until
 * the browser keys out its backdrop and sends the result to /api/wardrobe/image.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const form = await request.formData();
    const id = form.get("id");
    const image = form.get("image");
    if (typeof id !== "string" || !id) return Response.json({ error: "Choose a closet item." }, { status: 400 });
    if (!(image instanceof File) || image.type !== "image/jpeg" || image.size === 0 || image.size > 1024 * 1024)
      return Response.json({ error: "Send the piece as a small JPEG." }, { status: 400 });
    const { db } = getWardrobeBindings();
    const item = await db
      .prepare(`SELECT name, category, color FROM wardrobe_items WHERE id = ? AND user_id = ? AND status = 'ready'`)
      .bind(id, user.userId)
      .first<{ name: string; category: string; color: string }>();
    if (!item) return Response.json({ error: "That closet item was not found." }, { status: 404 });
    if (!env.AI)
      return Response.json({ error: "Studio photos only work once Rove is deployed to Cloudflare." }, { status: 503 });

    const input = new FormData();
    input.append("prompt", studioPrompt(item.name, item.category, item.color));
    input.append("input_image_0", image);
    input.append("width", String(STUDIO_OUTPUT_SIDE));
    input.append("height", String(STUDIO_OUTPUT_SIDE));
    // FormData has no public body; a Response serializes it with its multipart boundary.
    const encoded = new Response(input);
    let result: { image?: string };
    try {
      result = await env.AI.run(STUDIO_MODEL, {
        multipart: { body: encoded.body ?? undefined, contentType: encoded.headers.get("content-type") ?? undefined },
      });
    } catch (error) {
      console.error("Studio photo failed", error);
      return Response.json({ error: studioErrorMessage(error) }, { status: 502 });
    }
    const type = result.image ? base64ImageType(result.image) : null;
    if (!result.image || !type) return Response.json({ error: studioErrorMessage(null) }, { status: 502 });
    const bytes = Uint8Array.from(atob(result.image), (char) => char.charCodeAt(0));
    return new Response(bytes, { headers: { "content-type": type, "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error, "The studio photo could not be made. Try again.");
  }
}
