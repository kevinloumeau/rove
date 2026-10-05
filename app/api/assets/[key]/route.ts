import { apiError, getWardrobeBindings, requireApiUser } from "@/lib/wardrobe-backend";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  try {
    const user = await requireApiUser();
    const { key } = await context.params;
    const { db, bucket } = getWardrobeBindings();
    const owned = await db.prepare(`
      SELECT 1 FROM wardrobe_items WHERE image_key = ? AND user_id = ?
      UNION SELECT 1 FROM wardrobe_imports WHERE original_key = ? AND user_id = ?
      LIMIT 1
    `).bind(key, user.userId, key, user.userId).first();
    if (!owned) return Response.json({ error: "Image not found." }, { status: 404 });
    const object = await bucket.get(key);
    if (!object) return Response.json({ error: "Image not found." }, { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "private, max-age=3600");
    headers.set("x-content-type-options", "nosniff");
    return new Response(object.body, { headers });
  } catch (error) {
    return apiError(error, "That image could not be loaded.");
  }
}
