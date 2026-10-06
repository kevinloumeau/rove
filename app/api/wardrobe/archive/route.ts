import { isLetGoReason } from "@/lib/declutter";
import { apiError, getWardrobeBindings, requireApiUser, toWardrobeItem } from "@/lib/wardrobe-backend";

export const dynamic = "force-dynamic";

/** The let-go pile: pieces moved out of the closet to donate, sell or keep archived, newest first. */
export async function GET() {
  try {
    const user = await requireApiUser();
    const { db } = getWardrobeBindings();
    const result = await db
      .prepare(
        `
      SELECT i.id, i.import_id, i.name, i.category, i.color, i.season, i.description, i.image_key, i.thumb_key,
        i.tags, i.favorite, i.brand, i.size, i.notes, i.price_cents, i.in_laundry, i.kept_at, i.stored_at, i.created_at,
        i.archive_reason, i.archived_at, COUNT(w.id) AS wear_count, MAX(w.worn_on) AS last_worn
      FROM wardrobe_items i
      LEFT JOIN wardrobe_wears w ON w.item_id = i.id AND w.user_id = i.user_id
      WHERE i.user_id = ? AND i.status = 'archived'
      GROUP BY i.id
      ORDER BY i.archived_at DESC, i.id DESC
      LIMIT 1000
    `,
      )
      .bind(user.userId)
      .all<Record<string, unknown>>();
    return Response.json({ items: result.results.map((row) => toWardrobeItem(row)) });
  } catch (error) {
    return apiError(error, "Your let-go pile could not be loaded. Try again.");
  }
}

/**
 * Moves pieces out of the closet with `{ ids, reason }`, or back into it with `{ ids, restore: true }`.
 * Archived pieces keep their photos, wears and places in saved looks, so restoring brings everything back.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const payload = (await request.json()) as { ids?: unknown; reason?: unknown; restore?: unknown };
    const ids = Array.isArray(payload.ids)
      ? [...new Set(payload.ids.filter((id): id is string => typeof id === "string" && id.length > 0))]
      : [];
    if (!ids.length || ids.length > 200)
      return Response.json({ error: "Choose a valid closet item." }, { status: 400 });
    const placeholders = ids.map(() => "?").join(", ");
    const { db } = getWardrobeBindings();
    const now = Date.now();

    if (payload.restore === true) {
      // Restoring counts as a "keep", so the piece isn't suggested for letting go again straight away.
      const result = await db
        .prepare(
          `UPDATE wardrobe_items SET status = 'ready', archive_reason = '', archived_at = NULL, kept_at = ?
           WHERE user_id = ? AND status = 'archived' AND id IN (${placeholders})`,
        )
        .bind(now, user.userId, ...ids)
        .run();
      if (!result.meta.changes) return Response.json({ error: "That piece was not found." }, { status: 404 });
      return Response.json({ ids, restored: true });
    }

    if (!isLetGoReason(payload.reason))
      return Response.json({ error: "Choose donate, sell or archive." }, { status: 400 });
    const result = await db
      .prepare(
        `UPDATE wardrobe_items SET status = 'archived', archive_reason = ?, archived_at = ?, in_laundry = 0, stored_at = NULL
         WHERE user_id = ? AND status IN ('ready', 'archived') AND id IN (${placeholders})`,
      )
      .bind(payload.reason, now, user.userId, ...ids)
      .run();
    if (!result.meta.changes) return Response.json({ error: "That closet item was not found." }, { status: 404 });
    return Response.json({ ids, reason: payload.reason, archived: true });
  } catch (error) {
    return apiError(error, "That change could not be saved. Try again.");
  }
}
