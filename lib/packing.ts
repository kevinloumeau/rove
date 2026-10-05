// Packing list math. Import-free so node's test runner can load it directly.

export type PackPiece = { id: number | string; name: string; category: string };
export type PackLook = { id: string; itemIds: Array<number | string> };

export function datesBetween(from: string, to: string) {
  const dates: string[] = [];
  const day = new Date(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  while (day.getTime() <= end && dates.length < 62) {
    dates.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return dates;
}

/** Every piece worn across the trip's planned looks, once each, grouped by category in closet order. */
export function packingList<T extends PackPiece>(
  pieces: T[],
  looks: PackLook[],
  plans: Record<string, string>,
  from: string,
  to: string,
  categoryOrder: string[],
) {
  const days = datesBetween(from, to);
  const planned = days.filter((date) => looks.some((look) => look.id === plans[date]));
  const wanted = new Map<string, number>();
  for (const date of planned) {
    const look = looks.find((candidate) => candidate.id === plans[date]);
    for (const id of look?.itemIds ?? []) wanted.set(String(id), (wanted.get(String(id)) ?? 0) + 1);
  }
  const chosen = pieces.filter((piece) => wanted.has(String(piece.id)));
  const groups = categoryOrder
    .map((category) => ({
      category,
      pieces: chosen
        .filter((piece) => piece.category === category)
        .map((piece) => ({ piece, days: wanted.get(String(piece.id)) ?? 0 })),
    }))
    .filter((group) => group.pieces.length);
  const leftover = chosen.filter((piece) => !categoryOrder.includes(piece.category));
  if (leftover.length)
    groups.push({
      category: "Other",
      pieces: leftover.map((piece) => ({ piece, days: wanted.get(String(piece.id)) ?? 0 })),
    });
  return { days, planned, unplanned: days.filter((date) => !planned.includes(date)), groups, count: chosen.length };
}
