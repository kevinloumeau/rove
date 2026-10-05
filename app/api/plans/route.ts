import { apiError, getWardrobeBindings, requireApiUser } from "@/lib/wardrobe-backend";

export const dynamic = "force-dynamic";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const params = new URL(request.url).searchParams;
    const month = params.get("month");
    const from = params.get("from");
    const to = params.get("to");
    const { db } = getWardrobeBindings();
    let query;
    // Either a calendar month (?month=YYYY-MM) or a date range (?from=…&to=…, at most 62 days).
    if (month && MONTH.test(month)) {
      query = db
        .prepare(`SELECT planned_date, outfit_id FROM wardrobe_plans WHERE user_id = ? AND planned_date LIKE ?`)
        .bind(user.userId, `${month}-%`);
    } else if (validDate(from) && validDate(to) && from <= to && daysBetween(from, to) <= 62) {
      query = db
        .prepare(
          `SELECT planned_date, outfit_id FROM wardrobe_plans WHERE user_id = ? AND planned_date >= ? AND planned_date <= ?`,
        )
        .bind(user.userId, from, to);
    } else {
      return Response.json({ error: "Choose a valid month." }, { status: 400 });
    }
    const result = await query.all();
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
    // One day ({ date }) or several at once ({ dates }, e.g. "every Monday for 8 weeks").
    const payload = (await request.json()) as { date?: string; dates?: unknown; outfitId?: string };
    const dates = Array.isArray(payload.dates) ? [...new Set(payload.dates)] : [payload.date];
    if (!dates.length || dates.length > 60 || !dates.every(validDate) || !payload.outfitId)
      return Response.json({ error: "Choose a valid day and saved look." }, { status: 400 });
    const { db } = getWardrobeBindings();
    const look = await db
      .prepare(`SELECT 1 FROM wardrobe_outfits WHERE id = ? AND user_id = ?`)
      .bind(payload.outfitId, user.userId)
      .first();
    if (!look) return Response.json({ error: "That saved look was not found." }, { status: 404 });
    const now = Date.now();
    await db.batch(
      dates.flatMap((date) => [
        db.prepare(`DELETE FROM wardrobe_plans WHERE user_id = ? AND planned_date = ?`).bind(user.userId, date),
        db
          .prepare(
            `INSERT INTO wardrobe_plans (id, user_id, outfit_id, planned_date, created_at) VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(crypto.randomUUID(), user.userId, payload.outfitId, date, now),
      ]),
    );
    return Response.json({ saved: true, dates });
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
