import { apiError, getWardrobeBindings, isIsoDate, requireApiUser } from "@/lib/wardrobe-backend";

export const dynamic = "force-dynamic";

/** Logs that pieces were worn on a day. Logging the same piece twice for one day is a no-op. */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const payload = (await request.json()) as { itemIds?: unknown; date?: unknown };
    const itemIds = Array.isArray(payload.itemIds)
      ? [...new Set(payload.itemIds.filter((id): id is string => typeof id === "string" && id.length > 0))].slice(0, 20)
      : [];
    if (!itemIds.length || !isIsoDate(payload.date))
      return Response.json({ error: "Choose what you wore and when." }, { status: 400 });
    const { db } = getWardrobeBindings();
    const placeholders = itemIds.map(() => "?").join(", ");
    const owned = await db
      .prepare(`SELECT id FROM wardrobe_items WHERE user_id = ? AND status = 'ready' AND id IN (${placeholders})`)
      .bind(user.userId, ...itemIds)
      .all<{ id: string }>();
    if (!owned.results.length) return Response.json({ error: "Those pieces were not found." }, { status: 404 });
    const now = Date.now();
    await db.batch(
      owned.results.map(({ id }) =>
        db
          .prepare(
            `INSERT OR IGNORE INTO wardrobe_wears (id, user_id, item_id, worn_on, created_at) VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(crypto.randomUUID(), user.userId, id, payload.date, now),
      ),
    );
    return Response.json({ logged: owned.results.map(({ id }) => id), date: payload.date });
  } catch (error) {
    return apiError(error, "That wear could not be logged. Try again.");
  }
}

/** Removes a logged wear: DELETE /api/wears?itemId=…&date=YYYY-MM-DD */
export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser();
    const params = new URL(request.url).searchParams;
    const itemId = params.get("itemId");
    const date = params.get("date");
    if (!itemId || !isIsoDate(date)) return Response.json({ error: "Choose a logged wear." }, { status: 400 });
    const { db } = getWardrobeBindings();
    await db
      .prepare(`DELETE FROM wardrobe_wears WHERE user_id = ? AND item_id = ? AND worn_on = ?`)
      .bind(user.userId, itemId, date)
      .run();
    const remaining = await db
      .prepare(
        `SELECT COUNT(*) AS wear_count, MAX(worn_on) AS last_worn FROM wardrobe_wears WHERE user_id = ? AND item_id = ?`,
      )
      .bind(user.userId, itemId)
      .first<{ wear_count: number; last_worn: string | null }>();
    return Response.json({
      removed: true,
      wearCount: remaining?.wear_count ?? 0,
      lastWorn: remaining?.last_worn ?? null,
    });
  } catch (error) {
    return apiError(error, "That wear could not be removed. Try again.");
  }
}
