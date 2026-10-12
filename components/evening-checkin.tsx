"use client";

import { useEffect, useState } from "react";
import { Heart, Meh, ThumbsDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PiecePicker } from "@/components/outfit-journal";
import { checkinStep } from "@/lib/evening-checkin";
import { feelingLabels, feelings, type Feeling, type RatedDay } from "@/lib/look-ratings";
import type { SavedLook, WardrobeItem } from "@/lib/wardrobe-types";

const DISMISSED_KEY = "rove-checkin-dismissed";
const feelingIcons = { loved: Heart, fine: Meh, "not-again": ThumbsDown } as const;

/**
 * Evening card on the closet: what did you wear today (the planned look in one tap, or pick pieces),
 * then how it felt. Logging wears is what Insights, outfit ideas and the declutter review learn from.
 */
export function EveningCheckin({
  items,
  looks,
  plans,
  todayIso,
  ratedDays,
  onWear,
  onRate,
}: {
  items: WardrobeItem[];
  looks: SavedLook[];
  plans: Record<string, string>;
  todayIso: string;
  ratedDays: RatedDay[];
  onWear: (pieces: WardrobeItem[]) => void;
  onRate: (feeling: Feeling, itemIds: string[]) => void;
}) {
  // The hour and the dismissal are only known in the browser, so the card waits for them.
  const [clock, setClock] = useState<{ hour: number; dismissedOn: string | null } | null>(null);
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    let dismissedOn: string | null = null;
    try {
      dismissedOn = localStorage.getItem(DISMISSED_KEY);
    } catch {
      /* storage unavailable: the card can only be hidden for this visit */
    }
    queueMicrotask(() => setClock({ hour: new Date().getHours(), dismissedOn }));
  }, []);
  if (!clock) return null;

  const worn = items.filter((item) => item.lastWorn === todayIso);
  const step = checkinStep({
    hour: clock.hour,
    today: todayIso,
    closetSize: items.length,
    wornToday: worn.length > 0,
    ratedToday: ratedDays.some((day) => day.date === todayIso),
    dismissedOn: clock.dismissedOn,
  });
  if (!step) return null;

  const look = looks.find((candidate) => candidate.id === plans[todayIso]);
  const planned = (look?.itemIds ?? [])
    .map((id) => items.find((item) => String(item.id) === String(id)))
    .filter((item): item is WardrobeItem => Boolean(item));
  const shown = step === "rate" ? worn : planned;

  function dismiss() {
    setClock((current) => current && { ...current, dismissedOn: todayIso });
    try {
      localStorage.setItem(DISMISSED_KEY, todayIso);
    } catch {
      /* hidden for this visit only */
    }
  }

  return (
    <section className="checkin-card" aria-labelledby="checkin-title">
      <button className="swap-dismiss checkin-dismiss" aria-label="Not tonight" onClick={dismiss}>
        <X />
      </button>
      {shown.length > 0 && (
        <span className="checkin-thumbs" aria-hidden>
          {shown.slice(0, 4).map((piece) => (
            <img key={piece.id} src={piece.thumb ?? piece.image} alt="" />
          ))}
        </span>
      )}
      <h2 id="checkin-title">
        {step === "log" ? (
          <>
            What did you wear <em>today</em>?
          </>
        ) : (
          <>
            How did it <em>feel</em>?
          </>
        )}
      </h2>
      <p>
        {step === "rate"
          ? "Rove leans toward outfits you loved."
          : look && planned.length
            ? `${look.name} was planned for today.`
            : "Log it and Rove learns what you reach for."}
      </p>
      {step === "log" ? (
        <div className="checkin-actions">
          {planned.length > 0 && <Button onClick={() => onWear(planned)}>Wore {look?.name ?? "it"}</Button>}
          <Button variant={planned.length ? "outline" : "default"} onClick={() => setPicking(true)}>
            {planned.length ? "Something else" : "Pick what I wore"}
          </Button>
        </div>
      ) : (
        <div className="checkin-actions journal-feeling" role="group" aria-label="How today's outfit felt">
          {feelings.map((feeling) => {
            const Icon = feelingIcons[feeling];
            return (
              <button
                key={feeling}
                className={feeling}
                onClick={() =>
                  onRate(
                    feeling,
                    worn.map((piece) => String(piece.id)),
                  )
                }
              >
                <Icon aria-hidden /> {feelingLabels[feeling]}
              </button>
            );
          })}
        </div>
      )}
      <PiecePicker
        open={picking}
        date={picking ? todayIso : null}
        label="Today"
        items={items}
        already={worn.map((piece) => String(piece.id))}
        onOpenChange={setPicking}
        onSave={(ids) => {
          setPicking(false);
          onWear(items.filter((item) => ids.includes(String(item.id))));
        }}
      />
    </section>
  );
}
