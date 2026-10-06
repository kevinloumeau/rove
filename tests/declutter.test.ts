import assert from "node:assert/strict";
import { test } from "node:test";
import { declutterCandidates, groupByReason, isLetGoReason, lastSignal, monthsBefore } from "../lib/declutter.ts";

test("counts months back and clamps to shorter months", () => {
  assert.equal(monthsBefore("2026-10-05", 6), "2026-04-05");
  assert.equal(monthsBefore("2026-02-15", 3), "2025-11-15");
  assert.equal(monthsBefore("2026-08-31", 6), "2026-02-28");
  assert.equal(monthsBefore("2026-10-05", 12), "2025-10-05");
});

test("the latest of wear, keep and add counts as the last signal", () => {
  assert.equal(lastSignal({ id: 1, name: "Tee", addedAt: "2025-01-01", lastWorn: "2025-06-01" }), "2025-06-01");
  assert.equal(
    lastSignal({ id: 1, name: "Tee", addedAt: "2025-01-01", lastWorn: "2025-06-01", keptAt: "2026-01-01" }),
    "2026-01-01",
  );
  assert.equal(lastSignal({ id: 1, name: "Tee" }), null);
});

test("suggests idle pieces, longest idle first", () => {
  const pieces = [
    { id: 1, name: "Blazer", addedAt: "2025-01-10", lastWorn: "2025-12-01" },
    { id: 2, name: "Jeans", addedAt: "2025-01-10", lastWorn: "2026-09-30" },
    { id: 3, name: "Scarf", addedAt: "2025-02-01" },
    { id: 4, name: "New boots", addedAt: "2026-09-01" },
    { id: 5, name: "Kept coat", addedAt: "2024-01-01", keptAt: "2026-05-01" },
    { id: 6, name: "Washing tee", addedAt: "2024-01-01", inLaundry: true },
    { id: 7, name: "Mystery", addedAt: null },
  ];
  assert.deepEqual(
    declutterCandidates(pieces, "2026-10-05", 6).map((piece) => piece.name),
    ["Scarf", "Blazer"],
  );
  assert.deepEqual(
    declutterCandidates(pieces, "2026-10-05", 12).map((piece) => piece.name),
    ["Scarf"],
  );
  assert.deepEqual(
    declutterCandidates(pieces, "2026-10-05", 3).map((piece) => piece.name),
    ["Scarf", "Blazer", "Kept coat"],
  );
});

test("groups the let-go pile by reason", () => {
  const groups = groupByReason([
    { name: "a", archiveReason: "donate" },
    { name: "b", archiveReason: "sell" },
    { name: "c", archiveReason: "" },
    { name: "d", archiveReason: "donate" },
  ]);
  assert.deepEqual(
    groups.donate.map((piece) => piece.name),
    ["a", "d"],
  );
  assert.deepEqual(
    groups.sell.map((piece) => piece.name),
    ["b"],
  );
  assert.deepEqual(
    groups.archive.map((piece) => piece.name),
    ["c"],
  );
  assert.equal(isLetGoReason("sell"), true);
  assert.equal(isLetGoReason("burn"), false);
});

test("skips pieces packed away for the season", () => {
  const pieces = [
    { id: 1, name: "Old tee", addedAt: "2024-01-01" },
    { id: 2, name: "Stored shorts", addedAt: "2024-01-01", storedAt: "2026-09-30" },
  ];
  assert.deepEqual(
    declutterCandidates(pieces, "2026-10-06", 12).map((piece) => piece.name),
    ["Old tee"],
  );
});
