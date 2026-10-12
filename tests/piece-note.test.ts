import assert from "node:assert/strict";
import { test } from "node:test";
import { pieceNote } from "../lib/piece-note.ts";

test("hides the old import filler", () => {
  assert.equal(pieceNote("Slip dress", "Green dresses isolated locally from the uploaded photo."), "");
});

test("hides a description that only repeats the name", () => {
  assert.equal(pieceNote("Light blue jeans", "Light blue jeans."), "");
  assert.equal(pieceNote("Light blue jeans", ""), "");
});

test("keeps a description that adds something", () => {
  assert.equal(pieceNote("Light blue jeans", "Light blue denim jeans."), "Light blue denim jeans.");
  assert.equal(pieceNote("Gray sweater", "From the Paris trip"), "From the Paris trip");
});
