import assert from "node:assert/strict";
import { test } from "node:test";
import { importStepFor } from "../lib/import-steps.ts";

test("maps progress messages to import steps", () => {
  assert.equal(importStepFor(null), 0);
  assert.equal(importStepFor("Downloading the private clothing model… 40%"), 0);
  assert.equal(importStepFor("Finding garments on this device…"), 0);
  assert.equal(importStepFor("Cleaning top edges…"), 1);
  assert.equal(importStepFor("Naming the top…"), 2);
  assert.equal(importStepFor("Downloading the private style model… 10%"), 2);
  assert.equal(importStepFor("Saving the privately processed pieces…"), 2);
});
