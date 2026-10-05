import { deleteIfUnused } from "@/lib/storage-cleanup";
import { apiError, assetUrl, getWardrobeBindings, requireApiUser } from "@/lib/wardrobe-backend";

export const dynamic = "force-dynamic";

/**
 * Replaces a piece's cutout (`image`, a PNG from the "Fix cutout" editor), its grid thumbnail
 * (`thumb`, a WebP), or both.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const form = await request.formData();
    const id = form.get("id");
    const image = form.get("image");
    const thumb = form.get("thumb");
    if (typeof id !== "string" || !id) return Response.json({ error: "Choose a closet item." }, { status: 400 });
    const imageOk =
      image instanceof File && image.type === "image/png" && image.size > 0 && image.size <= 8 * 1024 * 1024;
    const thumbOk = thumb instanceof File && thumb.type === "image/webp" && thumb.size > 0 && thumb.size <= 512 * 1024;
    if ((image !== null && !imageOk) || (thumb !== null && !thumbOk) || (!imageOk && !thumbOk))
      return Response.json({ error: "Send the cutout as a PNG under 8 MB or a WebP thumbnail." }, { status: 400 });
    const { db, bucket } = getWardrobeBindings();
    const item = await db
      .prepare(
        `SELECT image_key, thumb_key, import_id FROM wardrobe_items WHERE id = ? AND user_id = ? AND status = 'ready'`,
      )
      .bind(id, user.userId)
      .first<{ image_key: string; thumb_key: string; import_id: string | null }>();
    if (!item) return Response.json({ error: "That closet item was not found." }, { status: 404 });

    const metadata = { owner: user.userId, importId: item.import_id ?? "" };
    let imageKey = item.image_key;
    let thumbKey = item.thumb_key;
    if (imageOk) {
      imageKey = `${crypto.randomUUID()}.png`;
      await bucket.put(imageKey, image.stream(), {
        httpMetadata: { contentType: "image/png", cacheControl: "private, max-age=3600" },
        customMetadata: { ...metadata, generated: "edited" },
      });
    }
    if (thumbOk) {
      thumbKey = `${crypto.randomUUID()}.webp`;
      await bucket.put(thumbKey, thumb.stream(), {
        httpMetadata: { contentType: "image/webp", cacheControl: "private, max-age=86400" },
        customMetadata: { ...metadata, generated: "thumb" },
      });
    } else if (imageOk) {
      // A new cutout makes the old thumbnail stale; the closet regenerates it.
      thumbKey = "";
    }
    await db
      .prepare(`UPDATE wardrobe_items SET image_key = ?, thumb_key = ? WHERE id = ? AND user_id = ?`)
      .bind(imageKey, thumbKey, id, user.userId)
      .run();
    await deleteIfUnused(
      db,
      bucket,
      [item.image_key, item.thumb_key].filter((key) => key !== imageKey && key !== thumbKey),
    );
    return Response.json({ id, image: assetUrl(imageKey), thumb: thumbKey ? assetUrl(thumbKey) : null });
  } catch (error) {
    return apiError(error, "That cutout could not be saved. Try again.");
  }
}
