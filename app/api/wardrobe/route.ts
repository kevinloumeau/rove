import { apiError, getWardrobeBindings, requireApiUser, toWardrobeItem } from "@/lib/wardrobe-backend";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireApiUser();
    const { db } = getWardrobeBindings();
    const result = await db.prepare(`
      SELECT id, import_id, name, category, color, season, description, image_key, tags, favorite
      FROM wardrobe_items
      WHERE user_id = ? AND status = 'ready'
      ORDER BY created_at DESC
      LIMIT 500
    `).bind(user.userId).all();
    return Response.json({ items: result.results.map((row) => toWardrobeItem(row as Record<string, unknown>)) });
  } catch (error) {
    return apiError(error, "Your closet could not be loaded. Try again.");
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    const payload = await request.json() as { id?: string; favorite?: boolean };
    if (!payload.id || typeof payload.favorite !== "boolean") return Response.json({ error: "Choose a valid closet item." }, { status: 400 });
    const { db } = getWardrobeBindings();
    const result = await db.prepare(`
      UPDATE wardrobe_items SET favorite = ?
      WHERE id = ? AND user_id = ? AND status = 'ready'
    `).bind(payload.favorite ? 1 : 0, payload.id, user.userId).run();
    if (!result.meta.changes) return Response.json({ error: "That closet item was not found." }, { status: 404 });
    return Response.json({ id: payload.id, favorite: payload.favorite });
  } catch (error) {
    return apiError(error, "That change could not be saved. Try again.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const payload = await request.json() as { importId?: string; itemIds?: string[] };
    const itemIds = [...new Set((payload.itemIds ?? []).filter((id): id is string => typeof id === "string" && id.length > 0))];
    if (!payload.importId || !itemIds.length || itemIds.length > 12) return Response.json({ error: "Choose at least one detected piece." }, { status: 400 });
    const { db } = getWardrobeBindings();
    const owned = await db.prepare(`SELECT id FROM wardrobe_items WHERE import_id = ? AND user_id = ? AND status = 'draft'`).bind(payload.importId, user.userId).all();
    const ownedIds = new Set(owned.results.map((row) => String(row.id)));
    if (itemIds.some((id) => !ownedIds.has(id))) return Response.json({ error: "One or more detected pieces are no longer available." }, { status: 409 });
    const statements = [db.prepare(`UPDATE wardrobe_items SET status = 'rejected' WHERE import_id = ? AND user_id = ? AND status = 'draft'`).bind(payload.importId, user.userId)];
    statements.push(...itemIds.map((id) => db.prepare(`UPDATE wardrobe_items SET status = 'ready' WHERE id = ? AND import_id = ? AND user_id = ?`).bind(id, payload.importId, user.userId)));
    statements.push(db.prepare(`UPDATE wardrobe_imports SET status = 'confirmed' WHERE id = ? AND user_id = ?`).bind(payload.importId, user.userId));
    await db.batch(statements);
    return Response.json({ saved: itemIds.length });
  } catch (error) {
    return apiError(error, "Those pieces could not be added. Try again.");
  }
}
