"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Camera, Flame, ImageOff, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { currentStreak, daysThisMonth, type JournalEntry } from "@/lib/journal";
import { shrinkPhoto } from "@/lib/photo-resize";
import { fetchWithRetry } from "@/lib/retry-fetch";
import type { WardrobeItem } from "@/lib/wardrobe-types";

type WearChange = { wearCount: number; lastWorn: string | null };
type JournalPage = { entries?: JournalEntry[]; nextBefore?: string | null; loggedDays?: string[]; error?: string };

async function request<T>(url: string, init: RequestInit, fallback: string) {
  const response = await fetchWithRetry(url, init);
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || fallback);
  return payload;
}

function failure(error: unknown, fallback: string) {
  toast.error(error instanceof Error && error.message ? error.message : fallback);
}

function dayLabel(date: string, today: string) {
  const day = new Date(`${date}T00:00:00`);
  const yesterday = new Date(`${today}T00:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === today) return "Today";
  if (day.getTime() === yesterday.getTime()) return "Yesterday";
  return day.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(date.slice(0, 4) === today.slice(0, 4) ? {} : { year: "numeric" }),
  });
}

function emptyEntry(date: string): JournalEntry {
  return { date, itemIds: [], note: "", photo: "" };
}

/** Puts an entry in date order, newest first, replacing any entry for the same day. */
function upsert(entries: JournalEntry[], entry: JournalEntry) {
  return [...entries.filter((current) => current.date !== entry.date), entry].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}

/**
 * A timeline of what was worn each day, built from the wear log, with an optional outfit photo and note per day.
 * Pieces can be added to or removed from any past day, which updates their wear counts.
 */
export function OutfitJournal({
  items,
  today,
  onOpenPiece,
  onWearChange,
}: {
  items: WardrobeItem[];
  today: string;
  onOpenPiece: (item: WardrobeItem) => void;
  onWearChange: (itemId: string, change: WearChange) => void;
}) {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [loggedDays, setLoggedDays] = useState<string[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [newDay, setNewDay] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/journal", { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as JournalPage;
        if (!response.ok) throw new Error(payload.error || "Your journal could not be loaded. Try again.");
        setEntries(payload.entries ?? []);
        setNextBefore(payload.nextBefore ?? null);
        setLoggedDays(payload.loggedDays ?? []);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Your journal could not be loaded. Try again.");
      });
    return () => controller.abort();
  }, []);

  async function loadOlder() {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const payload = await request<JournalPage>(
        `/api/journal?before=${nextBefore}`,
        {},
        "Older days could not be loaded. Try again.",
      );
      setEntries((current) => (payload.entries ?? []).reduce(upsert, current ?? []));
      setNextBefore(payload.nextBefore ?? null);
    } catch (reason) {
      failure(reason, "Older days could not be loaded. Try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  const byId = new Map(items.map((item) => [String(item.id), item]));
  const entryFor = (date: string) => entries?.find((entry) => entry.date === date) ?? emptyEntry(date);
  /** Updates one day from its latest state, so changes made while a request was in flight aren't lost. */
  const patch = (date: string, change: (entry: JournalEntry) => Partial<JournalEntry>) =>
    setEntries((current) => {
      const entry = current?.find((candidate) => candidate.date === date) ?? emptyEntry(date);
      return upsert(current ?? [], { ...entry, ...change(entry) });
    });
  const markLogged = (date: string) =>
    setLoggedDays((current) => (current.includes(date) ? current : [...current, date]));

  async function addPieces(date: string, itemIds: string[]) {
    const fresh = itemIds.filter((id) => !entryFor(date).itemIds.includes(id));
    if (!fresh.length) return;
    patch(date, (entry) => ({ itemIds: [...entry.itemIds, ...fresh.filter((id) => !entry.itemIds.includes(id))] }));
    markLogged(date);
    try {
      await request(
        "/api/wears",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ itemIds: fresh, date }),
        },
        "Those pieces could not be logged. Try again.",
      );
      for (const id of fresh) {
        const item = byId.get(id);
        if (!item) continue;
        onWearChange(id, {
          wearCount: (item.wearCount ?? 0) + 1,
          lastWorn: !item.lastWorn || item.lastWorn < date ? date : item.lastWorn,
        });
      }
    } catch (reason) {
      patch(date, (entry) => ({ itemIds: entry.itemIds.filter((id) => !fresh.includes(id)) }));
      failure(reason, "Those pieces could not be logged. Try again.");
    }
  }

  async function removePiece(date: string, itemId: string) {
    patch(date, (entry) => ({ itemIds: entry.itemIds.filter((id) => id !== itemId) }));
    try {
      const result = await request<WearChange>(
        `/api/wears?itemId=${encodeURIComponent(itemId)}&date=${date}`,
        { method: "DELETE" },
        "That piece could not be removed. Try again.",
      );
      onWearChange(itemId, { wearCount: result.wearCount, lastWorn: result.lastWorn });
    } catch (reason) {
      patch(date, (entry) => ({
        itemIds: entry.itemIds.includes(itemId) ? entry.itemIds : [...entry.itemIds, itemId],
      }));
      failure(reason, "That piece could not be removed. Try again.");
    }
  }

  async function saveNote(date: string, note: string) {
    const previous = entryFor(date).note;
    if (note.trim() === previous) return;
    patch(date, () => ({ note: note.trim() }));
    if (note.trim()) markLogged(date);
    try {
      await request(
        "/api/journal",
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date, note }),
        },
        "That note could not be saved. Try again.",
      );
    } catch (reason) {
      patch(date, () => ({ note: previous }));
      failure(reason, "That note could not be saved. Try again.");
    }
  }

  async function savePhoto(date: string, file: File) {
    const previous = entryFor(date).photo;
    const preview = URL.createObjectURL(file);
    patch(date, () => ({ photo: preview }));
    markLogged(date);
    try {
      const form = new FormData();
      form.set("date", date);
      form.set("photo", await shrinkPhoto(file));
      const result = await request<{ photo: string }>(
        "/api/journal",
        { method: "POST", body: form },
        "That photo could not be saved. Try again.",
      );
      patch(date, () => ({ photo: result.photo }));
    } catch (reason) {
      patch(date, () => ({ photo: previous }));
      failure(reason, "That photo could not be saved. Try again.");
    } finally {
      URL.revokeObjectURL(preview);
    }
  }

  async function removePhoto(date: string) {
    const previous = entryFor(date).photo;
    patch(date, () => ({ photo: "" }));
    try {
      await request("/api/journal?date=" + date, { method: "DELETE" }, "That photo could not be removed. Try again.");
    } catch (reason) {
      patch(date, () => ({ photo: previous }));
      failure(reason, "That photo could not be removed. Try again.");
    }
  }

  if (error)
    return (
      <div className="empty-state">
        <BookOpen />
        <h2>Your journal didn&apos;t load</h2>
        <p>{error}</p>
      </div>
    );
  if (!entries) return <p className="journal-loading">Loading your journal…</p>;

  // Today always has a card, so there's somewhere to log the day's outfit.
  const shown = entries.some((entry) => entry.date === today) ? entries : [emptyEntry(today), ...entries];
  const streak = currentStreak(loggedDays, today);
  const thisMonth = daysThisMonth(loggedDays, today);

  return (
    <div className="journal">
      <section className="journal-summary" aria-label="Journal summary">
        <div>
          <strong>
            <Flame /> {streak}
          </strong>
          <span>day streak</span>
        </div>
        <div>
          <strong>{thisMonth}</strong>
          <span>{thisMonth === 1 ? "day logged this month" : "days logged this month"}</span>
        </div>
        <form
          className="journal-add-day"
          onSubmit={(event) => {
            event.preventDefault();
            if (!newDay || newDay > today) return;
            setEntries((current) =>
              current?.some((entry) => entry.date === newDay) ? current : upsert(current ?? [], emptyEntry(newDay)),
            );
            setPickingFor(newDay);
            setNewDay("");
          }}
        >
          <label>
            <span>Journal another day</span>
            <Input type="date" max={today} value={newDay} onChange={(event) => setNewDay(event.target.value)} />
          </label>
          <Button type="submit" variant="outline" disabled={!newDay}>
            <Plus /> Add
          </Button>
        </form>
      </section>
      <ol className="journal-list">
        {shown.map((entry) => (
          <JournalDay
            key={entry.date}
            entry={entry}
            label={dayLabel(entry.date, today)}
            byId={byId}
            onOpenPiece={onOpenPiece}
            onAddPieces={() => setPickingFor(entry.date)}
            onRemovePiece={(itemId) => void removePiece(entry.date, itemId)}
            onSaveNote={(note) => void saveNote(entry.date, note)}
            onPhoto={(file) => void savePhoto(entry.date, file)}
            onRemovePhoto={() => void removePhoto(entry.date)}
          />
        ))}
      </ol>
      {nextBefore ? (
        <Button variant="outline" className="journal-more" disabled={loadingMore} onClick={() => void loadOlder()}>
          {loadingMore ? "Loading…" : "Show older days"}
        </Button>
      ) : entries.length ? (
        <p className="journal-end">That&apos;s everything you&apos;ve journaled.</p>
      ) : null}
      <PiecePicker
        open={pickingFor !== null}
        date={pickingFor}
        label={pickingFor ? dayLabel(pickingFor, today) : ""}
        items={items}
        already={pickingFor ? entryFor(pickingFor).itemIds : []}
        onOpenChange={(open) => !open && setPickingFor(null)}
        onSave={(itemIds) => {
          if (pickingFor) void addPieces(pickingFor, itemIds);
          setPickingFor(null);
        }}
      />
    </div>
  );
}

function JournalDay({
  entry,
  label,
  byId,
  onOpenPiece,
  onAddPieces,
  onRemovePiece,
  onSaveNote,
  onPhoto,
  onRemovePhoto,
}: {
  entry: JournalEntry;
  label: string;
  byId: Map<string, WardrobeItem>;
  onOpenPiece: (item: WardrobeItem) => void;
  onAddPieces: () => void;
  onRemovePiece: (itemId: string) => void;
  onSaveNote: (note: string) => void;
  onPhoto: (file: File) => void;
  onRemovePhoto: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState(entry.note);
  const [syncedNote, setSyncedNote] = useState(entry.note);
  // Follow the saved note (e.g. after a failed save rolls back) without clobbering typing in progress.
  if (entry.note !== syncedNote) {
    setSyncedNote(entry.note);
    setNote(entry.note);
  }
  const pieces = entry.itemIds.map((id) => byId.get(id)).filter((item): item is WardrobeItem => Boolean(item));

  return (
    <li className="journal-day">
      <div className="journal-photo">
        {entry.photo ? (
          <>
            <img src={entry.photo} alt={`Outfit on ${label}`} />
            <div className="journal-photo-actions">
              <button aria-label="Replace photo" onClick={() => fileInput.current?.click()}>
                <Camera /> <span>Replace</span>
              </button>
              <button aria-label="Remove photo" onClick={onRemovePhoto}>
                <ImageOff />
              </button>
            </div>
          </>
        ) : (
          <button className="journal-photo-empty" onClick={() => fileInput.current?.click()}>
            <Camera />
            <span>Add a photo of the look</span>
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onPhoto(file);
          }}
        />
      </div>
      <div className="journal-body">
        <h2>{label}</h2>
        <ul className="journal-pieces" aria-label="What you wore">
          {pieces.map((item) => (
            <li key={item.id}>
              <button className="journal-piece" onClick={() => onOpenPiece(item)} title={item.name}>
                <img src={item.thumb ?? item.image} alt={item.name} />
              </button>
              <button
                className="journal-piece-remove"
                aria-label={`Remove ${item.name} from ${label}`}
                onClick={() => onRemovePiece(String(item.id))}
              >
                <X />
              </button>
            </li>
          ))}
          <li>
            <button
              className="journal-piece journal-piece-add"
              onClick={onAddPieces}
              aria-label={`Add pieces to ${label}`}
            >
              <Plus />
            </button>
          </li>
        </ul>
        {!pieces.length && <p className="journal-hint">Nothing logged yet. Tap + to add what you wore.</p>}
        <textarea
          className="journal-note"
          placeholder="Where did you go? How did it feel?"
          value={note}
          maxLength={2000}
          rows={2}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => onSaveNote(note)}
        />
      </div>
    </li>
  );
}

function PiecePicker({
  open,
  date,
  label,
  items,
  already,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  date: string | null;
  label: string;
  items: WardrobeItem[];
  already: string[];
  onOpenChange: (open: boolean) => void;
  onSave: (itemIds: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [forDate, setForDate] = useState(date);
  if (date !== forDate) {
    setForDate(date);
    setChosen([]);
    setQuery("");
  }
  const needle = query.trim().toLowerCase();
  const matches = items.filter(
    (item) =>
      !already.includes(String(item.id)) &&
      (!needle || `${item.name} ${item.category} ${item.color} ${item.brand ?? ""}`.toLowerCase().includes(needle)),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="journal-picker">
        <DialogHeader>
          <DialogTitle>What did you wear?</DialogTitle>
          <DialogDescription>Pick the pieces you wore {label === "Today" ? "today" : `on ${label}`}.</DialogDescription>
        </DialogHeader>
        <label className="journal-picker-search">
          <Search />
          <span className="sr-only">Search your closet</span>
          <input value={query} placeholder="Search your closet" onChange={(event) => setQuery(event.target.value)} />
        </label>
        {matches.length ? (
          <ul className="journal-picker-grid">
            {matches.map((item) => {
              const id = String(item.id);
              const picked = chosen.includes(id);
              return (
                <li key={id}>
                  <button
                    className={picked ? "picked" : undefined}
                    aria-pressed={picked}
                    onClick={() =>
                      setChosen((current) => (picked ? current.filter((value) => value !== id) : [...current, id]))
                    }
                  >
                    <img src={item.thumb ?? item.image} alt="" />
                    <span>{item.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="journal-hint">
            {items.length ? "No pieces match that search." : "Add pieces to your closet first."}
          </p>
        )}
        <DialogFooter>
          <Button disabled={!chosen.length} onClick={() => onSave(chosen)}>
            {chosen.length ? `Add ${chosen.length} ${chosen.length === 1 ? "piece" : "pieces"}` : "Add pieces"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
