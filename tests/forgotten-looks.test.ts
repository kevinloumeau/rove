import assert from "node:assert/strict";
import { test } from "node:test";
import { forgottenLooks, lastWornTogether, nextFreeDay, wearsByDay } from "../lib/forgotten-looks.ts";

test("finds the last day every piece of a look was worn", () => {
  const days = wearsByDay([
    { itemId: "tee", date: "2026-05-01" },
    { itemId: "jeans", date: "2026-05-01" },
    { itemId: "tee", date: "2026-06-01" },
    { itemId: "jeans", date: "2026-07-01" },
  ]);
  assert.equal(lastWornTogether(["tee", "jeans"], days), "2026-05-01");
  assert.equal(lastWornTogether(["tee"], days), "2026-06-01");
  assert.equal(lastWornTogether(["coat"], days), null);
  assert.equal(lastWornTogether([], days), null);
});

test("lists looks not worn in 60 days, longest-forgotten first", () => {
  const items = [{ id: "tee" }, { id: "jeans" }, { id: "coat", storedAt: "2026-04-01" }, { id: "skirt" }];
  const looks = [
    { id: "recent", itemIds: ["tee", "jeans"], lastWorn: "2026-09-20", createdAt: "2026-01-01" },
    { id: "old", itemIds: ["tee", "jeans"], lastWorn: "2026-06-01", createdAt: "2026-01-01" },
    { id: "never", itemIds: ["skirt", "tee"], lastWorn: null, createdAt: "2026-03-01" },
    { id: "new", itemIds: ["skirt"], lastWorn: null, createdAt: "2026-09-30" },
    { id: "stored", itemIds: ["coat", "tee"], lastWorn: null, createdAt: "2026-01-01" },
    { id: "gone", itemIds: ["deleted"], lastWorn: null, createdAt: "2026-01-01" },
    { id: "planned", itemIds: ["tee"], lastWorn: "2026-01-01", createdAt: "2026-01-01" },
  ];
  const found = forgottenLooks(looks, items, "2026-10-06", { "2026-10-09": "planned", "2026-09-01": "old" });
  assert.deepEqual(
    found.map((entry) => [entry.look.id, entry.lastWorn]),
    [
      ["never", null],
      ["old", "2026-06-01"],
    ],
  );
});

test("counts pieces all worn on the same day as wearing the look", () => {
  const items = [
    { id: "tee", lastWorn: "2026-10-06" },
    { id: "jeans", lastWorn: "2026-10-06" },
  ];
  const looks = [{ id: "old", itemIds: ["tee", "jeans"], lastWorn: "2026-06-01", createdAt: "2026-01-01" }];
  assert.deepEqual(forgottenLooks(looks, items, "2026-10-06", {}), []);
});

test("picks the next day with nothing planned", () => {
  assert.equal(nextFreeDay({}, "2026-10-06"), "2026-10-06");
  assert.equal(nextFreeDay({ "2026-10-06": "a", "2026-10-07": "b" }, "2026-10-06"), "2026-10-08");
});
