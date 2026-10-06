// Outfit journal math, kept import-free so node's test runner can load it directly.

export type JournalEntry = {
  /** YYYY-MM-DD */
  date: string;
  itemIds: string[];
  note: string;
  /** Image URL, or empty when the day has no photo. */
  photo: string;
  /** loved, fine or not-again; empty when the day isn't rated. */
  feeling: string;
};

/** Merges logged wears and journal notes into one entry per day, newest first. */
export function buildEntries(
  wears: Array<{ itemId: string; date: string }>,
  notes: Array<{ date: string; note: string; photo: string; feeling?: string }>,
): JournalEntry[] {
  const days = new Map<string, JournalEntry>();
  const entry = (date: string) => {
    let found = days.get(date);
    if (!found) {
      found = { date, itemIds: [], note: "", photo: "", feeling: "" };
      days.set(date, found);
    }
    return found;
  };
  for (const wear of wears) {
    const day = entry(wear.date);
    if (!day.itemIds.includes(wear.itemId)) day.itemIds.push(wear.itemId);
  }
  for (const note of notes)
    Object.assign(entry(note.date), { note: note.note, photo: note.photo, feeling: note.feeling ?? "" });
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function shiftDay(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/**
 * Days in a row with something journaled, counting back from today. A streak that ended yesterday
 * still counts, so it doesn't read as broken before today's outfit is logged.
 */
export function currentStreak(loggedDays: Iterable<string>, today: string) {
  const days = new Set(loggedDays);
  let day = days.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = shiftDay(day, -1);
  }
  return streak;
}

/** How many days of today's month have something journaled. */
export function daysThisMonth(loggedDays: Iterable<string>, today: string) {
  const month = today.slice(0, 7);
  return new Set([...loggedDays].filter((day) => day.startsWith(month) && day <= today)).size;
}
