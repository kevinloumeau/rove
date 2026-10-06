import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { seedPieces } from "./seed";

const run = Date.now().toString(36);
const today = "2026-10-06";

async function idsOf(request: APIRequestContext, names: string[]) {
  const { items } = (await (await request.get("/api/wardrobe")).json()) as {
    items: Array<{ id: string; name: string }>;
  };
  return names.map((name) => items.find((item) => item.name === name)!.id);
}

// Tabs ignore clicks until the page has hydrated, so keep clicking until the tab's content shows.
async function openTab(page: Page, tab: string, ready: () => Promise<void>) {
  await expect(async () => {
    await page.getByRole("tab", { name: tab }).click();
    await ready();
  }).toPass();
}

test("rate today's outfit in the journal, and get a loved outfit suggested again", async ({
  page,
  request,
}, testInfo) => {
  const names = [`Rated tee ${run}`, `Rated jeans ${run}`];
  await seedPieces(request, [
    { name: names[0], category: "Tops", color: "White", rgb: [240, 240, 240] },
    { name: names[1], category: "Bottoms", color: "Blue", rgb: [40, 60, 160] },
  ]);
  const ids = await idsOf(request, names);
  // A loved day 3 to 9 weeks back, for Outfit of the Day to bring back. A journal day holds everything worn on it,
  // so each run and project gets its own day where it can.
  const offset = 21 + ((Number.parseInt(run, 36) + (testInfo.project.name === "phone" ? 1 : 0)) % 42);
  const lovedDay = new Date(Date.parse(`${today}T00:00:00Z`) - offset * 86_400_000).toISOString().slice(0, 10);
  await request.post("/api/wears", { data: { itemIds: ids, date: lovedDay } });
  await request.put("/api/journal", { data: { date: lovedDay, feeling: "loved" } });

  // The suggestion only shows when nothing is planned for today.
  await request.delete(`/api/plans?date=${today}`);

  await page.clock.setFixedTime(new Date(`${today}T12:00:00`));
  await page.goto("/");
  await expect(page.getByText("You loved this on")).toBeVisible();

  await request.post("/api/wears", { data: { itemIds: ids, date: today } });
  // Start today unrated; another run may have rated it already.
  await request.put("/api/journal", { data: { date: today, feeling: "" } });
  await page.reload();
  await openTab(page, "Calendar", async () => {
    await expect(page.getByRole("button", { name: "Journal" })).toBeVisible({ timeout: 1000 });
  });
  await page.getByRole("button", { name: "Journal" }).click();
  const feeling = page.getByRole("group", { name: "How the outfit felt: Today" });
  await feeling.getByRole("button", { name: "Loved it" }).click();
  await expect(feeling.getByRole("button", { name: "Loved it" })).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await openTab(page, "Calendar", async () => {
    await expect(page.getByRole("button", { name: "Journal" })).toBeVisible({ timeout: 1000 });
  });
  await page.getByRole("button", { name: "Journal" }).click();
  await expect(feeling.getByRole("button", { name: "Loved it" })).toHaveAttribute("aria-pressed", "true");
});

test("a look not worn in months shows under Forgotten looks and can be planned", async ({ page, request }) => {
  const names = [`Forgotten shirt ${run}`, `Forgotten skirt ${run}`];
  const lookName = `Forgotten look ${run}`;
  await seedPieces(request, [
    { name: names[0], category: "Tops", color: "Green", rgb: [40, 140, 70] },
    { name: names[1], category: "Bottoms", color: "Black", rgb: [20, 20, 20] },
  ]);
  const ids = await idsOf(request, names);
  await request.post("/api/outfits", { data: { id: crypto.randomUUID(), name: lookName, itemIds: ids } });
  await request.post("/api/wears", { data: { itemIds: ids, date: "2026-06-01" } });

  await page.clock.setFixedTime(new Date(`${today}T12:00:00`));
  await page.goto("/");
  const section = page.locator(".forgotten-looks");
  await openTab(page, "Insights", async () => {
    await expect(section).toBeVisible({ timeout: 1000 });
  });
  const row = section.locator("li", { hasText: lookName });
  await expect(row).toContainText("Last worn June 1");
  await row.getByRole("button", { name: /^Plan / }).click();
  await expect(page.getByText(`Planned ${lookName}`)).toBeVisible();
  await expect(row).toHaveCount(0);
});
