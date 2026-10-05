"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Lightbulb, Plus, RotateCcw, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findClosetGaps, type ClosetGap } from "@/lib/closet-gaps";
import { formatMoney } from "@/lib/closet-stats";
import { fetchWithRetry } from "@/lib/retry-fetch";
import { pieceCategories, type SavedLook, type WardrobeItem } from "@/lib/wardrobe-types";
import { wishlistTotal, type WishlistInput, type WishlistItem } from "@/lib/wishlist";

async function send<T>(url: string, method: string, body?: unknown) {
  const response = await fetchWithRetry(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "That change could not be saved. Try again.");
  return payload;
}

function failure(error: unknown, fallback: string) {
  toast.error(error instanceof Error && error.message ? error.message : fallback);
}

const emptyDraft = { name: "", category: "Tops", link: "", price: "", note: "" };

/** Suggestions for what the closet is missing, and a wishlist of pieces to buy. Lives on the Insights tab. */
export function Wishlist({ items, looks, today }: { items: WardrobeItem[]; looks: SavedLook[]; today: string }) {
  const [list, setList] = useState<WishlistItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [showBought, setShowBought] = useState(false);

  useEffect(() => {
    let live = true;
    send<{ items: WishlistItem[] }>("/api/wishlist", "GET")
      .then((payload) => live && setList(payload.items))
      .catch(() => live && setLoadError(true));
    return () => {
      live = false;
    };
  }, []);

  const wanted = useMemo(() => (list ?? []).filter((item) => !item.boughtAt), [list]);
  const bought = useMemo(() => (list ?? []).filter((item) => item.boughtAt), [list]);
  const gaps = useMemo(
    () =>
      list
        ? findClosetGaps(
            items,
            looks,
            today,
            wanted.map((item) => item.category),
          )
        : [],
    [items, looks, today, list, wanted],
  );
  const total = wishlistTotal(wanted);

  async function add(input: WishlistInput) {
    const { item } = await send<{ item: WishlistItem }>("/api/wishlist", "POST", input);
    setList((current) => [item, ...(current ?? [])]);
    return item;
  }

  async function addGap(gap: ClosetGap) {
    try {
      await add({ ...gap.suggestion, link: "", price: null });
      toast.success(`${gap.suggestion.name} is on your wishlist`);
    } catch (error) {
      failure(error, "That piece could not be added.");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      await add({ ...draft, price: draft.price === "" ? null : Number(draft.price) });
      setDraft({ ...emptyDraft, category: draft.category });
    } catch (error) {
      failure(error, "That piece could not be added.");
    } finally {
      setSaving(false);
    }
  }

  function setBought(item: WishlistItem, value: boolean) {
    const replace = (next: WishlistItem) =>
      setList((current) => (current ?? []).map((entry) => (entry.id === item.id ? next : entry)));
    // Any truthy time marks it bought until the server answers with the real one.
    replace({ ...item, boughtAt: value ? item.createdAt || 1 : null });
    send<{ item: WishlistItem }>("/api/wishlist", "PATCH", { id: item.id, bought: value })
      .then((payload) => replace(payload.item))
      .catch((error: unknown) => {
        replace(item);
        failure(error, "That change could not be saved.");
      });
  }

  function remove(item: WishlistItem) {
    setList((current) => (current ?? []).filter((entry) => entry.id !== item.id));
    send(`/api/wishlist?id=${encodeURIComponent(item.id)}`, "DELETE").catch((error: unknown) => {
      setList((current) => [item, ...(current ?? [])]);
      failure(error, "That piece could not be removed.");
    });
  }

  const row = (item: WishlistItem) => (
    <li key={item.id} className={item.boughtAt ? "bought" : undefined}>
      <div className="wish-main">
        <strong>
          {item.link ? (
            <a href={item.link} target="_blank" rel="noopener noreferrer">
              {item.name} <ExternalLink aria-hidden />
            </a>
          ) : (
            item.name
          )}
        </strong>
        <small>
          {item.category}
          {item.price !== null ? ` · ${formatMoney(item.price)}` : ""}
          {item.note ? ` · ${item.note}` : ""}
        </small>
      </div>
      <div className="declutter-actions">
        {item.boughtAt ? (
          <Button variant="outline" size="sm" onClick={() => setBought(item, false)}>
            <RotateCcw /> Still want
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setBought(item, true)}>
            <Check /> Bought
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="danger"
          aria-label={`Remove ${item.name}`}
          onClick={() => remove(item)}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );

  return (
    <div className="declutter wishlist">
      <section className="insight-card" aria-labelledby="gaps-title">
        <h2 id="gaps-title">
          <Lightbulb /> What your closet is missing
        </h2>
        {list === null && !loadError ? (
          <p className="insight-empty">Looking through your closet…</p>
        ) : gaps.length ? (
          <ul className="gap-list">
            {gaps.map((gap) => (
              <li key={gap.id}>
                <div>
                  <strong>{gap.title}</strong>
                  <small>{gap.detail}</small>
                </div>
                <Button variant="outline" size="sm" onClick={() => addGap(gap)}>
                  <Plus /> {gap.suggestion.name}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="insight-empty">
            {items.length < 3
              ? "Add a few more pieces and Rove will point out what's missing."
              : "Nothing obvious is missing for this season. Nice closet."}
          </p>
        )}
      </section>
      <section className="insight-card" aria-labelledby="wishlist-title">
        <header className="declutter-head">
          <h2 id="wishlist-title">
            <ShoppingBag /> Wishlist
          </h2>
          {total > 0 && <span className="wish-total">{formatMoney(total)} to go</span>}
        </header>
        <form className="wish-form" onSubmit={submit}>
          <Input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="What to buy"
            aria-label="Piece name"
            maxLength={120}
          />
          <select
            value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
            aria-label="Category"
          >
            {pieceCategories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
          <Input
            value={draft.link}
            onChange={(event) => setDraft({ ...draft, link: event.target.value })}
            placeholder="Link (optional)"
            aria-label="Link"
            inputMode="url"
          />
          <Input
            value={draft.price}
            onChange={(event) => setDraft({ ...draft, price: event.target.value.replace(/[^\d.]/g, "") })}
            placeholder="Price"
            aria-label="Price"
            inputMode="decimal"
          />
          <Button type="submit" disabled={saving || !draft.name.trim()}>
            <Plus /> Add
          </Button>
        </form>
        {loadError ? (
          <p className="insight-empty">Your wishlist could not be loaded. Refresh to try again.</p>
        ) : wanted.length ? (
          <ul className="declutter-list wish-list">{wanted.map(row)}</ul>
        ) : list ? (
          <p className="insight-empty">Nothing on your wishlist yet. Add a piece above, or take a suggestion.</p>
        ) : null}
        {bought.length > 0 && (
          <>
            <button className="declutter-more" onClick={() => setShowBought((value) => !value)}>
              {showBought ? "Hide bought" : `Bought (${bought.length})`}
            </button>
            {showBought && <ul className="declutter-list wish-list">{bought.map(row)}</ul>}
          </>
        )}
      </section>
    </div>
  );
}
