// Pure closet math, kept import-free so node's test runner can load it directly.

export type StatPiece = {
  id: number | string;
  name: string;
  category: string;
  color: string;
  price?: number | null;
  wearCount?: number;
  lastWorn?: string | null;
  inLaundry?: boolean;
};

/** Price divided by wears; a piece never worn costs its full price per wear. */
export function costPerWear(price: number | null | undefined, wearCount = 0) {
  if (price == null || price <= 0) return null;
  return price / Math.max(1, wearCount);
}

export function formatMoney(value: number) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: value % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function countBy(pieces: StatPiece[], key: (piece: StatPiece) => string) {
  const counts = new Map<string, number>();
  for (const piece of pieces) counts.set(key(piece), (counts.get(key(piece)) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function closetStats<T extends StatPiece>(pieces: T[], limit = 5) {
  const priced = pieces.filter((piece) => (piece.price ?? 0) > 0);
  const totalValue = priced.reduce((sum, piece) => sum + (piece.price ?? 0), 0);
  const pricedWears = priced.reduce((sum, piece) => sum + (piece.wearCount ?? 0), 0);
  const totalWears = pieces.reduce((sum, piece) => sum + (piece.wearCount ?? 0), 0);
  const worn = pieces.filter((piece) => (piece.wearCount ?? 0) > 0);
  return {
    pieceCount: pieces.length,
    totalWears,
    totalValue,
    pricedCount: priced.length,
    averageCostPerWear: priced.length ? totalValue / Math.max(1, pricedWears) : null,
    byCategory: countBy(pieces, (piece) => piece.category),
    byColor: countBy(pieces, (piece) => piece.color),
    mostWorn: [...worn]
      .sort((a, b) => (b.wearCount ?? 0) - (a.wearCount ?? 0) || a.name.localeCompare(b.name))
      .slice(0, limit),
    neverWorn: pieces.filter((piece) => !(piece.wearCount ?? 0)),
    inLaundry: pieces.filter((piece) => piece.inLaundry),
  };
}
