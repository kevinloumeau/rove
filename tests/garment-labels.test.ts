import assert from "node:assert/strict";
import { test } from "node:test";
import { describeGarment } from "../lib/garment-labels.ts";

test("names light-wash jeans from the style model", () => {
  const result = describeGarment({
    kind: "pants",
    fallbackNoun: "pants",
    fallbackCategory: "Bottoms",
    color: "Light blue",
    type: [
      { label: "denim jeans", score: 0.82 },
      { label: "chino pants", score: 0.1 },
    ],
    material: [{ label: "denim", score: 0.9 }],
    pattern: [{ label: "a solid color", score: 0.95 }],
  });
  assert.equal(result.name, "Light blue jeans");
  assert.equal(result.description, "Light blue denim jeans.");
  assert.equal(result.category, "Bottoms");
  assert.deepEqual(result.tags, ["bottoms", "jeans", "light blue", "denim"]);
});

test("a sweater is a cold-weather top", () => {
  const result = describeGarment({
    kind: "top",
    fallbackNoun: "top",
    fallbackCategory: "Tops",
    color: "Gray",
    type: [{ label: "knit sweater", score: 0.7 }],
    material: [{ label: "chunky knit wool", score: 0.6 }],
    pattern: [{ label: "a solid color", score: 0.8 }],
  });
  assert.equal(result.name, "Gray sweater");
  assert.equal(result.description, "Gray knit sweater.");
  assert.equal(result.season, "Fall / winter");
});

test("jackets move to outerwear and keep patterns", () => {
  const result = describeGarment({
    kind: "top",
    fallbackNoun: "top",
    fallbackCategory: "Tops",
    color: "Green",
    type: [{ label: "zip-up jacket", score: 0.5 }],
    pattern: [{ label: "a camouflage pattern", score: 0.7 }],
  });
  assert.equal(result.category, "Outerwear");
  assert.equal(result.name, "Green camo jacket");
});

test("falls back to the plain noun when the model is unsure or missing", () => {
  const unsure = describeGarment({
    kind: "top",
    fallbackNoun: "top",
    fallbackCategory: "Tops",
    color: "White",
    type: [{ label: "t-shirt", score: 0.12 }],
  });
  assert.equal(unsure.name, "White top");
  const none = describeGarment({
    kind: "accessory",
    fallbackNoun: "bag",
    fallbackCategory: "Accessories",
    color: "Brown",
  });
  assert.equal(none.description, "Brown bag.");
});

test("denim pants read as chinos are named jeans", () => {
  const result = describeGarment({
    kind: "pants",
    fallbackNoun: "pants",
    fallbackCategory: "Bottoms",
    color: "Light blue",
    type: [{ label: "chino pants", score: 0.55 }],
    material: [{ label: "denim", score: 0.7 }],
  });
  assert.equal(result.name, "Light blue jeans");
});
