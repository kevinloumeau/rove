import assert from "node:assert/strict";
import { test } from "node:test";
import { differenceHash, hashDistance } from "../lib/photo-hash.ts";

const gradient = Array.from({ length: 72 }, (_, index) => 255 - (index % 9) * 20);

test("hashes a left-to-right fade as all ones", () => {
  assert.equal(differenceHash(gradient), "ffffffffffffffff");
});

test("near-identical thumbnails hash close together", () => {
  const noisy = gradient.map((value, index) => value + (index % 7 === 0 ? 3 : -2));
  assert.ok(hashDistance(differenceHash(gradient), differenceHash(noisy)) <= 6);
});

test("distance counts differing bits", () => {
  assert.equal(hashDistance("0000000000000000", "0000000000000000"), 0);
  assert.equal(hashDistance("0000000000000000", "ffffffffffffffff"), 64);
  assert.equal(hashDistance("0f00000000000001", "0000000000000000"), 5);
});
