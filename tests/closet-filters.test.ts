import assert from "node:assert/strict";
import { test } from "node:test";
import { activeFilterCount, primaryCategories } from "../lib/closet-filters.ts";

const all = ["All", "Tops", "Bottoms", "Outerwear", "Dresses", "Shoes", "Accessories", "Other", "Favorites"];

test("counts each filter that differs from its default", () => {
  assert.equal(
    activeFilterCount({ category: "All", color: "All colors", season: "All seasons", sort: "Recently added" }),
    0,
  );
  assert.equal(activeFilterCount({ category: "Tops", color: "Blue", season: "All seasons", sort: "A–Z" }), 3);
});

test("phone chips are the fullest categories, in the usual order", () => {
  const items = ["Shoes", "Shoes", "Tops", "Dresses", "Dresses", "Dresses", "Bottoms"];
  assert.deepEqual(primaryCategories(all, items, "All"), ["All", "Tops", "Dresses", "Shoes"]);
});

test("an empty closet still gets three chips", () => {
  assert.deepEqual(primaryCategories(all, [], "All"), ["All", "Tops", "Bottoms", "Outerwear"]);
});

test("the active category is always shown, first after All", () => {
  const chips = primaryCategories(all, ["Tops", "Bottoms", "Outerwear"], "Accessories");
  assert.equal(chips.length, 4);
  assert.deepEqual(chips.slice(0, 2), ["All", "Accessories"]);
  assert.deepEqual(primaryCategories(all, ["Tops", "Bottoms", "Outerwear"], "Bottoms").slice(0, 2), ["All", "Bottoms"]);
});
