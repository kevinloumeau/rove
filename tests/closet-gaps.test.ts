import assert from "node:assert/strict";
import { test } from "node:test";
import { findClosetGaps, seasonsAhead, type GapPiece } from "../lib/closet-gaps.ts";

const piece = (id: string, category: string, season = "All season", extra: Partial<GapPiece> = {}): GapPiece => ({
  id,
  name: `${category} ${id}`,
  category,
  color: "Black",
  season,
  ...extra,
});

const fullCloset = [
  piece("t1", "Tops"),
  piece("t2", "Tops"),
  piece("t3", "Tops"),
  piece("b1", "Bottoms"),
  piece("b2", "Bottoms"),
  piece("o1", "Outerwear"),
  piece("s1", "Shoes"),
];

test("looks ahead to the next season near its start", () => {
  assert.deepEqual(seasonsAhead("2026-07-10"), ["summer"]);
  assert.deepEqual(seasonsAhead("2026-10-05"), ["fall"]);
  assert.deepEqual(seasonsAhead("2026-11-10"), ["fall", "winter"]);
});

test("finds nothing to add in a well-covered closet", () => {
  assert.deepEqual(findClosetGaps(fullCloset, [], "2026-10-05"), []);
});

test("stays quiet for tiny closets", () => {
  assert.deepEqual(findClosetGaps([piece("t1", "Tops")], [], "2026-10-05"), []);
});

test("flags core pieces missing for the season", () => {
  const summerOnly = fullCloset.map((item) => (item.category === "Outerwear" ? { ...item, season: "Summer" } : item));
  const gaps = findClosetGaps(summerOnly, [], "2026-10-05");
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].title, "No layers for fall");
  assert.deepEqual(gaps[0].suggestion, { name: "Light jacket", category: "Outerwear", note: "For fall" });
});

test("skips categories already on the wishlist", () => {
  const noShoes = fullCloset.filter((item) => item.category !== "Shoes");
  assert.equal(findClosetGaps(noShoes, [], "2026-10-05")[0].suggestion.category, "Shoes");
  assert.deepEqual(findClosetGaps(noShoes, [], "2026-10-05", ["Shoes"]), []);
});

test("notices saved looks that keep missing shoes", () => {
  const looks = [{ itemIds: ["t1", "b1"] }, { itemIds: ["t2", "b2"] }, { itemIds: ["t3", "b1", "s1"] }];
  const gaps = findClosetGaps(fullCloset, looks, "2026-07-10");
  assert.equal(gaps[0].title, "2 of your 3 saved looks have no shoes");
});

test("spots a hard-working piece in a small category", () => {
  const closet = fullCloset.map((item) => (item.id === "s1" ? { ...item, wearCount: 24 } : item));
  const [gap] = findClosetGaps(closet, [], "2026-07-10");
  assert.equal(gap.title, "Shoes s1 is doing a lot of work");
  assert.equal(gap.suggestion.name, "Another black pair of shoes");
});
