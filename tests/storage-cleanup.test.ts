import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { cleanupStaleImports, deleteIfUnused, pruneConfirmedImport } from "../lib/storage-cleanup.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY_MS;

/** A D1-shaped wrapper over in-memory SQLite with the real migrations applied. */
function fakeD1() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const file of readdirSync("drizzle")
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    for (const statement of readFileSync(`drizzle/${file}`, "utf8").split("--> statement-breakpoint")) {
      if (statement.trim()) sqlite.exec(statement);
    }
  }
  const prepare = (sql: string) => {
    let args: unknown[] = [];
    const statement = {
      bind(...values: unknown[]) {
        args = values;
        return statement;
      },
      first: async () => sqlite.prepare(sql).get(...(args as never[])) ?? null,
      all: async () => ({ results: sqlite.prepare(sql).all(...(args as never[])) }),
      run: async () => sqlite.prepare(sql).run(...(args as never[])),
    };
    return statement;
  };
  const db = {
    prepare,
    batch: async (statements: { run: () => Promise<unknown> }[]) => {
      sqlite.exec("BEGIN");
      for (const statement of statements) await statement.run();
      sqlite.exec("COMMIT");
    },
  };
  return { sqlite, db: db as unknown as D1Database };
}

function fakeBucket(keys: string[]) {
  const objects = new Set(keys);
  const bucket = { delete: async (key: string) => void objects.delete(key) };
  return { objects, bucket: bucket as unknown as R2Bucket };
}

function addImport(sqlite: DatabaseSync, id: string, status: string, createdAt: number, originalKey = `${id}.jpg`) {
  sqlite
    .prepare(
      `INSERT INTO wardrobe_imports (id, user_id, original_key, file_name, mime_type, status, created_at)
       VALUES (?, 'u', ?, 'photo.jpg', 'image/jpeg', ?, ?)`,
    )
    .run(id, originalKey, status, createdAt);
}

function addItem(sqlite: DatabaseSync, id: string, importId: string | null, status: string, createdAt: number) {
  sqlite
    .prepare(
      `INSERT INTO wardrobe_items (id, user_id, import_id, name, category, color, season, description, image_key, status, created_at)
       VALUES (?, 'u', ?, 'Tee', 'Tops', 'White', 'All season', '', ?, ?, ?)`,
    )
    .run(id, importId, `${id}.png`, status, createdAt);
}

const ids = (sqlite: DatabaseSync, table: string) =>
  sqlite
    .prepare(`SELECT id FROM ${table} ORDER BY id`)
    .all()
    .map((row) => row.id);

test("nightly cleanup removes abandoned imports and leaves recent and kept work", async () => {
  const { sqlite, db } = fakeD1();
  const old = NOW - 2 * DAY_MS;
  addImport(sqlite, "abandoned", "review", old);
  addItem(sqlite, "abandoned-draft", "abandoned", "draft", old);
  addImport(sqlite, "fresh", "review", NOW - 1000);
  addItem(sqlite, "fresh-draft", "fresh", "draft", NOW - 1000);
  addImport(sqlite, "kept", "confirmed", old);
  addItem(sqlite, "kept-piece", "kept", "confirmed", old);
  addItem(sqlite, "kept-rejected", "kept", "rejected", old);
  const { objects, bucket } = fakeBucket([
    "abandoned.jpg",
    "abandoned-draft.png",
    "fresh.jpg",
    "fresh-draft.png",
    "kept.jpg",
    "kept-piece.png",
    "kept-rejected.png",
  ]);

  const result = await cleanupStaleImports(db, bucket, NOW);

  assert.deepEqual(result, { imports: 1, pieces: 2, files: 3 });
  assert.deepEqual(ids(sqlite, "wardrobe_imports"), ["fresh", "kept"]);
  assert.deepEqual(ids(sqlite, "wardrobe_items"), ["fresh-draft", "kept-piece"]);
  assert.deepEqual([...objects].sort(), ["fresh-draft.png", "fresh.jpg", "kept-piece.png", "kept.jpg"]);
});

test("confirming an import drops rejected pieces and the original photo", async () => {
  const { sqlite, db } = fakeD1();
  addImport(sqlite, "imp", "confirmed", NOW);
  addItem(sqlite, "keep", "imp", "confirmed", NOW);
  addItem(sqlite, "drop", "imp", "rejected", NOW);
  const { objects, bucket } = fakeBucket(["imp.jpg", "keep.png", "drop.png"]);

  await pruneConfirmedImport(db, bucket, "u", "imp");

  assert.deepEqual(ids(sqlite, "wardrobe_items"), ["keep"]);
  assert.equal(sqlite.prepare(`SELECT original_key FROM wardrobe_imports`).get()?.original_key, "");
  assert.deepEqual([...objects], ["keep.png"]);
});

test("files still used by a piece are kept", async () => {
  const { sqlite, db } = fakeD1();
  addItem(sqlite, "piece", null, "confirmed", NOW);
  const { objects, bucket } = fakeBucket(["piece.png", "orphan.png"]);

  assert.equal(await deleteIfUnused(db, bucket, ["piece.png", "orphan.png", "", "orphan.png"]), 1);
  assert.deepEqual([...objects], ["piece.png"]);
});
