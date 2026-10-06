"use client";

import { useMemo } from "react";
import { CalendarPlus, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { forgottenLooks, nextFreeDay } from "@/lib/forgotten-looks";
import type { SavedLook, WardrobeItem } from "@/lib/wardrobe-types";

const SHOWN = 4;

function shortDay(date: string, today: string) {
  if (date === today) return "today";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Saved looks that haven't been worn in 60+ days, each with a one-tap plan for the next free day. */
export function ForgottenLooks({
  items,
  looks,
  plans,
  today,
  onOpenLook,
  onPlan,
}: {
  items: WardrobeItem[];
  looks: SavedLook[];
  plans: Record<string, string>;
  today: string;
  onOpenLook: (look: SavedLook) => void;
  onPlan: (date: string, look: SavedLook) => void;
}) {
  const forgotten = useMemo(() => forgottenLooks(looks, items, today, plans), [looks, items, today, plans]);
  const byId = new Map(items.map((item) => [String(item.id), item]));
  const freeDay = nextFreeDay(plans, today);

  return (
    <section className="insight-card forgotten-looks" aria-labelledby="forgotten-title">
      <h2 id="forgotten-title">
        <History /> Forgotten looks
      </h2>
      {forgotten.length ? (
        <ul>
          {forgotten.slice(0, SHOWN).map(({ look, lastWorn, since }) => (
            <li key={look.id}>
              <span className="forgotten-thumbs" aria-hidden>
                {look.itemIds.slice(0, 3).map((id) => {
                  const piece = byId.get(String(id));
                  return piece ? <img key={String(id)} src={piece.thumb ?? piece.image} alt="" /> : null;
                })}
              </span>
              <button className="forgotten-open" onClick={() => onOpenLook(look)}>
                <strong>{look.name}</strong>
                <small>
                  {lastWorn
                    ? `Last worn ${new Date(`${since}T00:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}`
                    : "Not worn since you saved it"}
                </small>
              </button>
              <Button size="sm" variant="outline" onClick={() => onPlan(freeDay, look)}>
                <CalendarPlus /> Plan {shortDay(freeDay, today)}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="insight-empty">
          {looks.length
            ? "Every saved look has been worn in the last two months."
            : "Save looks on the Outfits tab and Rove will remind you of the ones you stop wearing."}
        </p>
      )}
    </section>
  );
}
