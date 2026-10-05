// Spots what a closet is missing. Import-free so node's test runner can load it directly.

export type GapPiece = {
  id: number | string;
  name: string;
  category: string;
  color: string;
  season?: string;
  wearCount?: number;
};

export type GapLook = { itemIds: Array<number | string> };

export type ClosetGap = {
  id: string;
  title: string;
  detail: string;
  /** What to put on the wishlist to fill it. */
  suggestion: { name: string; category: string; note: string };
};

type Season = "spring" | "summer" | "fall" | "winter";

function seasonOf(month: number): Season {
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

/** The season now, plus the next one when it starts within about five weeks. */
export function seasonsAhead(today: string): Season[] {
  const date = new Date(`${today}T00:00:00`);
  const now = seasonOf(date.getMonth());
  const soon = seasonOf(new Date(date.getTime() + 35 * 86_400_000).getMonth());
  return now === soon ? [now] : [now, soon];
}

function fits(piece: GapPiece, season: Season) {
  const value = (piece.season ?? "").toLowerCase();
  // Word match: "fall" contains "all", which is not "All season".
  return !value || /\ball season\b/.test(value) || value.includes(season);
}

/** How many pieces of each core category a season needs before Rove stops nudging. */
const NEEDS: Array<{ category: string; min: number; noun: [string, string] }> = [
  { category: "Tops", min: 3, noun: ["top", "tops"] },
  { category: "Bottoms", min: 2, noun: ["bottom", "bottoms"] },
  { category: "Outerwear", min: 1, noun: ["layer", "layers"] },
  { category: "Shoes", min: 1, noun: ["pair of shoes", "shoes"] },
];

const IDEAS: Record<string, Record<Season, string>> = {
  Tops: {
    winter: "Warm knit sweater",
    spring: "Light long-sleeve top",
    summer: "Breathable tee",
    fall: "Layering knit",
  },
  Bottoms: { winter: "Warm trousers", spring: "Everyday chinos", summer: "Light shorts", fall: "Dark jeans" },
  Outerwear: { winter: "Warm coat", spring: "Light jacket", summer: "Light overshirt", fall: "Light jacket" },
  Shoes: { winter: "Weatherproof boots", spring: "Everyday sneakers", summer: "Sandals", fall: "Everyday sneakers" },
};

const SINGULAR: Record<string, string> = {
  Tops: "top",
  Bottoms: "pair of trousers",
  Outerwear: "jacket",
  Dresses: "dress",
  Shoes: "pair of shoes",
  Accessories: "accessory",
};

function count(n: number, [one, many]: [string, string]) {
  return n === 0 ? `no ${many}` : `only ${n} ${n === 1 ? one : many}`;
}

/**
 * Up to `limit` things the closet is missing, most useful first: core pieces missing for the season now
 * or coming up, saved looks that keep lacking the same thing, and a favorite that's doing too much work.
 * Categories already on the wishlist (still wanted) are skipped.
 */
export function findClosetGaps(
  items: GapPiece[],
  looks: GapLook[],
  today: string,
  wantedCategories: string[] = [],
  limit = 4,
): ClosetGap[] {
  if (items.length < 3) return [];
  const gaps: ClosetGap[] = [];
  const wanted = new Set(wantedCategories);
  const seasons = seasonsAhead(today);

  // 1. Core categories that are thin for the season now or the one coming up.
  for (const season of seasons) {
    for (const need of NEEDS) {
      const have = items.filter((item) => item.category === need.category && fits(item, season)).length;
      if (have >= need.min) continue;
      const upcoming = season !== seasons[0];
      gaps.push({
        id: `season-${season}-${need.category}`,
        title: `${count(have, need.noun).replace(/^./, (c) => c.toUpperCase())} for ${season}`,
        detail: upcoming
          ? `${season[0].toUpperCase()}${season.slice(1)} is coming up and your closet is light here.`
          : `It's ${season}, and this is the thinnest part of your closet right now.`,
        suggestion: { name: IDEAS[need.category][season], category: need.category, note: `For ${season}` },
      });
    }
  }

  // 2. Saved looks that keep missing the same slot.
  if (looks.length >= 3) {
    const byId = new Map(items.map((item) => [String(item.id), item]));
    const lacking = (has: (categories: Set<string>) => boolean) =>
      looks.filter((look) => {
        const categories = new Set(
          look.itemIds.map((id) => byId.get(String(id))?.category).filter(Boolean) as string[],
        );
        return categories.size > 0 && !has(categories);
      }).length;
    const noShoes = lacking((c) => c.has("Shoes"));
    if (noShoes / looks.length >= 0.5) {
      gaps.push({
        id: "looks-shoes",
        title: `${noShoes} of your ${looks.length} saved looks have no shoes`,
        detail: "A versatile pair would finish most of them.",
        suggestion: { name: IDEAS.Shoes[seasons[0]], category: "Shoes", note: "To finish my saved looks" },
      });
    }
    const noLayer = lacking((c) => c.has("Outerwear"));
    if ((seasons.includes("fall") || seasons.includes("winter")) && noLayer / looks.length >= 0.75) {
      gaps.push({
        id: "looks-outerwear",
        title: `${noLayer} of your ${looks.length} saved looks have no layer`,
        detail: "Colder days are coming, and one jacket would cover most of them.",
        suggestion: { name: IDEAS.Outerwear[seasons.at(-1)!], category: "Outerwear", note: "To layer over my looks" },
      });
    }
  }

  // 3. A piece worn far more than anything else in a small category.
  const workhorse = [...items]
    .filter((item) => (item.wearCount ?? 0) >= 10)
    .sort((a, b) => (b.wearCount ?? 0) - (a.wearCount ?? 0))
    .find((item) => items.filter((other) => other.category === item.category).length <= 2);
  if (workhorse) {
    gaps.push({
      id: `workhorse-${workhorse.id}`,
      title: `${workhorse.name} is doing a lot of work`,
      detail: `Worn ${workhorse.wearCount} times, and it's one of only ${
        items.filter((other) => other.category === workhorse.category).length
      } in ${workhorse.category.toLowerCase()}.`,
      suggestion: {
        name: `Another ${workhorse.color.toLowerCase()} ${SINGULAR[workhorse.category] ?? "piece"}`,
        category: workhorse.category,
        note: `To give ${workhorse.name} a rest`,
      },
    });
  }

  const seen = new Set<string>();
  return gaps
    .filter((gap) => {
      if (wanted.has(gap.suggestion.category) || seen.has(gap.suggestion.category)) return false;
      seen.add(gap.suggestion.category);
      return true;
    })
    .slice(0, limit);
}
