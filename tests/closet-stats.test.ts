import assert from "node:assert/strict";
import { test } from "node:test";
import { closetStats, costPerWear, formatMoney } from "../lib/closet-stats.ts";

test("cost per wear divides price by wears and treats unworn pieces as one wear", () => {
  assert.equal(costPerWear(100, 4), 25);
  assert.equal(costPerWear(100, 0), 100);
  assert.equal(costPerWear(null, 3), null);
  assert.equal(costPerWear(0, 3), null);
});

test("formats whole and fractional amounts", () => {
  assert.equal(formatMoney(120), "$120");
  assert.equal(formatMoney(12.5), "$12.50");
  assert.equal(formatMoney(1250), "$1,250");
});

test("summarizes a closet", () => {
  const stats = closetStats([
    { id: 1, name: "Jeans", category: "Bottoms", color: "Blue", price: 80, wearCount: 8 },
    { id: 2, name: "Tee", category: "Tops", color: "White", price: 20, wearCount: 2, inLaundry: true },
    { id: 3, name: "Blazer", category: "Outerwear", color: "Blue", wearCount: 0 },
    { id: 4, name: "Shirt", category: "Tops", color: "Blue" },
  ]);
  assert.equal(stats.pieceCount, 4);
  assert.equal(stats.totalValue, 100);
  assert.equal(stats.totalWears, 10);
  assert.equal(stats.averageCostPerWear, 10);
  assert.deepEqual(stats.byCategory[0], ["Tops", 2]);
  assert.deepEqual(stats.byColor[0], ["Blue", 3]);
  assert.deepEqual(
    stats.mostWorn.map((piece) => piece.name),
    ["Jeans", "Tee"],
  );
  assert.deepEqual(
    stats.neverWorn.map((piece) => piece.name),
    ["Blazer", "Shirt"],
  );
  assert.deepEqual(
    stats.inLaundry.map((piece) => piece.name),
    ["Tee"],
  );
});
