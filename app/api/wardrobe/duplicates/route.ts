import { DUPLICATE_DISTANCE, hashDistance } from "@/lib/photo-hash";
import { apiError, assetUrl, getWardrobeBindings, requireApiUser } from "@/lib/wardrobe-backend";

export const dynamic = "force-dynamic";

/** Closet pieces that came from a photo that looks like this one: GET /api/wardrobe/duplicates?hash=… */
export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const hash = new URL(request.url).searchParams.get("hash") ?? "";
    if (!/^[0-9a-f]{16}$/.test(hash)) return Response.json({ error: "Send a photo hash." }, { status: 400 });
    const { db } = getWardrobeBindings();
    const rows = await db
      .prepare(
        `SELECT i.id, i.name, i.image_key, m.photo_hash
         FROM wardrobe_items i JOIN wardrobe_imports m ON m.id = i.import_id
         WHERE i.user_id = ? AND i.status = 'ready' AND m.photo_hash IS NOT NULL`,
      )
      .bind(user.userId)
      .all<{ id: string; name: string; image_key: string; photo_hash: string }>();
    const matches = rows.results
      .filter((row) => hashDistance(row.photo_hash, hash) <= DUPLICATE_DISTANCE)
      .map((row) => ({ id: row.id, name: row.name, image: assetUrl(row.image_key) }));
    return Response.json({ matches });
  } catch (error) {
    return apiError(error, "Rove could not check for duplicates.");
  }
}
