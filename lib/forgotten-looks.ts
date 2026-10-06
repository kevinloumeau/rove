// Saved looks that haven't been worn in a while. Import-free so node's test runner can load it directly.

export type WornLook = {
  id: string;
  itemIds: Array<number | string>;
  /** Last day every piece of the look was logged as worn, or null. */
  lastWorn?: string | null;
  /** ISO date the look was saved. */
  createdAt?: string | null;
};

type LookPiece = { id: number | string; storedAt?: string | null; lastWorn?: string | null };

/** Logged wears grouped by day: day → the pieces worn that day. */
export function wearsByDay(wears: Array<{ itemId: string; date: string }>) {
  const days = new Map<string, Set<string>>();
  for (const wear of wears) {
    let day = days.get(wear.date);
    if (!day) days.set(wear.date, (day = new Set()));
    day.add(wear.itemId);
  }
  return days;
}

/** The latest day on which every piece of a look was worn, or null. */
export function lastWornTogether(itemIds: Array<number | string>, days: Map<string, Set<string>>) {
  const ids = itemIds.map(String);
  if (!ids.length) return null;
  let latest: string | null = null;
  for (const [day, worn] of days) if ((!latest || day > latest) && ids.every((id) => worn.has(id))) latest = day;
  return latest;
}

function shift(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/**
 * Looks not worn (or, if never worn, saved) more than `days` ago, longest-forgotten first. Looks with a piece that's
 * gone or packed away for the season are left out, and so are looks already planned for today or later.
 */
export function forgottenLooks<L extends WornLook>(
  looks: L[],
  items: LookPiece[],
  today: string,
  plans: Record<string, string>,
  days = 60,
) {
  const byId = new Map(items.map((item) => [String(item.id), item]));
  const planned = new Set(
    Object.entries(plans)
      .filter(([date]) => date >= today)
      .map(([, id]) => id),
  );
  const cutoff = shift(today, -days);
  const result: Array<{ look: L; lastWorn: string | null; since: string }> = [];
  for (const look of looks) {
    if (!look.itemIds.length || planned.has(look.id)) continue;
    const pieces = look.itemIds.map((id) => byId.get(String(id)));
    if (pieces.some((piece) => !piece || piece.storedAt)) continue;
    // Wears logged since the page loaded: pieces all last worn on the same day count as wearing the look.
    const lastDays = new Set(pieces.map((piece) => piece!.lastWorn ?? ""));
    const together = lastDays.size === 1 ? [...lastDays][0] : "";
    const lastWorn = [look.lastWorn ?? "", together].sort().at(-1) || null;
    const since = lastWorn ?? look.createdAt ?? null;
    if (!since || since >= cutoff) continue;
    result.push({ look, lastWorn, since });
  }
  return result.sort((a, b) => a.since.localeCompare(b.since));
}

/** The first day from today, within two weeks, with nothing planned; today when every day is taken. */
export function nextFreeDay(plans: Record<string, string>, today: string) {
  for (let offset = 0; offset < 14; offset += 1) {
    const day = shift(today, offset);
    if (!plans[day]) return day;
  }
  return today;
}
