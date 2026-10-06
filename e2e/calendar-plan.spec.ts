import { expect, test } from "@playwright/test";
import { seedPieces } from "./seed";

const run = Date.now().toString(36);
const lookName = `Tap plan ${run}`;

test.beforeAll(async ({ request }) => {
  const piece = `Tap tee ${run}`;
  await seedPieces(request, [{ name: piece, category: "Tops", color: "Blue", rgb: [62, 85, 240] }]);
  const { items } = (await (await request.get("/api/wardrobe")).json()) as {
    items: Array<{ id: string; name: string }>;
  };
  const id = items.find((item) => item.name === piece)?.id;
  const saved = await request.post("/api/outfits", {
    data: { id: crypto.randomUUID(), name: lookName, occasion: "Casual", itemIds: [id] },
  });
  expect(saved.ok()).toBeTruthy();
});

test("choose a look, pick a day, and confirm from the sticky bar", async ({ page }) => {
  await page.goto("/");
  await expect(async () => {
    await page.getByRole("tab", { name: "Calendar" }).click();
    await expect(page.getByRole("group", { name: "Choose a look to plan" })).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByRole("group", { name: "Choose a look to plan" }).getByRole("button", { name: lookName }).click();
  const bar = page.getByRole("region", { name: "Plan the chosen look" });
  await expect(bar).toContainText(lookName);
  await bar.getByRole("button", { name: "Plan", exact: true }).click();
  await expect(bar).toBeHidden();
  await expect(page.locator(".day-panel h2")).toHaveText(lookName);
});
