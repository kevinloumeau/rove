import { expect, test, type Page } from "@playwright/test";

const run = Date.now().toString(36);

// The tab ignores clicks until the page has hydrated, so keep clicking until the wishlist shows.
async function openInsights(page: Page) {
  await expect(async () => {
    await page.getByRole("tab", { name: "Insights" }).click();
    await expect(page.getByRole("heading", { name: "Wishlist" })).toBeVisible({ timeout: 1000 });
  }).toPass();
}

test("add a piece to the wishlist, mark it bought, and remove it", async ({ page }) => {
  const name = `Wish loafers ${run}`;
  await page.goto("/");
  await openInsights(page);

  await page.getByRole("textbox", { name: "Piece name" }).fill(name);
  await page.getByRole("combobox", { name: "Category" }).selectOption("Shoes");
  await page.getByRole("textbox", { name: "Link" }).fill("shop.example.com/loafers");
  await page.getByRole("textbox", { name: "Price" }).fill("120");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  const row = page.locator(".wish-list li", { hasText: name });
  await expect(row).toBeVisible();
  await expect(row.getByRole("link", { name })).toHaveAttribute("href", "https://shop.example.com/loafers");
  await expect(row).toContainText("$120");

  await row.getByRole("button", { name: "Bought" }).click();
  await expect(row).toHaveCount(0);
  await page.reload();
  await openInsights(page);
  await page.getByRole("button", { name: /^Bought \(\d+\)$/ }).click();
  const bought = page.locator(".wish-list li.bought", { hasText: name });
  await expect(bought).toBeVisible();
  await bought.getByRole("button", { name: `Remove ${name}` }).click();
  await expect(bought).toHaveCount(0);
});
