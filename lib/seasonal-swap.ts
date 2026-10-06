// Seasonal swap: which pieces to pack away and which to bring back. Import-free so node's test runner can load it directly.

export type SwapPiece = {
  id: number | string;
  name: string;
  season?: string;
  /** ISO date the piece was packed away, or null while it's in the closet. */
  storedAt?: string | null;
};

export type Season = "spring" | "summer" | "fall" | "winter";

function seasonOf(month: number): Season {
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

const ORDER: Season[] = ["winter", "spring", "summer", "fall"];

/**
 * The season now and the one after it. A swap keeps both in the closet, so winter coats aren't packed away
 * in October only to be needed again in December.
 */
export function swapSeasons(today: string): Season[] {
  const now = seasonOf(new Date(`${today}T00:00:00`).getMonth());
  return [now, ORDER[(ORDER.indexOf(now) + 1) % ORDER.length]];
}

/** True when a piece is worn in any of `seasons`. Pieces without a season, or "All season", always fit. */
export function fitsAnySeason(pieceSeason: string | undefined, seasons: Season[]) {
  const value = (pieceSeason ?? "").toLowerCase();
  // Word match: "fall" contains "all", which is not "All season".
  if (!value || /\ball season\b/.test(value)) return true;
  // Free-text seasons Rove doesn't recognize stay in the closet rather than being packed away by guesswork.
  if (!/\b(spring|summer|fall|autumn|winter)\b/.test(value)) return true;
  return seasons.some((season) => value.includes(season) || (season === "fall" && value.includes("autumn")));
}

/**
 * What a seasonal swap would move: closet pieces that fit neither this season nor the next one
 * (pack away), and stored pieces that fit again (bring back). Both lists keep the input order.
 */
export function seasonalSwap<T extends SwapPiece>(pieces: T[], today: string) {
  const seasons = swapSeasons(today);
  const packAway = pieces.filter((piece) => !piece.storedAt && !fitsAnySeason(piece.season, seasons));
  const bringBack = pieces.filter((piece) => piece.storedAt && fitsAnySeason(piece.season, seasons));
  return { seasons, packAway, bringBack };
}

/** "fall and winter". */
export function seasonsLabel(seasons: Season[]) {
  return seasons.join(" and ");
}
