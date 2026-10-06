import assert from "node:assert/strict";
import { test } from "node:test";
import { isFeeling, lookAffinity, lovedAgain, pairScores, type RatedDay } from "../lib/look-ratings.ts";

const days: RatedDay[] = [
  { date: "2026-09-01", feeling: "loved", itemIds: ["tee", "jeans", "boots"] },
  { date: "2026-09-10", feeling: "not-again", itemIds: ["tee", "skirt"] },
  { date: "2026-09-12", feeling: "fine", itemIds: ["shirt", "jeans"] },
];

test("recognizes the three feelings", () => {
  assert.equal(isFeeling("loved"), true);
  assert.equal(isFeeling("not-again"), true);
  assert.equal(isFeeling("meh"), false);
  assert.equal(isFeeling(undefined), false);
});

test("scores pieces worn together on rated days", () => {
  const pairs = pairScores(days);
  assert.equal(pairs.get("jeans|tee"), 1);
  assert.equal(pairs.get("skirt|tee"), -2);
  assert.equal(pairs.get("jeans|shirt"), 0);
  assert.equal(lookAffinity(["tee", "jeans", "boots"], pairs), 3);
  assert.equal(lookAffinity(["skirt", "tee"], pairs), -2);
  assert.equal(lookAffinity(["coat"], pairs), 0);
});

test("suggests a loved outfit again when its pieces are free", () => {
  const items = [{ id: "tee", lastWorn: "2026-09-01" }, { id: "jeans", lastWorn: "2026-09-12" }, { id: "boots" }];
  assert.deepEqual(
    lovedAgain(days, items, "2026-10-06")?.pieces.map((piece) => piece.id),
    ["boots", "jeans", "tee"],
  );
  // Too recent, worn in the last few days, in the wash, or packed away: nothing to suggest.
  assert.equal(lovedAgain(days, items, "2026-09-10"), null);
  assert.equal(lovedAgain(days, [...items.slice(1), { id: "tee", lastWorn: "2026-10-05" }], "2026-10-06"), null);
  assert.equal(lovedAgain(days, [...items.slice(1), { id: "tee", inLaundry: true }], "2026-10-06"), null);
  assert.equal(lovedAgain(days, [...items.slice(1), { id: "tee", storedAt: "2026-10-01" }], "2026-10-06"), null);
  assert.equal(lovedAgain(days, items.slice(1), "2026-10-06"), null);
});
