// How worn outfits felt, from the journal, and what that says about which pieces go together.
// Import-free so node's test runner can load it directly.

export const feelings = ["loved", "fine", "not-again"] as const;
export type Feeling = (typeof feelings)[number];
export const feelingLabels: Record<Feeling, string> = {
  loved: "Loved it",
  fine: "It was fine",
  "not-again": "Not again",
};

export function isFeeling(value: unknown): value is Feeling {
  return typeof value === "string" && (feelings as readonly string[]).includes(value);
}

/** A journaled day with a rating, and the pieces logged as worn that day. */
export type RatedDay = { date: string; feeling: Feeling; itemIds: string[] };

const WEIGHT: Record<Feeling, number> = { loved: 1, fine: 0, "not-again": -2 };

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** For every two pieces worn together on a rated day: +1 per loved day, -2 per "not again" day. */
export function pairScores(days: RatedDay[]) {
  const scores = new Map<string, number>();
  for (const day of days) {
    const ids = [...new Set(day.itemIds)];
    for (let i = 0; i < ids.length; i += 1)
      for (let j = i + 1; j < ids.length; j += 1) {
        const key = pairKey(ids[i], ids[j]);
        scores.set(key, (scores.get(key) ?? 0) + WEIGHT[day.feeling]);
      }
  }
  return scores;
}

/** How much the wearer liked these pieces together, kept small so it nudges outfit ideas rather than decides them. */
export function lookAffinity(ids: Array<string | number>, pairs: Map<string, number>) {
  const keys = ids.map(String);
  let total = 0;
  for (let i = 0; i < keys.length; i += 1)
    for (let j = i + 1; j < keys.length; j += 1) total += pairs.get(pairKey(keys[i], keys[j])) ?? 0;
  return Math.max(-4, Math.min(3, total));
}

type AgainPiece = { id: number | string; storedAt?: string | null; inLaundry?: boolean; lastWorn?: string | null };

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * A loved outfit worth wearing again today: from a loved day at least two weeks back, with every piece still in
 * the closet, clean, not packed away and not worn in the last few days. Changes from day to day when there are several.
 */
export function lovedAgain<T extends AgainPiece>(days: RatedDay[], items: T[], today: string) {
  const byId = new Map(items.map((item) => [String(item.id), item]));
  const seen = new Set<string>();
  const candidates: Array<{ date: string; pieces: T[] }> = [];
  for (const day of [...days].sort((a, b) => b.date.localeCompare(a.date))) {
    if (day.feeling !== "loved" || daysBetween(day.date, today) < 14) continue;
    const ids = [...new Set(day.itemIds)].sort();
    const key = ids.join("|");
    if (ids.length < 2 || seen.has(key)) continue;
    seen.add(key);
    const pieces = ids.map((id) => byId.get(id));
    if (pieces.some((piece) => !piece || piece.storedAt || piece.inLaundry)) continue;
    const ready = pieces as T[];
    if (ready.some((piece) => piece.lastWorn && daysBetween(piece.lastWorn, today) < 3)) continue;
    candidates.push({ date: day.date, pieces: ready });
  }
  if (!candidates.length) return null;
  const dayNumber = Math.floor(Date.parse(`${today}T00:00:00Z`) / 86_400_000);
  return candidates[dayNumber % candidates.length];
}
