// R2 and D1 housekeeping. Takes its bindings as arguments so the Worker's scheduled handler can
// use it outside a request.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Deletes each R2 object that no piece (image or thumbnail) or import still points at. */
export async function deleteIfUnused(db: D1Database, bucket: R2Bucket, keys: Iterable<string>) {
  let deleted = 0;
  for (const key of new Set(keys)) {
    if (!key) continue;
    const used = await db
      .prepare(
        `SELECT 1 FROM wardrobe_items WHERE image_key = ?1 OR thumb_key = ?1
         UNION SELECT 1 FROM wardrobe_imports WHERE original_key = ?1 LIMIT 1`,
      )
      .bind(key)
      .first();
    if (!used) {
      await bucket.delete(key);
      deleted += 1;
    }
  }
  return deleted;
}

/**
 * After an import is confirmed: drops the pieces that were not kept, and the original photo when
 * every kept piece has its own cutout. The original is only needed while reviewing.
 */
export async function pruneConfirmedImport(db: D1Database, bucket: R2Bucket, userId: string, importId: string) {
  const imported = await db
    .prepare(`SELECT original_key FROM wardrobe_imports WHERE id = ? AND user_id = ?`)
    .bind(importId, userId)
    .first<{ original_key: string }>();
  if (!imported) return;
  const rejected = await db
    .prepare(
      `SELECT image_key, thumb_key FROM wardrobe_items WHERE import_id = ? AND user_id = ? AND status = 'rejected'`,
    )
    .bind(importId, userId)
    .all<{ image_key: string; thumb_key: string }>();
  const keys = rejected.results.flatMap((row) => [row.image_key, row.thumb_key]);
  const statements = [
    db
      .prepare(`DELETE FROM wardrobe_items WHERE import_id = ? AND user_id = ? AND status = 'rejected'`)
      .bind(importId, userId),
  ];
  const originalInUse = await db
    .prepare(`SELECT 1 FROM wardrobe_items WHERE import_id = ? AND user_id = ? AND image_key = ? LIMIT 1`)
    .bind(importId, userId, imported.original_key)
    .first();
  if (imported.original_key && !originalInUse) {
    statements.push(
      db.prepare(`UPDATE wardrobe_imports SET original_key = '' WHERE id = ? AND user_id = ?`).bind(importId, userId),
    );
    keys.push(imported.original_key);
  }
  await db.batch(statements);
  await deleteIfUnused(db, bucket, keys);
}

/**
 * Nightly: removes imports that were never confirmed (abandoned reviews, failed uploads) after a
 * day, with their draft pieces and files, and any rejected pieces left behind.
 */
export async function cleanupStaleImports(db: D1Database, bucket: R2Bucket, now = Date.now()) {
  const cutoff = now - DAY_MS;
  const stale = await db
    .prepare(
      `SELECT id, original_key FROM wardrobe_imports
       WHERE status IN ('processing', 'review', 'failed') AND created_at < ? LIMIT 200`,
    )
    .bind(cutoff)
    .all<{ id: string; original_key: string }>();
  // Rejected pieces from any import, plus the drafts of stale imports.
  const doomed = await db
    .prepare(
      `SELECT id, image_key, thumb_key FROM wardrobe_items
       WHERE created_at < ?1 AND (status = 'rejected' OR (status = 'draft' AND import_id IN (
         SELECT id FROM wardrobe_imports WHERE status IN ('processing', 'review', 'failed') AND created_at < ?1)))
       LIMIT 1000`,
    )
    .bind(cutoff)
    .all<{ id: string; image_key: string; thumb_key: string }>();
  const staleIds = new Set(stale.results.map((row) => row.id));
  const doomedIds = new Set(doomed.results.map((row) => row.id));
  const keys = [
    ...doomed.results.flatMap((row) => [row.image_key, row.thumb_key]),
    ...stale.results.map((row) => row.original_key),
  ];
  const statements = [
    ...[...doomedIds].map((id) => db.prepare(`DELETE FROM wardrobe_items WHERE id = ?`).bind(id)),
    ...[...staleIds].map((id) => db.prepare(`DELETE FROM wardrobe_imports WHERE id = ?`).bind(id)),
  ];
  for (let index = 0; index < statements.length; index += 50) await db.batch(statements.slice(index, index + 50));
  const files = await deleteIfUnused(db, bucket, keys);
  return { imports: staleIds.size, pieces: doomedIds.size, files };
}
