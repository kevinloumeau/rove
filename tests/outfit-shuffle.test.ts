import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreLook, seasonOf, suggestLook } from "../lib/outfit-shuffle.ts";

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const closet = [
  { id: "tee", category: "Tops", color: "White", season: "All season" },
  { id: "red", category: "Tops", color: "Red", season: "Fall / winter" },
  { id: "pink", category: "Bottoms", color: "Pink", season: "All season" },
  { id: "jeans", category: "Bottoms", color: "Blue", season: "All season" },
  { id: "jacket", category: "Outerwear", color: "Navy", season: "Spring / fall" },
  { id: "dirty", category: "Shoes", color: "White", season: "All season", inLaundry: true },
];

test("maps months to northern seasons", () => {
  assert.equal(seasonOf(new Date(2026, 9, 5)), "fall");
  assert.equal(seasonOf(new Date(2026, 0, 5)), "winter");
  assert.equal(seasonOf(new Date(2026, 6, 5)), "summer");
});

test("prefers one statement color over clashing ones", () => {
  const today = "2026-10-05";
  const calm = scoreLook([closet[1], closet[3]], today);
  const clash = scoreLook([closet[1], closet[2]], today);
  assert.ok(calm > clash, `${calm} should beat ${clash}`);
});

test("penalizes pieces out of season and worn in the last few days", () => {
  const summer = "2026-07-10";
  assert.ok(scoreLook([closet[0]], summer) > scoreLook([closet[1]], summer));
  assert.ok(scoreLook([{ ...closet[0], lastWorn: "2026-10-04" }], "2026-10-05") < scoreLook([closet[0]], "2026-10-05"));
});

test("never suggests laundry or a red-and-pink clash, and adds a layer in fall", () => {
  for (let seed = 1; seed < 40; seed += 1) {
    const look = suggestLook(closet, { today: "2026-10-05", random: seeded(seed) });
    const ids = look.map((piece) => piece.id);
    assert.ok(!ids.includes("dirty"));
    assert.ok(!(ids.includes("red") && ids.includes("pink")), ids.join(","));
    assert.ok(ids.includes("jacket"));
    assert.equal(look.filter((piece) => piece.category === "Tops").length, 1);
  }
});

test("a dress replaces the top and bottom", () => {
  const look = suggestLook(
    [
      { id: "dress", category: "Dresses", color: "Green" },
      { id: "jeans", category: "Bottoms", color: "Blue" },
    ],
    { today: "2026-07-01", random: seeded(3) },
  );
  assert.deepEqual(
    look.map((piece) => piece.id),
    ["dress"],
  );
});

test("returns nothing for an empty closet", () => {
  assert.deepEqual(suggestLook([], { today: "2026-10-05" }), []);
});
