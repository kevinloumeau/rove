import assert from "node:assert/strict";
import { test } from "node:test";
import { colorName, colorSwatches } from "../lib/color-name.ts";

test("names common garment colors", () => {
  const cases: Array<[[number, number, number], string]> = [
    [[150, 180, 210], "Light blue"], // light-wash denim
    [[80, 110, 150], "Blue"], // mid-wash denim
    [[30, 40, 70], "Navy"],
    [[128, 130, 132], "Gray"], // heather gray sweater
    [[240, 240, 236], "White"],
    [[20, 20, 22], "Black"],
    [[200, 180, 140], "Beige"],
    [[110, 75, 50], "Brown"],
    [[180, 45, 42], "Red"],
    [[67, 119, 76], "Green"],
    [[219, 128, 153], "Pink"],
  ];
  for (const [[r, g, b], expected] of cases) assert.equal(colorName(r, g, b), expected, `${r},${g},${b}`);
});

test("every name has a swatch", () => {
  const seen = new Set<string>();
  for (let r = 0; r < 256; r += 17)
    for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 17) seen.add(colorName(r, g, b));
  for (const name of seen) assert.ok(colorSwatches[name], name);
});
