import { apiError, getWardrobeBindings, requireApiUser } from "@/lib/wardrobe-backend";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireApiUser();
    const { db } = getWardrobeBindings();
    const result = await db
      .prepare(`SELECT planned_date, outfit_id FROM wardrobe_plans WHERE user_id = ? AND planned_date LIKE '2026-10-%'`)
      .bind(user.userId)
      .all();
    return Response.json({
      plans: Object.fromEntries(
        result.results.map((row) => [Number(String(row.planned_date).slice(-2)), String(row.outfit_id)]),
      ),
    });
  } catch (error) {
    return apiError(error, "Your outfit calendar could not be loaded. Try again.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const payload = (await request.json()) as { day?: number; outfitId?: string };
    if (!payload.day || payload.day < 1 || payload.day > 31 || !payload.outfitId)
      return Response.json({ error: "Choose a valid day and saved look." }, { status: 400 });
    const date = `2026-10-${String(payload.day).padStart(2, "0")}`;
    const { db } = getWardrobeBindings();
    await db.prepare(`DELETE FROM wardrobe_plans WHERE user_id = ? AND planned_date = ?`).bind(user.userId, date).run();
    await db
      .prepare(`INSERT INTO wardrobe_plans (id, user_id, outfit_id, planned_date, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), user.userId, payload.outfitId, date, Date.now())
      .run();
    return Response.json({ saved: true });
  } catch (error) {
    return apiError(error, "That day could not be planned. Try again.");
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser();
    const day = Number(new URL(request.url).searchParams.get("day"));
    if (!day || day < 1 || day > 31) return Response.json({ error: "Choose a valid day." }, { status: 400 });
    const date = `2026-10-${String(day).padStart(2, "0")}`;
    const { db } = getWardrobeBindings();
    await db.prepare(`DELETE FROM wardrobe_plans WHERE user_id = ? AND planned_date = ?`).bind(user.userId, date).run();
    return Response.json({ removed: true });
  } catch (error) {
    return apiError(error, "That plan could not be removed. Try again.");
  }
}
