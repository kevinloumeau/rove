export const sortOptions = ["Recently added", "A–Z", "Color", "Most worn", "Least worn"];
export const DEFAULT_SORT = sortOptions[0];

/** How many closet filters (category, color, season, sort) differ from their defaults. */
export function activeFilterCount({
  category,
  color,
  season,
  sort,
}: {
  category: string;
  color: string;
  season: string;
  sort: string;
}) {
  return [category !== "All", color !== "All colors", season !== "All seasons", sort !== DEFAULT_SORT].filter(Boolean)
    .length;
}

/**
 * Up to `count` categories for the phone chip row: the ones with the most pieces, in the usual order on ties.
 * The active category always stays visible.
 */
export function primaryCategories(all: string[], itemCategories: string[], active: string, count = 3) {
  const tally = new Map<string, number>();
  for (const category of itemCategories) tally.set(category, (tally.get(category) ?? 0) + 1);
  const picked = all
    .filter((category) => tally.has(category))
    .sort((a, b) => (tally.get(b) ?? 0) - (tally.get(a) ?? 0))
    .slice(0, count);
  const fallback = all.filter(
    (category) => category !== "All" && category !== "Favorites" && !picked.includes(category),
  );
  const chips = [...picked, ...fallback].slice(0, count);
  if (active !== "All" && !chips.includes(active)) chips.splice(count - 1, 1, active);
  const ordered = all.filter((category) => chips.includes(category));
  // The chosen category leads, so it stays in view on a narrow screen.
  return [
    "All",
    ...ordered.filter((category) => category === active),
    ...ordered.filter((category) => category !== active),
  ];
}
