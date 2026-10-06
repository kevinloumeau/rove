import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDressSplit, planDressSplit } from "../lib/garment-split.ts";

// A 100×140 photo with a "dress" from the shoulders (row 30) to the bottom edge, like a tank top
// tucked into trousers that the model read as one piece.
const width = 100;
const height = 140;

function mask(fill: (x: number, y: number) => boolean) {
  const result = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (fill(x, y)) result[y * width + x] = 1;
  return result;
}

const empty = mask(() => false);
const body = (x: number, y: number) => y >= 30 && x >= 30 && x < 70;

function photo(top: [number, number, number], bottom: [number, number, number], waist = 76) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const color = y < waist ? top : bottom;
      rgba.set([...color, 255], (y * width + x) * 4);
    }
  return rgba;
}

test("splits when the model also saw a top above and trousers below", () => {
  const input = {
    width,
    height,
    dress: mask((x, y) => body(x, y) && y >= 45 && y < 125),
    upper: mask((x, y) => body(x, y) && y < 45),
    bottom: mask((x, y) => body(x, y) && y >= 125),
    belt: empty,
  };
  const plan = planDressSplit(input);
  assert.equal(plan?.evidence, "labels");
  assert.ok(plan && plan.waist >= 45 && plan.waist <= 125, String(plan?.waist));
});

test("cuts at the belt when one crosses the middle", () => {
  const belt = mask((x, y) => body(x, y) && y >= 78 && y < 83);
  const plan = planDressSplit({
    width,
    height,
    dress: mask((x, y) => body(x, y) && !belt[y * width + x]),
    upper: empty,
    bottom: empty,
    belt,
  });
  assert.deepEqual(plan, { waist: 80, evidence: "belt" });
});

test("ignores a belt at the hem", () => {
  const belt = mask((x, y) => body(x, y) && y >= 134);
  const plan = planDressSplit({
    width,
    height,
    dress: mask((x, y) => body(x, y) && y < 134),
    upper: empty,
    bottom: empty,
    belt,
  });
  assert.notEqual(plan?.evidence, "belt");
});

test("finds the waist where the color changes", () => {
  const plan = planDressSplit({
    width,
    height,
    dress: mask(body),
    upper: empty,
    bottom: empty,
    belt: empty,
    rgba: photo([54, 32, 27], [96, 80, 70], 76),
  });
  assert.equal(plan?.evidence, "color");
  assert.ok(plan && Math.abs(plan.waist - 76) <= 2, String(plan?.waist));
});

test("falls back to body proportions on a single-color look", () => {
  const plan = planDressSplit({
    width,
    height,
    dress: mask(body),
    upper: empty,
    bottom: empty,
    belt: empty,
    rgba: photo([54, 32, 27], [54, 32, 27]),
  });
  assert.equal(plan?.evidence, "proportion");
  assert.equal(plan?.waist, 80);
});

test("returns null without a dress", () => {
  assert.equal(planDressSplit({ width, height, dress: empty, upper: empty, bottom: empty, belt: empty }), null);
});

test("moves dress pixels to the top or bottom and keeps existing labels", () => {
  const input = {
    width,
    height,
    dress: mask((x, y) => body(x, y) && y >= 40),
    upper: mask((x, y) => body(x, y) && y < 40),
    bottom: empty,
    belt: empty,
  };
  const { top, bottom } = applyDressSplit(input, { waist: 80, evidence: "belt" });
  const count = (m: Uint8Array) => m.reduce((sum, v) => sum + v, 0);
  assert.equal(count(top), 40 * 50);
  assert.equal(count(bottom), 40 * 60);
  for (let i = 0; i < top.length; i += 1) assert.ok(!(top[i] && bottom[i]));
});
