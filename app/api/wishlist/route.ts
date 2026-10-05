import { cleanWishlistInput, type WishlistItem } from "@/lib/wishlist";
import { apiError, getWardrobeBindings, requireApiUser } from "@/lib/wardrobe-backend";
import { pieceCategories } from "@/lib/wardrobe-types";

export const dynamic = "force-dynamic";

type WishlistRow = {
  id: string;
  name: string;
  category: string;
  link: string;
  price: number | null;
  note: string;
  created_at: number;
  bought_at: number | null;
};

function toItem(row: WishlistRow): WishlistItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    link: row.link,
    price: row.price,
    note: row.note,
    createdAt: row.created_at,
    boughtAt: row.bought_at,
  };
}

/** Everything on the wishlist, still-wanted pieces first, then the most recently bought. */
export async function GET() {
  try {
    const user = await requireApiUser();
    const { db } = getWardrobeBindings();
    const rows = await db
      .prepare(
        `SELECT id, name, category, link, price, note, created_at, bought_at FROM wardrobe_wishlist
         WHERE user_id = ? ORDER BY bought_at IS NOT NULL, COALESCE(bought_at, created_at) DESC LIMIT 300`,
      )
      .bind(user.userId)
      .all<WishlistRow>();
    return Response.json({ items: rows.results.map(toItem) });
  } catch (error) {
    return apiError(error, "Your wishlist could not be loaded. Try again.");
  }
}

/** Adds a piece: POST { name, category, link, price, note }. */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const input = cleanWishlistInput(await request.json().catch(() => null), pieceCategories);
    if (typeof input === "string") return Response.json({ error: input }, { status: 400 });
    const item: WishlistItem = { id: crypto.randomUUID(), ...input, createdAt: Date.now(), boughtAt: null };
    const { db } = getWardrobeBindings();
    await db
      .prepare(
        `INSERT INTO wardrobe_wishlist (id, user_id, name, category, link, price, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(item.id, user.userId, item.name, item.category, item.link, item.price, item.note, item.createdAt)
      .run();
    return Response.json({ item });
  } catch (error) {
    return apiError(error, "That piece could not be added. Try again.");
  }
}

/** Edits a piece or marks it bought: PATCH { id, bought?, name?, category?, link?, price?, note? }. */
export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload || typeof payload.id !== "string") return Response.json({ error: "Choose a piece." }, { status: 400 });
    const { db } = getWardrobeBindings();
    const current = await db
      .prepare(
        `SELECT id, name, category, link, price, note, created_at, bought_at FROM wardrobe_wishlist WHERE id = ? AND user_id = ?`,
      )
      .bind(payload.id, user.userId)
      .first<WishlistRow>();
    if (!current) return Response.json({ error: "That piece is no longer on your wishlist." }, { status: 404 });
    const merged = cleanWishlistInput({ ...toItem(current), ...payload }, pieceCategories);
    if (typeof merged === "string") return Response.json({ error: merged }, { status: 400 });
    const boughtAt = typeof payload.bought === "boolean" ? (payload.bought ? Date.now() : null) : current.bought_at;
    await db
      .prepare(
        `UPDATE wardrobe_wishlist SET name = ?, category = ?, link = ?, price = ?, note = ?, bought_at = ? WHERE id = ? AND user_id = ?`,
      )
      .bind(merged.name, merged.category, merged.link, merged.price, merged.note, boughtAt, current.id, user.userId)
      .run();
    return Response.json({ item: { ...toItem(current), ...merged, boughtAt } });
  } catch (error) {
    return apiError(error, "That change could not be saved. Try again.");
  }
}

/** Removes a piece: DELETE /api/wishlist?id=… */
export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Choose a piece." }, { status: 400 });
    const { db } = getWardrobeBindings();
    await db.prepare(`DELETE FROM wardrobe_wishlist WHERE id = ? AND user_id = ?`).bind(id, user.userId).run();
    return Response.json({ id, removed: true });
  } catch (error) {
    return apiError(error, "That piece could not be removed. Try again.");
  }
}
