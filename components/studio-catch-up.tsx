"use client";

import { useEffect, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WardrobeItem } from "@/lib/wardrobe-types";

const DISMISSED_KEY = "rove-studio-catchup-dismissed";

/**
 * Offers studio photos for pieces still on their plain cutout (added before automatic studio photos,
 * or skipped when the day's free photos ran out). Hidden for the visit once the studio stops.
 */
export function StudioCatchUp({
  backlog,
  stopped,
  running,
  onStart,
}: {
  backlog: WardrobeItem[];
  stopped: number | null;
  running: boolean;
  onStart: () => void;
}) {
  // Dismissing hides the card until more pieces need a studio photo than when it was dismissed.
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  useEffect(() => {
    let saved = Number.POSITIVE_INFINITY;
    try {
      saved = Number(localStorage.getItem(DISMISSED_KEY) ?? 0);
    } catch {
      /* storage unavailable: hidden for this visit once dismissed */
    }
    queueMicrotask(() => setDismissedAt(saved));
  }, []);
  if (dismissedAt === null || running || stopped !== null || !backlog.length || backlog.length <= dismissedAt)
    return null;

  function dismiss() {
    setDismissedAt(backlog.length);
    try {
      localStorage.setItem(DISMISSED_KEY, String(backlog.length));
    } catch {
      /* hidden for this visit only */
    }
  }

  const count = backlog.length === 1 ? "1 piece has" : `${backlog.length} pieces have`;
  return (
    <section className="swap-card studio-catchup" aria-label="Studio photos">
      <Camera aria-hidden />
      <div>
        <h2>{count} a plain cutout</h2>
        <p>
          Make studio photos for {backlog.length === 1 ? "it" : "them"}.
          {backlog.length > 6 ? " About 6 are free each day; the rest wait for tomorrow." : ""}
        </p>
      </div>
      <Button size="sm" onClick={onStart}>
        Make them
      </Button>
      <button className="swap-dismiss" aria-label="Keep the plain cutouts" onClick={dismiss}>
        <X />
      </button>
    </section>
  );
}
