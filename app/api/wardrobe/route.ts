import { apiError, getWardrobeBindings, requireApiUser, safeJsonArray, toWardrobeItem } from "@/lib/wardrobe-backend";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireApiUser();
    const { db } = getWardrobeBindings();
    const result = await db
      .prepare(
        `
      SELECT i.id, i.import_id, i.name, i.category, i.color, i.season, i.description, i.image_key, i.tags,
        i.favorite, i.brand, i.size, i.notes, i.price_cents, i.in_laundry,
        COUNT(w.id) AS wear_count, MAX(w.worn_on) AS last_worn
      FROM wardrobe_items i
      LEFT JOIN wardrobe_wears w ON w.item_id = i.id AND w.user_id = i.user_id
      WHERE i.user_id = ? AND i.status = 'ready'
      GROUP BY i.id
      ORDER BY i.created_at DESC
      LIMIT 500
    `,
      )
      .bind(user.userId)
      .all();
    return Response.json({ items: result.results.map((row) => toWardrobeItem(row as Record<string, unknown>)) });
  } catch (error) {
    return apiError(error, "Your closet could not be loaded. Try again.");
  }
}

const CATEGORIES = new Set(["Tops", "Bottoms", "Outerwear", "Dresses", "Shoes", "Accessories", "Other"]);
const TEXT_LIMITS = { name: 120, color: 80, season: 80, description: 600 } as const;
const OPTIONAL_TEXT_LIMITS = { brand: 80, size: 40, notes: 1000 } as const;

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    const payload = (await request.json()) as Record<string, unknown>;
    if (typeof payload.id !== "string" || !payload.id)
      return Response.json({ error: "Choose a valid closet item." }, { status: 400 });

    const columns: string[] = [];
    const values: Array<string | number | null> = [];
    if (payload.favorite !== undefined) {
      if (typeof payload.favorite !== "boolean")
        return Response.json({ error: "Choose a valid closet item." }, { status: 400 });
      columns.push("favorite = ?");
      values.push(payload.favorite ? 1 : 0);
    }
    for (const [field, limit] of Object.entries(TEXT_LIMITS)) {
      const value = payload[field];
      if (value === undefined) continue;
      if (typeof value !== "string" || (field !== "description" && !value.trim()))
        return Response.json({ error: `Enter a ${field} for this piece.` }, { status: 400 });
      columns.push(`${field} = ?`);
      values.push(value.trim().slice(0, limit));
    }
    for (const [field, limit] of Object.entries(OPTIONAL_TEXT_LIMITS)) {
      const value = payload[field];
      if (value === undefined) continue;
      if (typeof value !== "string") return Response.json({ error: `Enter a valid ${field}.` }, { status: 400 });
      columns.push(`${field} = ?`);
      values.push(value.trim().slice(0, limit));
    }
    if (payload.price !== undefined) {
      const price = payload.price;
      if (price !== null && (typeof price !== "number" || !Number.isFinite(price) || price < 0 || price > 1_000_000))
        return Response.json({ error: "Enter a valid price." }, { status: 400 });
      columns.push("price_cents = ?");
      values.push(price === null ? null : Math.round(price * 100));
    }
    if (payload.inLaundry !== undefined) {
      if (typeof payload.inLaundry !== "boolean")
        return Response.json({ error: "Choose a valid closet item." }, { status: 400 });
      columns.push("in_laundry = ?");
      values.push(payload.inLaundry ? 1 : 0);
    }
    if (payload.category !== undefined) {
      if (typeof payload.category !== "string" || !CATEGORIES.has(payload.category))
        return Response.json({ error: "Choose a valid category." }, { status: 400 });
      columns.push("category = ?");
      values.push(payload.category);
    }
    if (!columns.length) return Response.json({ error: "Nothing to update." }, { status: 400 });

    const { db } = getWardrobeBindings();
    const result = await db
      .prepare(`UPDATE wardrobe_items SET ${columns.join(", ")} WHERE id = ? AND user_id = ? AND status = 'ready'`)
      .bind(...values, payload.id, user.userId)
      .run();
    if (!result.meta.changes) return Response.json({ error: "That closet item was not found." }, { status: 404 });
    return Response.json({ id: payload.id, saved: true });
  } catch (error) {
    return apiError(error, "That change could not be saved. Try again.");
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Choose a valid closet item." }, { status: 400 });
    const { db, bucket } = getWardrobeBindings();
    const item = await db
      .prepare(`SELECT image_key FROM wardrobe_items WHERE id = ? AND user_id = ? AND status = 'ready'`)
      .bind(id, user.userId)
      .first<{ image_key: string }>();
    if (!item) return Response.json({ error: "That closet item was not found." }, { status: 404 });

    const looks = await db
      .prepare(`SELECT id, item_ids FROM wardrobe_outfits WHERE user_id = ? AND item_ids LIKE ?`)
      .bind(user.userId, `%${JSON.stringify(id)}%`)
      .all<{ id: string; item_ids: string }>();
    await db.batch([
      db.prepare(`DELETE FROM wardrobe_items WHERE id = ? AND user_id = ?`).bind(id, user.userId),
      db.prepare(`DELETE FROM wardrobe_wears WHERE item_id = ? AND user_id = ?`).bind(id, user.userId),
      ...looks.results.map((look) =>
        db
          .prepare(`UPDATE wardrobe_outfits SET item_ids = ? WHERE id = ? AND user_id = ?`)
          .bind(JSON.stringify(safeJsonArray(look.item_ids).filter((itemId) => itemId !== id)), look.id, user.userId),
      ),
    ]);

    // Keep the stored image while another piece or the original import still points at it.
    const stillUsed = await db
      .prepare(
        `SELECT 1 FROM wardrobe_items WHERE image_key = ? UNION SELECT 1 FROM wardrobe_imports WHERE original_key = ? LIMIT 1`,
      )
      .bind(item.image_key, item.image_key)
      .first();
    if (!stillUsed) await bucket.delete(item.image_key);
    return Response.json({ id, deleted: true });
  } catch (error) {
    return apiError(error, "That piece could not be deleted. Try again.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const payload = (await request.json()) as { importId?: string; itemIds?: string[] };
    const itemIds = [
      ...new Set((payload.itemIds ?? []).filter((id): id is string => typeof id === "string" && id.length > 0)),
    ];
    if (!payload.importId || !itemIds.length || itemIds.length > 12)
      return Response.json({ error: "Choose at least one detected piece." }, { status: 400 });
    const { db } = getWardrobeBindings();
    const owned = await db
      .prepare(`SELECT id FROM wardrobe_items WHERE import_id = ? AND user_id = ? AND status = 'draft'`)
      .bind(payload.importId, user.userId)
      .all();
    const ownedIds = new Set(owned.results.map((row) => String(row.id)));
    if (itemIds.some((id) => !ownedIds.has(id)))
      return Response.json({ error: "One or more detected pieces are no longer available." }, { status: 409 });
    const statements = [
      db
        .prepare(
          `UPDATE wardrobe_items SET status = 'rejected' WHERE import_id = ? AND user_id = ? AND status = 'draft'`,
        )
        .bind(payload.importId, user.userId),
    ];
    statements.push(
      ...itemIds.map((id) =>
        db
          .prepare(`UPDATE wardrobe_items SET status = 'ready' WHERE id = ? AND import_id = ? AND user_id = ?`)
          .bind(id, payload.importId, user.userId),
      ),
    );
    statements.push(
      db
        .prepare(`UPDATE wardrobe_imports SET status = 'confirmed' WHERE id = ? AND user_id = ?`)
        .bind(payload.importId, user.userId),
    );
    await db.batch(statements);
    return Response.json({ saved: itemIds.length });
  } catch (error) {
    return apiError(error, "Those pieces could not be added. Try again.");
  }
}
