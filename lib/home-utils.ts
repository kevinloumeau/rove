"use client";

import { fetchWithRetry } from "@/lib/retry-fetch";
import { processWardrobeImage } from "@/lib/local-wardrobe";
import { makeThumbnail } from "@/lib/photo-resize";
import { type WardrobeItem } from "@/lib/wardrobe-types";

export const categories = [
  "All",
  "Tops",
  "Bottoms",
  "Outerwear",
  "Dresses",
  "Shoes",
  "Accessories",
  "Other",
  "Favorites",
];
export const occasions = ["All", "Casual", "Work", "Dinner", "Event"];
export const slotDefs = [
  { label: "Layer", category: "Outerwear" },
  { label: "Top", category: "Tops" },
  { label: "Bottom", category: "Bottoms" },
  { label: "Shoes", category: "Shoes" },
  { label: "Extras", category: "Accessories" },
];
// Dresses fill the top slot; anything uncategorized rides along as an extra.
export function slotFor(category: string) {
  if (category === "Dresses") return "Tops";
  if (category === "Other") return "Accessories";
  return category;
}

export async function sendJson(url: string, method: string, body?: unknown) {
  const response = await fetchWithRetry(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(payload.error || "Rove could not complete that request.");
  return payload;
}
export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
export const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function monthKey(date: Date) {
  return isoDate(date).slice(0, 7);
}
export function sameId(a: number | string, b: number | string) {
  return String(a) === String(b);
}

export type DuplicateMatch = { id: string; name: string; image: string };
export type BatchEntry = {
  name: string;
  status: "waiting" | "working" | "added" | "skipped" | "failed";
  detail?: string;
};
export type ImportResult = { importId: string; items: WardrobeItem[]; cleanedCount: number };

export async function findDuplicates(hash: string | null): Promise<DuplicateMatch[]> {
  if (!hash) return [];
  const response = await fetch(`/api/wardrobe/duplicates?hash=${hash}`).catch(() => null);
  if (!response?.ok) return [];
  const payload = (await response.json().catch(() => ({}))) as { matches?: DuplicateMatch[] };
  return payload.matches ?? [];
}

/** Finds the garments in a photo on this device, then uploads the photo, cutouts and details as a draft import. */
export async function analyzeAndUpload(
  file: File,
  hash: string | null,
  onNotice: (notice: string) => void,
): Promise<ImportResult> {
  const garments = await processWardrobeImage(file, onNotice);
  const form = new FormData();
  form.set("image", file);
  if (hash) form.set("photoHash", hash);
  form.set(
    "manifest",
    JSON.stringify(
      garments.map((garment) => ({
        name: garment.name,
        category: garment.category,
        color: garment.color,
        season: garment.season,
        description: garment.description,
        tags: garment.tags,
      })),
    ),
  );
  const thumbs = await Promise.all(garments.map((garment) => makeThumbnail(garment.image)));
  garments.forEach((garment, index) => {
    form.set(`cutout-${index}`, new File([garment.image], `cutout-${index}.png`, { type: "image/png" }));
    const thumb = thumbs[index];
    if (thumb) form.set(`thumb-${index}`, new File([thumb], `thumb-${index}.webp`, { type: "image/webp" }));
  });
  onNotice("Saving the privately processed pieces…");
  const response = await fetch("/api/wardrobe/import", { method: "POST", body: form });
  const payload = (await response.json().catch(() => ({}))) as {
    importId?: string;
    items?: WardrobeItem[];
    cleanedCount?: number;
    error?: string;
  };
  if (!response.ok || !payload.importId || !payload.items?.length)
    throw new Error(payload.error || "Rove could not save that photo.");
  return { importId: payload.importId, items: payload.items, cleanedCount: payload.cleanedCount ?? 0 };
}

export async function confirmImport(importId: string, itemIds: string[]) {
  await sendJson("/api/wardrobe", "POST", { importId, itemIds });
}
/** How long a delete can be undone before it is sent to the server. */
export const UNDO_MS = 6000;

export function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return isoDate(next);
}
/** Monday-first week containing the date. */
export function weekOf(date: string) {
  const day = new Date(`${date}T00:00:00`);
  const monday = addDays(date, -((day.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}
export const LOOK_DRAG_TYPE = "application/x-rove-look";

export function isNarrow(maxWidth: number) {
  return typeof window !== "undefined" && window.matchMedia(`(max-width: ${maxWidth}px)`).matches;
}

/** Scrolls an element into view after React has rendered the change that revealed it. */
export function scrollIntoViewSoon(element: HTMLElement | null) {
  requestAnimationFrame(() => element?.scrollIntoView({ behavior: "smooth", block: "start" }));
}
