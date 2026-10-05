import { apiError, getWardrobeBindings, requireApiUser } from "@/lib/wardrobe-backend";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireApiUser();
    const { db } = getWardrobeBindings();
    const result = await db
      .prepare(
        `SELECT id, name, occasion, item_ids, favorite FROM wardrobe_outfits WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`,
      )
      .bind(user.userId)
      .all();
    return Response.json({
      looks: result.results.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        occasion: String(row.occasion),
        itemIds: JSON.parse(String(row.item_ids || "[]")),
        favorite: Boolean(row.favorite),
      })),
    });
  } catch (error) {
    return apiError(error, "Your saved looks could not be loaded. Try again.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const payload = (await request.json()) as {
      id?: string;
      name?: string;
      occasion?: string;
      itemIds?: Array<string | number>;
    };
    const itemIds = (payload.itemIds ?? [])
      .filter((id) => typeof id === "string" || typeof id === "number")
      .slice(0, 12);
    if (!payload.id || !payload.name?.trim() || !itemIds.length)
      return Response.json({ error: "Add at least one piece before saving this look." }, { status: 400 });
    const { db } = getWardrobeBindings();
    await db
      .prepare(
        `INSERT OR IGNORE INTO wardrobe_outfits (id, user_id, name, occasion, item_ids, favorite, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)`,
      )
      .bind(
        payload.id,
        user.userId,
        payload.name.trim().slice(0, 80),
        payload.occasion?.slice(0, 30) || "Casual",
        JSON.stringify(itemIds),
        Date.now(),
      )
      .run();
    return Response.json({ saved: true, id: payload.id });
  } catch (error) {
    return apiError(error, "That look could not be saved. Try again.");
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    const payload = (await request.json()) as {
      id?: string;
      favorite?: unknown;
      name?: unknown;
      occasion?: unknown;
      itemIds?: unknown;
    };
    if (!payload.id) return Response.json({ error: "Choose a valid saved look." }, { status: 400 });
    const columns: string[] = [];
    const values: Array<string | number> = [];
    if (payload.favorite !== undefined) {
      if (typeof payload.favorite !== "boolean")
        return Response.json({ error: "Choose a valid saved look." }, { status: 400 });
      columns.push("favorite = ?");
      values.push(payload.favorite ? 1 : 0);
    }
    if (payload.name !== undefined) {
      if (typeof payload.name !== "string" || !payload.name.trim())
        return Response.json({ error: "Give this look a name." }, { status: 400 });
      columns.push("name = ?");
      values.push(payload.name.trim().slice(0, 80));
    }
    if (payload.occasion !== undefined) {
      if (typeof payload.occasion !== "string" || !payload.occasion.trim())
        return Response.json({ error: "Choose an occasion." }, { status: 400 });
      columns.push("occasion = ?");
      values.push(payload.occasion.trim().slice(0, 30));
    }
    if (payload.itemIds !== undefined) {
      const itemIds = Array.isArray(payload.itemIds)
        ? payload.itemIds.filter((id) => typeof id === "string" || typeof id === "number").slice(0, 12)
        : [];
      if (!itemIds.length) return Response.json({ error: "Add at least one piece to this look." }, { status: 400 });
      columns.push("item_ids = ?");
      values.push(JSON.stringify(itemIds));
    }
    if (!columns.length) return Response.json({ error: "Nothing to update." }, { status: 400 });
    const { db } = getWardrobeBindings();
    const result = await db
      .prepare(`UPDATE wardrobe_outfits SET ${columns.join(", ")} WHERE id = ? AND user_id = ?`)
      .bind(...values, payload.id, user.userId)
      .run();
    if (!result.meta.changes) return Response.json({ error: "That saved look was not found." }, { status: 404 });
    return Response.json({ saved: true });
  } catch (error) {
    return apiError(error, "That look could not be saved. Try again.");
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Choose a valid saved look." }, { status: 400 });
    const { db } = getWardrobeBindings();
    const [deleted] = await db.batch([
      db.prepare(`DELETE FROM wardrobe_outfits WHERE id = ? AND user_id = ?`).bind(id, user.userId),
      db.prepare(`DELETE FROM wardrobe_plans WHERE outfit_id = ? AND user_id = ?`).bind(id, user.userId),
    ]);
    if (!deleted.meta.changes) return Response.json({ error: "That saved look was not found." }, { status: 404 });
    return Response.json({ id, deleted: true });
  } catch (error) {
    return apiError(error, "That look could not be deleted. Try again.");
  }
}
