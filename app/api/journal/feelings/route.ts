import { isFeeling, type RatedDay } from "@/lib/look-ratings";
import { apiError, getWardrobeBindings, requireApiUser } from "@/lib/wardrobe-backend";

export const dynamic = "force-dynamic";

/** Every rated journal day of the last 400, with the pieces worn that day, for outfit ideas and Outfit of the Day. */
export async function GET() {
  try {
    const user = await requireApiUser();
    const { db } = getWardrobeBindings();
    const since = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
    const [rated, wears] = await db.batch<Record<string, unknown>>([
      db
        .prepare(`SELECT day, feeling FROM wardrobe_journal WHERE user_id = ? AND day >= ? AND feeling != ''`)
        .bind(user.userId, since),
      db
        .prepare(
          `SELECT w.worn_on, w.item_id FROM wardrobe_wears w
           JOIN wardrobe_journal j ON j.user_id = w.user_id AND j.day = w.worn_on
           WHERE w.user_id = ? AND w.worn_on >= ? AND j.feeling != ''`,
        )
        .bind(user.userId, since),
    ]);
    const days: RatedDay[] = rated.results
      .filter((row) => isFeeling(row.feeling))
      .map((row) => ({ date: String(row.day), feeling: row.feeling as RatedDay["feeling"], itemIds: [] }));
    const byDay = new Map(days.map((day) => [day.date, day]));
    for (const row of wears.results) byDay.get(String(row.worn_on))?.itemIds.push(String(row.item_id));
    return Response.json({ days });
  } catch (error) {
    return apiError(error, "Your outfit ratings could not be loaded. Try again.");
  }
}
