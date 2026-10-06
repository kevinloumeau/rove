import { buildEntries } from "@/lib/journal";
import { isFeeling } from "@/lib/look-ratings";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  apiError,
  assetUrl,
  getWardrobeBindings,
  isIsoDate,
  requireApiUser,
} from "@/lib/wardrobe-backend";

export const dynamic = "force-dynamic";

const PAGE_DAYS = 20;
const NOTE_LIMIT = 2000;
const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

type JournalRow = { day: string; note: string; photo_key: string; feeling: string };

/**
 * The outfit journal, newest day first, a page of days at a time: GET /api/journal?before=YYYY-MM-DD.
 * A day appears when something was logged as worn or it has a note or photo. `loggedDays` lists every
 * journaled day of the last 400 so the client can show streaks.
 */
export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const before = new URL(request.url).searchParams.get("before");
    const cursor = isIsoDate(before) ? before : null;
    const { db } = getWardrobeBindings();
    const days = await db
      .prepare(
        `SELECT day FROM (
           SELECT worn_on AS day FROM wardrobe_wears WHERE user_id = ?1 AND (?2 IS NULL OR worn_on < ?2)
           UNION SELECT day FROM wardrobe_journal WHERE user_id = ?1 AND (?2 IS NULL OR day < ?2)
         ) ORDER BY day DESC LIMIT ${PAGE_DAYS + 1}`,
      )
      .bind(user.userId, cursor)
      .all<{ day: string }>();
    const page = days.results.slice(0, PAGE_DAYS).map((row) => row.day);
    const since = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
    const recent = db
      .prepare(
        `SELECT worn_on AS day FROM wardrobe_wears WHERE user_id = ?1 AND worn_on >= ?2
         UNION SELECT day FROM wardrobe_journal WHERE user_id = ?1 AND day >= ?2`,
      )
      .bind(user.userId, since);
    if (!page.length) {
      const loggedDays = (await recent.all<{ day: string }>()).results.map((row) => row.day);
      return Response.json({ entries: [], nextBefore: null, loggedDays });
    }
    const oldest = page.at(-1)!;
    const newest = page[0];
    const [wears, notes, logged] = await db.batch<Record<string, unknown>>([
      db
        .prepare(
          `SELECT item_id, worn_on FROM wardrobe_wears WHERE user_id = ? AND worn_on >= ? AND worn_on <= ? ORDER BY created_at`,
        )
        .bind(user.userId, oldest, newest),
      db
        .prepare(
          `SELECT day, note, photo_key, feeling FROM wardrobe_journal WHERE user_id = ? AND day >= ? AND day <= ?`,
        )
        .bind(user.userId, oldest, newest),
      recent,
    ]);
    const entries = buildEntries(
      wears.results.map((row) => ({ itemId: String(row.item_id), date: String(row.worn_on) })),
      (notes.results as JournalRow[]).map((row) => ({
        date: row.day,
        note: row.note,
        photo: row.photo_key ? assetUrl(row.photo_key) : "",
        feeling: row.feeling,
      })),
    );
    return Response.json({
      entries,
      nextBefore: days.results.length > PAGE_DAYS ? oldest : null,
      loggedDays: logged.results.map((row) => String(row.day)),
    });
  } catch (error) {
    return apiError(error, "Your journal could not be loaded. Try again.");
  }
}

async function currentRow(db: D1Database, userId: string, day: string) {
  return db
    .prepare(`SELECT day, note, photo_key, feeling FROM wardrobe_journal WHERE user_id = ? AND day = ?`)
    .bind(userId, day)
    .first<JournalRow>();
}

/**
 * Saves a day's note and/or how the outfit felt: PUT { date, note?, feeling? }, where feeling is loved, fine,
 * not-again, or "" to clear it. A day left with no note, photo or feeling is removed.
 */
