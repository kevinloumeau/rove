import assert from "node:assert/strict";
import { test } from "node:test";
import { greeting } from "../lib/greeting.ts";

test("greets by the hour", () => {
  assert.equal(greeting(2), "Up late 🌙");
  assert.equal(greeting(8), "Good morning ☀️");
  assert.equal(greeting(12), "Good afternoon 🌤️");
  assert.equal(greeting(21), "Good evening 🌙");
});
