import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEntries, currentStreak, daysThisMonth } from "../lib/journal.ts";

test("merges wears and notes into one entry per day, newest first", () => {
  const entries = buildEntries(
    [
      { itemId: "a", date: "2026-10-03" },
      { itemId: "b", date: "2026-10-03" },
      { itemId: "a", date: "2026-10-05" },
      { itemId: "a", date: "2026-10-05" },
    ],
    [
      { date: "2026-10-05", note: "Coffee with Sam", photo: "/p.jpg" },
      { date: "2026-10-04", note: "Rainy", photo: "" },
    ],
  );
  assert.deepEqual(entries, [
    { date: "2026-10-05", itemIds: ["a"], note: "Coffee with Sam", photo: "/p.jpg" },
    { date: "2026-10-04", itemIds: [], note: "Rainy", photo: "" },
    { date: "2026-10-03", itemIds: ["a", "b"], note: "", photo: "" },
  ]);
});

test("counts a streak back from today, or from yesterday before today is logged", () => {
  const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];
  assert.equal(currentStreak(days, "2026-10-04"), 4);
  assert.equal(currentStreak(days, "2026-10-05"), 4);
  assert.equal(currentStreak(days, "2026-10-06"), 0);
  assert.equal(currentStreak(["2026-09-30", "2026-10-01"], "2026-10-01"), 2);
  assert.equal(currentStreak([], "2026-10-01"), 0);
});

test("counts journaled days in the current month", () => {
  assert.equal(daysThisMonth(["2026-09-30", "2026-10-01", "2026-10-04", "2026-10-04", "2026-10-09"], "2026-10-05"), 2);
});
