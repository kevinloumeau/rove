import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanWishlistInput, wishlistTotal, type WishlistItem } from "../lib/wishlist.ts";

const categories = ["Tops", "Shoes", "Other"];

test("tidies a wishlist entry", () => {
  assert.deepEqual(
    cleanWishlistInput(
      { name: "  Loafers ", category: "Shoes", link: "shop.example.com/loafers", price: "129.6", note: "" },
      categories,
    ),
    { name: "Loafers", category: "Shoes", link: "https://shop.example.com/loafers", price: 130, note: "" },
  );
});

test("rejects bad entries", () => {
  assert.equal(cleanWishlistInput({ name: " " }, categories), "Give the piece a name.");
  assert.equal(
    cleanWishlistInput({ name: "Hat", link: "javascript:alert(1)" }, categories),
    "That link doesn't look right.",
  );
  assert.equal(cleanWishlistInput({ name: "Hat", price: -3 }, categories), "Use a price between 0 and 1,000,000.");
  assert.equal(cleanWishlistInput({ name: "Hat", category: "Hats" }, categories).valueOf().constructor, Object);
});

test("totals only what is still wanted", () => {
  const item = (price: number | null, boughtAt: number | null): WishlistItem => ({
    id: String(Math.random()),
    name: "x",
    category: "Other",
    link: "",
    price,
    note: "",
    createdAt: 0,
    boughtAt,
  });
  assert.equal(wishlistTotal([item(50, null), item(null, null), item(80, 1)]), 50);
});
