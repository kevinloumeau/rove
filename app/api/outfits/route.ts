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
        `INSERT INTO wardrobe_outfits (id, user_id, name, occasion, item_ids, favorite, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)`,
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
    const payload = (await request.json()) as { id?: string; favorite?: boolean };
    if (!payload.id || typeof payload.favorite !== "boolean")
      return Response.json({ error: "Choose a valid saved look." }, { status: 400 });
    const { db } = getWardrobeBindings();
    await db
      .prepare(`UPDATE wardrobe_outfits SET favorite = ? WHERE id = ? AND user_id = ?`)
      .bind(payload.favorite ? 1 : 0, payload.id, user.userId)
      .run();
    return Response.json({ saved: true });
  } catch (error) {
    return apiError(error, "That favorite could not be saved. Try again.");
  }
}
