// Picks outfit ideas that go together. Import-free so node's test runner can load it directly.

export type ShufflePiece = {
  id: number | string;
  category: string;
  color: string;
  season?: string;
  inLaundry?: boolean;
  /** Packed away for the off season. */
  storedAt?: string | null;
  lastWorn?: string | null;
};

/** Colors that pair with anything. */
const NEUTRALS = new Set([
  "Black",
  "Charcoal",
  "Gray",
  "Light gray",
  "White",
  "Cream",
  "Beige",
  "Tan",
  "Brown",
  "Navy",
  "Blue",
  "Light blue",
  "Olive",
]);
/** Statement colors that fight each other. */
const CLASHES = [
  ["Red", "Pink"],
  ["Red", "Orange"],
  ["Red", "Purple"],
  ["Orange", "Pink"],
  ["Orange", "Purple"],
  ["Green", "Red"],
  ["Yellow", "Purple"],
];

export function seasonOf(date: Date) {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

function fitsSeason(pieceSeason: string | undefined, season: string) {
  const value = (pieceSeason ?? "").toLowerCase();
  // Word match: "fall" contains "all", which is not "All season".
  return !value || /\ball season\b/.test(value) || value.includes(season);
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`)) / 86_400_000);
}

/** Higher is better. Exposed for tests. */
export function scoreLook(pieces: ShufflePiece[], today: string) {
  const season = seasonOf(new Date(`${today}T00:00:00`));
  const statements = [...new Set(pieces.map((piece) => piece.color).filter((color) => !NEUTRALS.has(color)))];
  let score = 0;
  // One statement color reads as intentional; several start to compete.
  if (statements.length === 1) score += 2;
  else if (statements.length === 0) score += 1;
  else score -= (statements.length - 1) * 2;
  if (statements.includes("Multicolor") && statements.length > 1) score -= 2;
  for (const [a, b] of CLASHES) if (statements.includes(a) && statements.includes(b)) score -= 3;
  for (const piece of pieces) {
    if (fitsSeason(piece.season, season)) score += 1;
    else score -= 2;
    if (piece.lastWorn && daysBetween(piece.lastWorn, today) < 3) score -= 1;
  }
  return score;
}

const OPTIONAL_LAYER_SEASONS = new Set(["spring", "fall", "winter"]);

/**
 * Builds a look from what's clean and not packed away: a top (or dress), a bottom unless it's a dress, plus a layer
 * in cooler seasons, shoes and one extra when the closet has them. Tries a few dozen combinations
 * and returns one of the best-scoring, so repeated shuffles still vary.
 */
export function suggestLook<T extends ShufflePiece>(
  pieces: T[],
  options: { today: string; current?: Array<number | string>; random?: () => number },
): T[] {
  const random = options.random ?? Math.random;
  const clean = pieces.filter((piece) => !piece.inLaundry && !piece.storedAt);
  const of = (...categories: string[]) => clean.filter((piece) => categories.includes(piece.category));
  const pick = <P>(list: P[]) => list[Math.floor(random() * list.length)];
  const season = seasonOf(new Date(`${options.today}T00:00:00`));
  const currentKey = (options.current ?? []).map(String).sort().join("|");

  const candidates: Array<{ look: T[]; score: number }> = [];
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const look: T[] = [];
    const top = pick(of("Tops", "Dresses"));
    if (top) look.push(top);
    if (top?.category !== "Dresses") {
      const bottom = pick(of("Bottoms"));
      if (bottom) look.push(bottom);
    }
    const layers = of("Outerwear");
    if (layers.length && (OPTIONAL_LAYER_SEASONS.has(season) || random() < 0.3)) look.push(pick(layers));
    const shoes = pick(of("Shoes"));
    if (shoes) look.push(shoes);
    const extra = pick(of("Accessories", "Other"));
    if (extra && random() < 0.6) look.push(extra);
    if (!look.length) continue;
    let score = scoreLook(look, options.today);
    if (
      look
        .map((piece) => String(piece.id))
        .sort()
        .join("|") === currentKey
    )
      score -= 5;
    candidates.push({ look, score });
  }
  if (!candidates.length) return [];
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates.filter((candidate) => candidate.score >= candidates[0].score - 1).slice(0, 5);
  return pick(best).look;
}
