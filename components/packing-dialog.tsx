"use client";

import { useEffect, useMemo, useState } from "react";
import { Luggage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { packingList } from "@/lib/packing";
import { pieceCategories, type SavedLook, type WardrobeItem } from "@/lib/wardrobe-types";

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}
function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Packing list for a date range, built from the looks planned on those days. */
export function PackingDialog({
  open,
  onOpenChange,
  startDate,
  items,
  looks,
  onPlanDay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: string;
  items: WardrobeItem[];
  looks: SavedLook[];
  onPlanDay: (date: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="packing-dialog">
        {open && (
          <PackingForm key={startDate} startDate={startDate} items={items} looks={looks} onPlanDay={onPlanDay} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PackingForm({
  startDate,
  items,
  looks,
  onPlanDay,
}: {
  startDate: string;
  items: WardrobeItem[];
  looks: SavedLook[];
  onPlanDay: (date: string) => void;
}) {
  const [from, setFrom] = useState(startDate);
  const [to, setTo] = useState(addDays(startDate, 3));
  const [plans, setPlans] = useState<Record<string, string> | null>(null);
  const storageKey = `rove-packed-${from}-${to}`;
  const [packed, setPacked] = useState<string[]>([]);
  const validRange = from <= to && to <= addDays(from, 30);

  useEffect(() => {
    if (!validRange) return;
    const controller = new AbortController();
    fetch(`/api/plans?from=${from}&to=${to}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ plans?: Record<string, string> }>) : null))
      .then((payload) => setPlans(payload?.plans ?? {}))
      .catch(() => undefined);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      queueMicrotask(() => setPacked(Array.isArray(saved) ? saved : []));
    } catch {
      /* storage unavailable: ticks last for this visit only */
    }
    return () => controller.abort();
  }, [from, to, storageKey, validRange]);

  const list = useMemo(
    () => (plans ? packingList(items, looks, plans, from, to, pieceCategories) : null),
    [plans, items, looks, from, to],
  );

  function toggle(id: string) {
    setPacked((current) => {
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* not remembered */
      }
      return next;
    });
  }

  const packedCount = list
    ? list.groups.flatMap((group) => group.pieces).filter(({ piece }) => packed.includes(String(piece.id))).length
    : 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          <Luggage /> Pack for a trip
        </DialogTitle>
        <DialogDescription>Everything from the looks you planned for these days, each piece once.</DialogDescription>
      </DialogHeader>
      <div className="packing-range">
        <label>
          Leaving
          <Input type="date" value={from} onChange={(event) => event.target.value && setFrom(event.target.value)} />
        </label>
        <label>
          Back
          <Input
            type="date"
            value={to}
            min={from}
            onChange={(event) => event.target.value && setTo(event.target.value)}
          />
        </label>
      </div>
      {!validRange ? (
        <p className="packing-note">Choose a trip of up to 31 days.</p>
      ) : !list ? (
        <p className="packing-note">Loading your plans…</p>
      ) : (
        <>
          <p className="packing-summary">
            <strong>
              {packedCount} of {list.count}
            </strong>{" "}
            {list.count === 1 ? "piece" : "pieces"} packed · {list.planned.length} of {list.days.length} days planned
          </p>
          {list.groups.length ? (
            <div className="packing-groups">
              {list.groups.map((group) => (
                <section key={group.category}>
                  <h3>{group.category}</h3>
                  <ul>
                    {group.pieces.map(({ piece, days }) => {
                      const key = String(piece.id);
                      return (
                        <li key={key} className={packed.includes(key) ? "packed" : ""}>
                          <label>
                            <Checkbox checked={packed.includes(key)} onCheckedChange={() => toggle(key)} />
                            <img src={piece.image} alt="" />
                            <span>
                              <strong>{piece.name}</strong>
                              <small>
                                {days === 1 ? "1 day" : `${days} days`}
                                {piece.inLaundry ? " · in the wash" : ""}
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
            <p className="packing-note">No looks are planned for these days yet.</p>
          )}
          {list.unplanned.length > 0 && (
            <div className="packing-unplanned">
              <p>Nothing planned yet:</p>
              <div>
                {list.unplanned.slice(0, 10).map((date) => (
                  <Button key={date} variant="outline" size="sm" onClick={() => onPlanDay(date)}>
                    {shortDate(date)}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
