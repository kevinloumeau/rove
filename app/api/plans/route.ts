import { apiError, getWardrobeBindings, requireApiUser } from "@/lib/wardrobe-backend";

export const dynamic = "force-dynamic";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const month = new URL(request.url).searchParams.get("month");
    if (!month || !MONTH.test(month)) return Response.json({ error: "Choose a valid month." }, { status: 400 });
    const { db } = getWardrobeBindings();
    const result = await db
      .prepare(`SELECT planned_date, outfit_id FROM wardrobe_plans WHERE user_id = ? AND planned_date LIKE ?`)
      .bind(user.userId, `${month}-%`)
      .all();
    return Response.json({
      plans: Object.fromEntries(result.results.map((row) => [String(row.planned_date), String(row.outfit_id)])),
    });
  } catch (error) {
    return apiError(error, "Your outfit calendar could not be loaded. Try again.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const payload = (await request.json()) as { date?: string; outfitId?: string };
    if (!validDate(payload.date) || !payload.outfitId)
      return Response.json({ error: "Choose a valid day and saved look." }, { status: 400 });
    const { db } = getWardrobeBindings();
    const look = await db
      .prepare(`SELECT 1 FROM wardrobe_outfits WHERE id = ? AND user_id = ?`)
      .bind(payload.outfitId, user.userId)
      .first();
    if (!look) return Response.json({ error: "That saved look was not found." }, { status: 404 });
    await db.batch([
      db.prepare(`DELETE FROM wardrobe_plans WHERE user_id = ? AND planned_date = ?`).bind(user.userId, payload.date),
      db
        .prepare(`INSERT INTO wardrobe_plans (id, user_id, outfit_id, planned_date, created_at) VALUES (?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), user.userId, payload.outfitId, payload.date, Date.now()),
    ]);
    return Response.json({ saved: true });
  } catch (error) {
    return apiError(error, "That day could not be planned. Try again.");
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser();
    const date = new URL(request.url).searchParams.get("date");
    if (!validDate(date)) return Response.json({ error: "Choose a valid day." }, { status: 400 });
    const { db } = getWardrobeBindings();
    await db.prepare(`DELETE FROM wardrobe_plans WHERE user_id = ? AND planned_date = ?`).bind(user.userId, date).run();
    return Response.json({ removed: true });
  } catch (error) {
    return apiError(error, "That plan could not be removed. Try again.");
  }
}
