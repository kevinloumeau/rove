import { expect, test } from "@playwright/test";
import { seedPieces, studioShotPng } from "./seed";

const name = `Studio knit ${Date.now().toString(36)}`;

test.beforeAll(async ({ request }) => {
  await seedPieces(request, [{ name, category: "Tops", color: "Green", rgb: [67, 119, 76] }]);
});

test("make a studio photo, compare it, and keep it", async ({ page, request }) => {
  const imageOf = async () => {
    const { items } = (await (await request.get("/api/wardrobe")).json()) as {
      items: Array<{ name: string; image: string }>;
    };
    return items.find((item) => item.name === name)?.image;
  };
  const before = await imageOf();
  // Workers AI only runs on Cloudflare, so the generated photo is stubbed here.
  let sentImage = false;
  await page.route("**/api/wardrobe/studio", async (route) => {
    sentImage = (route.request().postData() ?? "").includes("image/jpeg");
    await route.fulfill({ contentType: "image/png", body: studioShotPng(256, [67, 119, 76]) });
  });

  await page.goto("/");
  // Tiles ignore clicks until the page has hydrated, so keep clicking until the details show.
  const studioButton = page.getByRole("button", { name: "Studio photo" }).filter({ visible: true });
  await expect(async () => {
    await page.getByText(name).first().click();
    await expect(studioButton).toBeVisible({ timeout: 1000 });
  }).toPass();
  await studioButton.click();

  const dialog = page.getByRole("dialog", { name: "Studio photo" });
  await expect(dialog.getByRole("img", { name: `Studio photo of ${name}` })).toBeVisible();
  expect(sentImage).toBe(true);
  await dialog.getByRole("button", { name: "Use studio photo" }).click();
  await expect(page.getByText("Studio photo saved")).toBeVisible();
  await expect.poll(imageOf).not.toBe(before);
});

test("the catch-up makes studio photos for plain cutouts until the free ones run out", async ({ page, request }) => {
  const studioCount = async () =>
    ((await (await request.get("/api/wardrobe")).json()) as { items: Array<{ studio?: boolean }> }).items.filter(
      (item) => item.studio,
    ).length;
  const before = await studioCount();
  // One photo is made, then the day's free photos are used up.
  let calls = 0;
  await page.route("**/api/wardrobe/studio", async (route) => {
    calls += 1;
    if (calls === 1) await route.fulfill({ contentType: "image/png", body: studioShotPng(256, [67, 119, 76]) });
    else await route.fulfill({ status: 429, json: { error: "Today's free studio photos are used up." } });
  });
  await page.goto("/");
  const card = page.getByRole("region", { name: "Studio photos" });
  await expect(card).toBeVisible();
  await expect(async () => {
    await card.getByRole("button", { name: "Make them" }).click({ timeout: 1000 });
    await expect(card).toBeHidden({ timeout: 1000 });
  }).toPass();
  await expect(page.getByText("Today's free studio photos are used up.")).toBeVisible();
  await expect.poll(studioCount).toBeGreaterThan(before);
});
