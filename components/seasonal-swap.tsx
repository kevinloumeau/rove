"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { seasonalSwap, type Season } from "@/lib/seasonal-swap";
import type { WardrobeItem } from "@/lib/wardrobe-types";

const DISMISSED_KEY = "rove-swap-dismissed";

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function count(n: number) {
  return `${n} ${n === 1 ? "piece" : "pieces"}`;
}
function swapSummary(packAway: number, bringBack: number, seasons: Season[]) {
  const parts = [];
  if (packAway) parts.push(`pack away ${count(packAway)} you won't need`);
  if (bringBack) parts.push(`bring back ${count(bringBack)} for ${seasons.join(" and ")}`);
  return `${capitalize(seasons[0])} is here. ${capitalize(parts.join(" and "))}.`;
}

/**
 * Closet card that offers a seasonal swap when pieces are out of season, or stored ones fit again.
 * Hiding it lasts until the season changes.
 */
export function SeasonalSwapCard({
  items,
  todayIso,
  onReview,
}: {
  items: WardrobeItem[];
  todayIso: string;
  onReview: () => void;
}) {
  const swap = useMemo(() => seasonalSwap(items, todayIso), [items, todayIso]);
  const season = swap.seasons[0];
  const [dismissed, setDismissed] = useState<string | null>(season);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(DISMISSED_KEY);
    } catch {
      /* storage unavailable: the card shows until hidden for this visit */
    }
    queueMicrotask(() => setDismissed(saved));
  }, []);

  if (dismissed === season || (!swap.packAway.length && !swap.bringBack.length)) return null;
  return (
    <section className="swap-card" aria-label="Seasonal swap">
      <Package aria-hidden />
      <div>
        <h2>Time for a seasonal swap</h2>
        <p>{swapSummary(swap.packAway.length, swap.bringBack.length, swap.seasons)}</p>
      </div>
      <Button size="sm" onClick={onReview}>
        Review
      </Button>
      <button
        className="swap-dismiss"
        aria-label="Hide until next season"
        onClick={() => {
          setDismissed(season);
          try {
            localStorage.setItem(DISMISSED_KEY, season);
          } catch {
            /* shown again next visit */
          }
        }}
      >
        <X />
      </button>
    </section>
  );
}

/** Review the swap: every suggested piece starts ticked, and one button moves them all. */
export function SeasonalSwapDialog({
  open,
  onOpenChange,
  items,
  todayIso,
  onSwap,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: WardrobeItem[];
  todayIso: string;
  onSwap: (packAway: WardrobeItem[], bringBack: WardrobeItem[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="packing-dialog swap-dialog">
        {open && <SwapReview items={items} todayIso={todayIso} onSwap={onSwap} />}
      </DialogContent>
    </Dialog>
  );
}

function SwapReview({
  items,
  todayIso,
  onSwap,
}: {
  items: WardrobeItem[];
  todayIso: string;
  onSwap: (packAway: WardrobeItem[], bringBack: WardrobeItem[]) => void;
}) {
  // Worked out once when the dialog opens, so ticking pieces doesn't reshuffle the lists.
  const [swap] = useState(() => seasonalSwap(items, todayIso));
  const [skipped, setSkipped] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSkipped((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  const chosen = (pieces: WardrobeItem[]) => pieces.filter((piece) => !skipped.includes(String(piece.id)));
  const total = chosen(swap.packAway).length + chosen(swap.bringBack).length;
  const sections = [
    {
      key: "pack",
      title: "Pack away",
      hint: `Not for ${swap.seasons.join(" or ")}`,
      pieces: swap.packAway,
    },
    {
      key: "bring",
      title: "Bring back",
      hint: `Ready for ${swap.seasons.join(" and ")}`,
      pieces: swap.bringBack,
    },
  ].filter((section) => section.pieces.length);

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          <Package /> Seasonal swap
        </DialogTitle>
        <DialogDescription>
          Stored pieces stay in your saved looks and stats, but leave the closet and outfit ideas until you bring them
          back.
        </DialogDescription>
      </DialogHeader>
      {sections.length ? (
        <div className="packing-groups">
          {sections.map((section) => (
            <section key={section.key}>
              <h3>
                {section.title} · {section.hint}
              </h3>
              <ul>
                {section.pieces.map((piece) => {
                  const key = String(piece.id);
                  return (
                    <li key={key} className={skipped.includes(key) ? "skipped" : ""}>
                      <label>
                        <Checkbox checked={!skipped.includes(key)} onCheckedChange={() => toggle(key)} />
                        <img src={piece.thumb ?? piece.image} alt="" />
                        <span>
                          <strong>{piece.name}</strong>
                          <small>
                            {piece.category} · {piece.season}
                          </small>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="packing-note">Your closet already fits the season. Nothing to swap.</p>
      )}
      {sections.length > 0 && (
        <Button
          className="swap-confirm"
          disabled={!total}
          onClick={() => onSwap(chosen(swap.packAway), chosen(swap.bringBack))}
        >
          <ArrowLeftRight /> Swap {count(total)}
        </Button>
      )}
    </>
  );
}
