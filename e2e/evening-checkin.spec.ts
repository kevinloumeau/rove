import { expect, test } from "@playwright/test";
import { seedPieces } from "./seed";

const run = Date.now().toString(36);
const piece = `Evening tee ${run}`;

test.beforeAll(async ({ request }) => {
  await seedPieces(request, [{ name: piece, category: "Tops", color: "Blue", rgb: [62, 85, 240] }]);
});

test("the evening check-in logs what you wore, then how it felt", async ({ page }, testInfo) => {
  // A far-off evening nothing else logs: a new one each run, and one per project so they don't share a day.
  const offset = (Math.floor(Date.now() / 1000) % 5000) * 2 + (testInfo.project.name === "phone" ? 1 : 0);
  const day = new Date(Date.UTC(2035, 0, 1) + offset * 86_400_000).toISOString().slice(0, 10);
  await page.clock.setFixedTime(new Date(`${day}T19:00:00`));
  await page.goto("/");
  const card = page.locator(".checkin-card");
  await expect(card.getByRole("heading", { name: "What did you wear today?" })).toBeVisible();
  await expect(async () => {
    await card.getByRole("button", { name: /Pick what I wore|Something else/ }).click();
    await expect(page.locator(".journal-picker")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.locator(".journal-picker").getByRole("button", { name: piece }).click();
  await page.locator(".journal-picker").getByRole("button", { name: "Add 1 piece" }).click();
  await expect(card.getByRole("heading", { name: "How did it feel?" })).toBeVisible();
  await card.getByRole("button", { name: "Loved it" }).click();
  await expect(card).toHaveCount(0);
});
