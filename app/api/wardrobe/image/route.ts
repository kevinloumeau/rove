import { apiError, assetUrl, getWardrobeBindings, requireApiUser } from "@/lib/wardrobe-backend";

export const dynamic = "force-dynamic";

/** Replaces a piece's cutout with an edited PNG (from the "Fix cutout" editor). */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const form = await request.formData();
    const id = form.get("id");
    const image = form.get("image");
    if (typeof id !== "string" || !id) return Response.json({ error: "Choose a closet item." }, { status: 400 });
    if (!(image instanceof File) || image.type !== "image/png" || !image.size || image.size > 8 * 1024 * 1024)
      return Response.json({ error: "Send the edited cutout as a PNG under 8 MB." }, { status: 400 });
    const { db, bucket } = getWardrobeBindings();
    const item = await db
      .prepare(`SELECT image_key, import_id FROM wardrobe_items WHERE id = ? AND user_id = ? AND status = 'ready'`)
      .bind(id, user.userId)
      .first<{ image_key: string; import_id: string | null }>();
    if (!item) return Response.json({ error: "That closet item was not found." }, { status: 404 });

    const imageKey = `${crypto.randomUUID()}.png`;
    await bucket.put(imageKey, image.stream(), {
      httpMetadata: { contentType: "image/png", cacheControl: "private, max-age=3600" },
      customMetadata: { owner: user.userId, importId: item.import_id ?? "", generated: "edited" },
    });
    await db
      .prepare(`UPDATE wardrobe_items SET image_key = ? WHERE id = ? AND user_id = ?`)
      .bind(imageKey, id, user.userId)
      .run();
    // Keep the old file while the original import or another piece still points at it.
    const stillUsed = await db
      .prepare(
        `SELECT 1 FROM wardrobe_items WHERE image_key = ? UNION SELECT 1 FROM wardrobe_imports WHERE original_key = ? LIMIT 1`,
      )
      .bind(item.image_key, item.image_key)
      .first();
    if (!stillUsed) await bucket.delete(item.image_key);
    return Response.json({ id, image: assetUrl(imageKey) });
  } catch (error) {
    return apiError(error, "That cutout could not be saved. Try again.");
  }
}
