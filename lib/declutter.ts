// Declutter math, kept import-free so node's test runner can load it directly.

export const letGoReasons = ["donate", "sell", "archive"] as const;
export type LetGoReason = (typeof letGoReasons)[number];

export const letGoLabels: Record<LetGoReason, string> = {
  donate: "Donate",
  sell: "Sell",
  archive: "Archive",
};

export function isLetGoReason(value: unknown): value is LetGoReason {
  return typeof value === "string" && (letGoReasons as readonly string[]).includes(value);
}

/** How long a piece can sit unworn before Rove asks about it. */
export const idleChoices = [3, 6, 12] as const;

export type DeclutterPiece = {
  id: number | string;
  name: string;
  /** ISO date the piece was added to the closet. */
  addedAt?: string | null;
  lastWorn?: string | null;
  /** ISO date the wearer last chose to keep it from this review. */
  keptAt?: string | null;
  inLaundry?: boolean;
};

/** The ISO date `months` before `today`, clamped to the end of shorter months. */
export function monthsBefore(today: string, months: number) {
  const [year, month, day] = today.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * The most recent sign that a piece is still wanted: a wear, a "keep" from this review, or the day it was
 * added. Pieces are only questioned once that date is older than the idle window.
 */
export function lastSignal(piece: DeclutterPiece) {
  const dates = [piece.lastWorn, piece.keptAt, piece.addedAt].filter((date): date is string => Boolean(date));
  return dates.length ? dates.sort().at(-1)! : null;
}

/** Pieces with no wear, keep or add inside the last `months`, longest-idle first. Pieces in the wash are skipped. */
export function declutterCandidates<T extends DeclutterPiece>(pieces: T[], today: string, months: number) {
  const cutoff = monthsBefore(today, months);
  return pieces
    .filter((piece) => !piece.inLaundry)
    .map((piece) => ({ piece, since: lastSignal(piece) }))
    .filter((entry): entry is { piece: T; since: string } => entry.since !== null && entry.since < cutoff)
    .sort((a, b) => a.since.localeCompare(b.since) || a.piece.name.localeCompare(b.piece.name))
    .map(({ piece }) => piece);
}

/** Groups a let-go pile by reason, keeping each group's order. */
export function groupByReason<T extends { archiveReason?: string | null }>(pieces: T[]) {
  const groups: Record<LetGoReason, T[]> = { donate: [], sell: [], archive: [] };
  for (const piece of pieces) groups[isLetGoReason(piece.archiveReason) ? piece.archiveReason : "archive"].push(piece);
  return groups;
}
