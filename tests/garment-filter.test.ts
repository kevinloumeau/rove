import assert from "node:assert/strict";
import { test } from "node:test";
import { keepRealGarments } from "../lib/garment-filter.ts";

const total = 1000 * 1000;

test("drops a sliver of one garment labeled as another", () => {
  const found = [
    { name: "top", area: 300_000 },
    { name: "trousers", area: 9_000 },
  ];
  assert.deepEqual(
    keepRealGarments(found, total).map((item) => item.name),
    ["top"],
  );
});

test("keeps every piece of a real full look", () => {
  const found = [
    { name: "top", area: 180_000 },
    { name: "trousers", area: 220_000 },
    { name: "shoes", area: 40_000 },
  ];
  assert.equal(keepRealGarments(found, total).length, 3);
});

test("drops specks even when nothing else was found", () => {
  assert.deepEqual(keepRealGarments([{ name: "hat", area: 5_000 }], total), []);
});

test("keeps small accessories next to a large outfit", () => {
  const found = [
    { name: "dress", area: 350_000 },
    { name: "sunglasses", area: 4_000, small: true },
  ];
  assert.equal(keepRealGarments(found, total).length, 2);
});
