// Which Insights to show for how much history there is, kept import-free so node's test runner can load it.

/** Wears to log before rotation insights (most worn, waiting, cost per wear) appear. */
export const UNLOCK_WEARS = 3;

export type ProgressPiece = { id: number | string; name: string; wearCount?: number };

export function insightStage(pieces: ProgressPiece[]) {
  const totalWears = pieces.reduce((sum, piece) => sum + (piece.wearCount ?? 0), 0);
  const rotationUnlocked = totalWears >= UNLOCK_WEARS;
  return {
    totalWears,
    rotationUnlocked,
    wearsToGo: Math.max(0, UNLOCK_WEARS - totalWears),
    // Shopping ideas and let-go prompts wait until there is a wear history to judge by.
    showRecommendations: rotationUnlocked,
  };
}

export type NextStep =
  | { kind: "log-wears"; wearsToGo: number }
  | { kind: "save-look" }
  | { kind: "first-outing"; piece: ProgressPiece }
  | { kind: "all-worn" };

/** One encouraging thing to do next, from the start of a closet to a well-worn one. */
export function nextStep(pieces: ProgressPiece[], savedLookCount: number): NextStep {
  const { wearsToGo } = insightStage(pieces);
  if (wearsToGo > 0) return { kind: "log-wears", wearsToGo };
  if (!savedLookCount) return { kind: "save-look" };
  const unworn = pieces.find((piece) => !(piece.wearCount ?? 0));
  return unworn ? { kind: "first-outing", piece: unworn } : { kind: "all-worn" };
}
