import assert from "node:assert/strict";
import { test } from "node:test";
import { fitsAnySeason, seasonalSwap, swapSeasons, type SwapPiece } from "../lib/seasonal-swap.ts";

const piece = (id: string, season: string, storedAt: string | null = null): SwapPiece => ({
  id,
  name: id,
  season,
  storedAt,
});

test("keeps this season and the next one", () => {
  assert.deepEqual(swapSeasons("2026-10-06"), ["fall", "winter"]);
  assert.deepEqual(swapSeasons("2026-04-15"), ["spring", "summer"]);
  assert.deepEqual(swapSeasons("2026-12-20"), ["winter", "spring"]);
  assert.deepEqual(swapSeasons("2026-01-10"), ["winter", "spring"]);
});

test("matches seasons by word, and keeps pieces it can't place", () => {
  assert.equal(fitsAnySeason("All season", ["summer"]), true);
  assert.equal(fitsAnySeason("", ["summer"]), true);
  assert.equal(fitsAnySeason(undefined, ["summer"]), true);
  assert.equal(fitsAnySeason("Fall / winter", ["spring", "summer"]), false);
  assert.equal(fitsAnySeason("Spring / fall", ["fall", "winter"]), true);
  assert.equal(fitsAnySeason("Autumn", ["fall"]), true);
  assert.equal(fitsAnySeason("Beach trips", ["winter"]), true);
});

test("in October, packs away summer pieces and brings winter ones back", () => {
  const closet = [
    piece("tee", "Summer"),
    piece("linen", "Spring / summer"),
    piece("coat", "Fall / winter"),
    piece("jeans", "All season"),
    piece("trench", "Spring / fall"),
    piece("parka", "Winter", "2026-04-20"),
    piece("shorts", "Summer", "2026-09-30"),
  ];
  const swap = seasonalSwap(closet, "2026-10-06");
  assert.deepEqual(
    swap.packAway.map((p) => p.id),
    ["tee", "linen"],
  );
  assert.deepEqual(
    swap.bringBack.map((p) => p.id),
    ["parka"],
  );
});

test("in April, packs away winter pieces and brings summer ones back", () => {
  const closet = [
    piece("coat", "Fall / winter"),
    piece("parka", "Winter"),
    piece("trench", "Spring / fall"),
    piece("shorts", "Summer", "2025-10-01"),
  ];
  const swap = seasonalSwap(closet, "2026-04-15");
  assert.deepEqual(
    swap.packAway.map((p) => p.id),
    ["coat", "parka"],
  );
  assert.deepEqual(
    swap.bringBack.map((p) => p.id),
    ["shorts"],
  );
});
