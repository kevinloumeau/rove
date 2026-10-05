import assert from "node:assert/strict";
import { test } from "node:test";
import { boxBlur, plainBackdrop, refineAlpha } from "../lib/cutout-refine.ts";

const width = 120;
const height = 120;

/** A blue garment (a square from 30 to 90) on a light gray backdrop, with optional noise. */
function productShot(noise = 0) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inside = x >= 30 && x < 90 && y >= 30 && y < 90;
      const jitter = noise ? Math.round(Math.sin(x * 12.9898 + y * 78.233) * noise) : 0;
      const color = inside ? [70, 110, 160] : [232 + jitter, 232 + jitter, 228 + jitter];
      rgba.set([...color, 255], (y * width + x) * 4);
    }
  }
  return rgba;
}

/** A blocky mask that overshoots the garment by 6px, as the segmenter tends to. */
function sloppyMask() {
  const mask = new Float32Array(width * height);
  for (let y = 24; y < 96; y += 1) for (let x = 24; x < 96; x += 1) mask[y * width + x] = 1;
  return mask;
}

const at = (alpha: Uint8ClampedArray, x: number, y: number) => alpha[y * width + x];

test("box blur keeps flat areas and averages edges", () => {
  const source = new Float32Array(width * height).fill(1);
  const blurred = boxBlur(source, width, height, 3);
  assert.ok(Math.abs(blurred[60 * width + 60] - 1) < 1e-6);
  assert.ok(Math.abs(blurred[0] - 1) < 1e-6);
});

test("detects a plain backdrop and rejects a busy one", () => {
  assert.deepEqual(plainBackdrop(productShot(), sloppyMask(), width, height), [232, 232, 228]);
  assert.equal(plainBackdrop(productShot(60), sloppyMask(), width, height), null);
});

test("cuts the background rim the mask let through", () => {
  const { alpha, plainBackdrop: plain } = refineAlpha(productShot(), sloppyMask(), width, height);
  assert.ok(plain);
  assert.equal(at(alpha, 60, 60), 255); // garment interior
  assert.equal(at(alpha, 26, 60), 0); // backdrop inside the sloppy mask
  assert.equal(at(alpha, 10, 10), 0); // outside the mask
  assert.ok(at(alpha, 32, 60) > 200); // just inside the garment edge
});

test("smooths the mask outline on busy photos", () => {
  const { alpha, plainBackdrop: plain } = refineAlpha(productShot(60), sloppyMask(), width, height);
  assert.equal(plain, false);
  assert.equal(at(alpha, 60, 60), 255);
  assert.equal(at(alpha, 10, 10), 0);
  const edge = at(alpha, 24, 60);
  assert.ok(edge > 0 && edge < 255, `soft edge, got ${edge}`);
});
