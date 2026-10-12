"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lookalikePairs, pairKey, type PieceSignature } from "@/lib/lookalike";
import { pieceSignatures } from "@/lib/lookalike-client";
import type { WardrobeItem } from "@/lib/wardrobe-types";

const KEPT_KEY = "rove-kept-doubles";

function readKept() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEPT_KEY) ?? "[]") as string[]);
  } catch {
    return new Set<string>();
  }
}

function addedOn(item: WardrobeItem) {
  return item.addedAt
    ? new Date(`${item.addedAt}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "earlier";
}

/** Pieces that look like the same garment added twice, with a one-tap way to drop the newer copy. */
export function ClosetDoubles({ items, onRemove }: { items: WardrobeItem[]; onRemove: (item: WardrobeItem) => void }) {
  const [signatures, setSignatures] = useState<Record<string, PieceSignature | null>>({});
  const [kept, setKept] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    queueMicrotask(() => setKept(readKept()));
  }, []);
  // Only pieces that share a category with another one can be doubles, so only those get looked at.
  const candidates = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    return items.filter((item) => (counts.get(item.category) ?? 0) > 1);
  }, [items]);
  useEffect(() => {
    let cancelled = false;
    void pieceSignatures(candidates).then((next) => {
      if (!cancelled) setSignatures(next);
    });
    return () => {
      cancelled = true;
    };
  }, [candidates]);
  const pairs = useMemo(() => lookalikePairs(candidates, signatures, kept), [candidates, signatures, kept]);
  if (!pairs.length) return null;

  function keepBoth(a: WardrobeItem, b: WardrobeItem) {
    const next = new Set(kept).add(pairKey(a.id, b.id));
    setKept(next);
    try {
      localStorage.setItem(KEPT_KEY, JSON.stringify([...next]));
    } catch {
      /* not remembered: the pair shows again next visit */
    }
  }

  return (
    <section className="insight-card closet-doubles" aria-labelledby="doubles-title">
      <h2 id="doubles-title">
        <Copy /> Added twice?
      </h2>
      <p>These look like the same piece. Keep both if they&apos;re different.</p>
      <ul>
        {pairs.slice(0, 5).map(([a, b]) => {
          // The newer copy goes; the older one keeps its wear history.
          const [older, newer] = (a.addedAt ?? "") <= (b.addedAt ?? "") ? [a, b] : [b, a];
          return (
            <li key={pairKey(a.id, b.id)}>
              <span className="forgotten-thumbs" aria-hidden>
                <img src={older.thumb ?? older.image} alt="" />
                <img src={newer.thumb ?? newer.image} alt="" />
              </span>
              <span className="doubles-copy">
                <strong>{older.name === newer.name ? older.name : `${older.name} and ${newer.name}`}</strong>
                <small>
                  Added {addedOn(older)} and {addedOn(newer)}
                </small>
              </span>
              <span className="doubles-actions">
                <Button size="sm" variant="outline" onClick={() => keepBoth(a, b)}>
                  Keep both
                </Button>
                <Button size="sm" onClick={() => onRemove(newer)} aria-label={`Remove the newer ${newer.name}`}>
                  Remove newer
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
