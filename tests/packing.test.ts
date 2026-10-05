import assert from "node:assert/strict";
import { test } from "node:test";
import { datesBetween, packingList } from "../lib/packing.ts";

test("lists each day of the trip, across months", () => {
  assert.deepEqual(datesBetween("2026-10-30", "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  assert.deepEqual(datesBetween("2026-11-02", "2026-11-01"), []);
});

test("packs each planned piece once, grouped by category, and flags unplanned days", () => {
  const pieces = [
    { id: "tee", name: "Tee", category: "Tops" },
    { id: "jeans", name: "Jeans", category: "Bottoms" },
    { id: "coat", name: "Coat", category: "Outerwear" },
    { id: "hat", name: "Hat", category: "Hats" },
    { id: "home", name: "Stays home", category: "Tops" },
  ];
  const looks = [
    { id: "a", itemIds: ["tee", "jeans"] },
    { id: "b", itemIds: ["tee", "coat", "hat"] },
  ];
  const plans = { "2026-10-10": "a", "2026-10-11": "b", "2026-10-20": "a" };
  const list = packingList(pieces, looks, plans, "2026-10-10", "2026-10-12", ["Tops", "Bottoms", "Outerwear"]);
  assert.equal(list.count, 4);
  assert.deepEqual(list.unplanned, ["2026-10-12"]);
  assert.deepEqual(
    list.groups.map((group) => [group.category, group.pieces.map(({ piece, days }) => `${piece.id}x${days}`)]),
    [
      ["Tops", ["teex2"]],
      ["Bottoms", ["jeansx1"]],
      ["Outerwear", ["coatx1"]],
      ["Other", ["hatx1"]],
    ],
  );
});
