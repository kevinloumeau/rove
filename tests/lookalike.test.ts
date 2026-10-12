import assert from "node:assert/strict";
import { test } from "node:test";
import { findLookalikes, lookalikePairs, pairKey, signatureFromPixels } from "../lib/lookalike.ts";

// A size x size RGBA cutout: a colored rectangle (the garment) on transparency.
function cutout(size: number, rgb: [number, number, number], box: [number, number, number, number]) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = box[1]; y < box[3]; y += 1)
    for (let x = box[0]; x < box[2]; x += 1) {
      const at = (y * size + x) * 4;
      // A darker collar band gives the shape some tone to hash.
      const shade = y < box[1] + 4 ? 0.6 : 1;
      data.set([rgb[0] * shade, rgb[1] * shade, rgb[2] * shade, 255], at);
    }
  return data;
}

const gray = signatureFromPixels(cutout(64, [128, 128, 128], [10, 8, 54, 56]), 64, 64)!;
// The same sweater, photographed smaller and off center.
const grayAgain = signatureFromPixels(cutout(96, [132, 130, 128], [30, 20, 74, 68]), 96, 96)!;
const navy = signatureFromPixels(cutout(64, [30, 40, 80], [10, 8, 54, 56]), 64, 64)!;

test("a fully transparent cutout has no signature", () => {
  assert.equal(signatureFromPixels(new Uint8ClampedArray(16 * 16 * 4), 16, 16), null);
});

test("the same garment cut out twice looks alike, a different color does not", () => {
  const closet = [
    { id: "a", name: "Gray sweater", category: "Tops", color: "Gray" },
    { id: "b", name: "Navy knit", category: "Tops", color: "Navy" },
  ];
  const found = findLookalikes(
    { id: "new", name: "Knit sweater", category: "Tops", color: "Gray" },
    grayAgain,
    closet,
    {
      a: gray,
      b: navy,
    },
  );
  assert.deepEqual(
    found.map((piece) => piece.id),
    ["a"],
  );
});

test("different categories never match, even with the same cutout", () => {
  const closet = [{ id: "a", name: "Gray sweater", category: "Tops", color: "Gray" }];
  assert.equal(
    findLookalikes({ id: "n", name: "Gray sweater", category: "Bottoms", color: "Gray" }, gray, closet, { a: gray })
      .length,
    0,
  );
});

test("pairs pieces that share a name when no cutout is known, and skips kept pairs", () => {
  const closet = [
    { id: "1", name: "Light blue jeans", category: "Bottoms", color: "Light blue" },
    { id: "2", name: "Light blue jeans", category: "Bottoms", color: "Light blue" },
    { id: "3", name: "Black tee", category: "Tops", color: "Black" },
  ];
  assert.deepEqual(
    lookalikePairs(closet, {}).map(([a, b]) => [a.id, b.id]),
    [["1", "2"]],
  );
  assert.equal(lookalikePairs(closet, {}, new Set([pairKey("2", "1")])).length, 0);
});