export async function PUT(request: Request) {
  try {
    const user = await requireApiUser();
    const payload = (await request.json()) as { date?: unknown; note?: unknown; feeling?: unknown };
    const hasNote = payload.note !== undefined;
    const hasFeeling = payload.feeling !== undefined;
    if (
      !isIsoDate(payload.date) ||
      (!hasNote && !hasFeeling) ||
      (hasNote && typeof payload.note !== "string") ||
      (hasFeeling && payload.feeling !== "" && !isFeeling(payload.feeling))
    )
      return Response.json({ error: "Choose a day and write a note." }, { status: 400 });
    const { db } = getWardrobeBindings();
    const existing = await currentRow(db, user.userId, payload.date);
    const note = hasNote ? String(payload.note).trim().slice(0, NOTE_LIMIT) : (existing?.note ?? "");
    const feeling = hasFeeling ? String(payload.feeling) : (existing?.feeling ?? "");
    if (!note && !feeling && !existing?.photo_key) {
      await db
        .prepare(`DELETE FROM wardrobe_journal WHERE user_id = ? AND day = ?`)
        .bind(user.userId, payload.date)
        .run();
    } else {
      await db
        .prepare(
          `INSERT INTO wardrobe_journal (id, user_id, day, note, photo_key, feeling, updated_at) VALUES (?, ?, ?, ?, '', ?, ?)
           ON CONFLICT (user_id, day) DO UPDATE SET note = excluded.note, feeling = excluded.feeling, updated_at = excluded.updated_at`,
        )
        .bind(crypto.randomUUID(), user.userId, payload.date, note, feeling, Date.now())
        .run();
    }
    return Response.json({ date: payload.date, note, feeling });
  } catch (error) {
    return apiError(error, "That note could not be saved. Try again.");
  }
}

/** Adds or replaces a day's outfit photo: multipart { date, photo }. */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const form = await request.formData();
    const date = form.get("date");
    const photo = form.get("photo");
    if (!isIsoDate(date)) return Response.json({ error: "Choose a day for this photo." }, { status: 400 });
    if (!(photo instanceof File) || !ALLOWED_IMAGE_TYPES.has(photo.type))
      return Response.json({ error: "Choose a JPEG, PNG or WebP photo." }, { status: 400 });
    if (!photo.size || photo.size > MAX_UPLOAD_BYTES)
      return Response.json({ error: "Choose a photo under 12 MB." }, { status: 400 });
    const { db, bucket } = getWardrobeBindings();
    const existing = await currentRow(db, user.userId, date);
    const key = `journal-${crypto.randomUUID()}.${EXTENSIONS[photo.type]}`;
    await bucket.put(key, await photo.arrayBuffer(), { httpMetadata: { contentType: photo.type } });
    try {
      await db
        .prepare(
          `INSERT INTO wardrobe_journal (id, user_id, day, note, photo_key, updated_at) VALUES (?, ?, ?, '', ?, ?)
           ON CONFLICT (user_id, day) DO UPDATE SET photo_key = excluded.photo_key, updated_at = excluded.updated_at`,
        )
        .bind(crypto.randomUUID(), user.userId, date, key, Date.now())
        .run();
    } catch (error) {
      await bucket.delete(key);
      throw error;
    }
    if (existing?.photo_key) await bucket.delete(existing.photo_key);
    return Response.json({ date, photo: assetUrl(key) });
  } catch (error) {
    return apiError(error, "That photo could not be saved. Try again.");
  }
}

/** Removes a day's photo: DELETE /api/journal?date=YYYY-MM-DD. The note and rating, if any, stay. */
export async function DELETE(request: Request) {
  try {
    const user = await requireApiUser();
    const date = new URL(request.url).searchParams.get("date");
    if (!isIsoDate(date)) return Response.json({ error: "Choose a day." }, { status: 400 });
    const { db, bucket } = getWardrobeBindings();
    const existing = await currentRow(db, user.userId, date);
    if (!existing) return Response.json({ date, removed: true });
    await db
      .prepare(
        existing.note || existing.feeling
          ? `UPDATE wardrobe_journal SET photo_key = '', updated_at = ? WHERE user_id = ? AND day = ?`
          : `DELETE FROM wardrobe_journal WHERE updated_at <= ? AND user_id = ? AND day = ?`,
      )
      .bind(Date.now(), user.userId, date)
      .run();
    if (existing.photo_key) await bucket.delete(existing.photo_key);
    return Response.json({ date, removed: true });
  } catch (error) {
    return apiError(error, "That photo could not be removed. Try again.");
  }
}
