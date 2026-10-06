"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Archive, BadgeDollarSign, HandHeart, Heart, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/closet-stats";
import {
  declutterCandidates,
  groupByReason,
  idleChoices,
  letGoLabels,
  letGoReasons,
  type LetGoReason,
} from "@/lib/declutter";
import { fetchWithRetry } from "@/lib/retry-fetch";
import type { WardrobeItem } from "@/lib/wardrobe-types";

const reasonIcons = { donate: HandHeart, sell: BadgeDollarSign, archive: Archive } as const;
const SHOWN = 6;

async function postArchive(body: unknown) {
  const response = await fetchWithRetry("/api/wardrobe/archive", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(payload.error || "That change could not be saved. Try again.");
}

function failure(error: unknown, fallback: string) {
  toast.error(error instanceof Error && error.message ? error.message : fallback);
}

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The let-go pile and the actions that move pieces in and out of it. Archived pieces leave the closet list
 * but keep their place in saved looks (which skip pieces they can't find), so restoring puts everything back.
 */
export function useLetGoPile({
  active,
  setItems,
  setOutfit,
  deferDelete,
}: {
  /** Load the pile the first time this turns true. */
  active: boolean;
  setItems: Dispatch<SetStateAction<WardrobeItem[]>>;
  setOutfit: Dispatch<SetStateAction<Array<number | string>>>;
  deferDelete: (label: string, urls: string[], restore: () => void, failure: string) => void;
}) {
  const [archived, setArchived] = useState<WardrobeItem[] | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (!active || requested.current) return;
    requested.current = true;
    fetch("/api/wardrobe/archive")
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as { items?: WardrobeItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Your let-go pile could not be loaded. Try again.");
        // Anything let go while the pile was loading is already at the front.
        setArchived((current) => [
          ...(current ?? []),
          ...(payload.items ?? []).filter((item) => !current?.some((piece) => String(piece.id) === String(item.id))),
        ]);
      })
      .catch((error: unknown) => {
        setArchived((current) => current ?? []);
        failure(error, "Your let-go pile could not be loaded. Try again.");
      });
  }, [active]);

  const idsOf = (pieces: WardrobeItem[]) => new Set(pieces.map((piece) => String(piece.id)));
  const archivedDay = () => new Date().toISOString().slice(0, 10);

  function moveOut(pieces: WardrobeItem[], reason: LetGoReason) {
    const ids = idsOf(pieces);
    setItems((current) => current.filter((piece) => !ids.has(String(piece.id))));
    setOutfit((current) => current.filter((id) => !ids.has(String(id))));
    const moved = pieces.map((piece) => ({
      ...piece,
      archiveReason: reason,
      archivedAt: archivedDay(),
      inLaundry: false,
    }));
    setArchived((current) =>
      current ? [...moved, ...current.filter((piece) => !ids.has(String(piece.id)))] : current,
    );
  }
  function moveIn(pieces: WardrobeItem[]) {
    const ids = idsOf(pieces);
    setArchived((current) => current?.filter((piece) => !ids.has(String(piece.id))) ?? current);
    const back = pieces.map((piece) => ({ ...piece, archiveReason: "", archivedAt: null }));
    setItems((current) => [...back, ...current.filter((piece) => !ids.has(String(piece.id)))]);
  }

  /** Moves closet pieces to the pile, with an undo. */
  function letGo(pieces: WardrobeItem[], reason: LetGoReason) {
    if (!pieces.length) return;
    moveOut(pieces, reason);
    const ids = pieces.map((piece) => String(piece.id));
    const undo = () => {
      moveIn(pieces);
      postArchive({ ids, restore: true }).catch((error: unknown) =>
        failure(error, "That piece could not be restored."),
      );
    };
    postArchive({ ids, reason })
      .then(() =>
        toast(
          pieces.length === 1
            ? `${pieces[0].name} moved to ${letGoLabels[reason].toLowerCase()}`
            : `${pieces.length} pieces moved to ${letGoLabels[reason].toLowerCase()}`,
          { action: { label: "Undo", onClick: undo } },
        ),
      )
      .catch((error: unknown) => {
        moveIn(pieces);
        failure(error, "That piece could not be moved. Try again.");
      });
  }

  /** Moves a piece between piles (donate, sell, archive) without touching the closet. */
  function changeReason(piece: WardrobeItem, reason: LetGoReason) {
    const before = piece.archiveReason;
    const set = (archiveReason: string | undefined) =>
      setArchived(
        (current) =>
          current?.map((item) => (String(item.id) === String(piece.id) ? { ...item, archiveReason } : item)) ?? current,
      );
    set(reason);
    postArchive({ ids: [String(piece.id)], reason }).catch((error: unknown) => {
      set(before);
      failure(error, "That change could not be saved. Try again.");
    });
  }

  function restore(pieces: WardrobeItem[]) {
    if (!pieces.length) return;
    moveIn(pieces);
    const ids = pieces.map((piece) => String(piece.id));
    postArchive({ ids, restore: true })
      .then(() =>
        toast.success(
          pieces.length === 1 ? `${pieces[0].name} is back in your closet` : `${ids.length} pieces restored`,
        ),
      )
      .catch((error: unknown) => {
        setItems((current) => current.filter((piece) => !ids.includes(String(piece.id))));
        setArchived((current) => (current ? [...pieces, ...current] : current));
        failure(error, "That piece could not be restored. Try again.");
      });
  }

  /** Deletes pieces from the pile for good, after the usual undo window. */
  function deleteForever(pieces: WardrobeItem[]) {
    if (!pieces.length) return;
    const ids = idsOf(pieces);
    setArchived((current) => current?.filter((piece) => !ids.has(String(piece.id))) ?? current);
    deferDelete(
      pieces.length === 1 ? `Deleted ${pieces[0].name}` : `Deleted ${pieces.length} pieces`,
      pieces.map((piece) => `/api/wardrobe?id=${encodeURIComponent(String(piece.id))}`),
      () =>
        setArchived((current) =>
          current ? [...pieces, ...current.filter((piece) => !ids.has(String(piece.id)))] : current,
        ),
      pieces.length === 1 ? "That piece could not be deleted." : "Those pieces could not be deleted.",
    );
  }

  return { archived, letGo, changeReason, restore, deleteForever };
}

type Pile = ReturnType<typeof useLetGoPile>;

export function DeclutterReview({
  items,
  today,
  pile,
  onKeep,
  onOpenPiece,
  showReview,
}: {
  items: WardrobeItem[];
  today: string;
  pile: Pile;
  /** Ask about idle pieces only once there is wear history behind the question. */
  showReview: boolean;
  onKeep: (piece: WardrobeItem) => void;
  onOpenPiece: (piece: WardrobeItem) => void;
}) {
  const [months, setMonths] = useState<number>(6);
  const [showAll, setShowAll] = useState(false);
  const [pileView, setPileView] = useState<LetGoReason>("donate");
  const candidates = declutterCandidates(items, today, months);
  const shown = showAll ? candidates : candidates.slice(0, SHOWN);
  const groups = groupByReason(pile.archived ?? []);
  const pileItems = groups[pileView];
  const sellTotal = groups.sell.reduce((sum, piece) => sum + (piece.price ?? 0), 0);

  const idleDetail = (piece: WardrobeItem) =>
    piece.lastWorn
      ? `Last worn ${shortDate(piece.lastWorn)}`
      : piece.keptAt
        ? `Kept ${shortDate(piece.keptAt)}, not worn since`
        : `Never worn${piece.addedAt ? ` · added ${shortDate(piece.addedAt)}` : ""}`;

  const pileCount = pile.archived?.length ?? 0;
  if (!showReview && !pileCount) return null;

  return (
    <div className="declutter">
      {showReview && (
        <section className="insight-card declutter-card" aria-labelledby="declutter-title">
          <header className="declutter-head">
            <h2 id="declutter-title">
              <HandHeart /> Ready to let go?
            </h2>
            <div className="declutter-chips" role="group" aria-label="Not worn in">
              {idleChoices.map((choice) => (
                <button
                  key={choice}
                  className={choice === months ? "active" : undefined}
                  aria-pressed={choice === months}
                  onClick={() => setMonths(choice)}
                >
                  {choice === 12 ? "1 year" : `${choice} months`}
                </button>
              ))}
            </div>
          </header>
          {candidates.length ? (
            <>
              <p className="insight-empty">
                {candidates.length} {candidates.length === 1 ? "piece hasn't" : "pieces haven't"} been worn in{" "}
                {months === 12 ? "a year" : `${months} months`}. Keep what you love, and pass on the rest.
              </p>
              <ul className="declutter-list">
                {shown.map((piece) => (
                  <li key={piece.id}>
                    <button className="declutter-piece" onClick={() => onOpenPiece(piece)}>
                      <img src={piece.thumb ?? piece.image} alt="" />
                      <span>
                        <strong>{piece.name}</strong>
                        <small>{idleDetail(piece)}</small>
                      </span>
                    </button>
                    <div className="declutter-actions">
                      <Button size="sm" variant="ghost" onClick={() => onKeep(piece)}>
                        <Heart /> Keep
                      </Button>
                      {letGoReasons.map((reason) => {
                        const Icon = reasonIcons[reason];
                        return (
                          <Button key={reason} size="sm" variant="outline" onClick={() => pile.letGo([piece], reason)}>
                            <Icon /> {letGoLabels[reason]}
                          </Button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
              {candidates.length > SHOWN && (
                <button className="declutter-more" onClick={() => setShowAll((value) => !value)}>
                  {showAll ? "Show fewer" : `Show all ${candidates.length}`}
                </button>
              )}
            </>
          ) : (
            <p className="insight-empty">
              Nothing to let go of. Pieces show up here once they&apos;ve gone{" "}
              {months === 12 ? "a year" : `${months} months`} without a wear.
            </p>
          )}
        </section>
      )}
      {pileCount > 0 && (
        <section className="insight-card declutter-card" aria-labelledby="pile-title">
          <header className="declutter-head">
            <h2 id="pile-title">
              <Archive /> Let-go pile
            </h2>
            <div className="declutter-chips" role="group" aria-label="Pile">
              {letGoReasons.map((reason) => (
                <button
                  key={reason}
                  className={reason === pileView ? "active" : undefined}
                  aria-pressed={reason === pileView}
                  onClick={() => setPileView(reason)}
                >
                  {letGoLabels[reason]} <b>{groups[reason].length}</b>
                </button>
              ))}
            </div>
          </header>
          {pile.archived === null ? (
            <p className="insight-empty">Loading…</p>
          ) : pileItems.length ? (
            <>
              {pileView === "sell" && sellTotal > 0 && (
                <p className="insight-empty">You paid {formatMoney(sellTotal)} for these.</p>
              )}
              <ul className="declutter-list">
                {pileItems.map((piece) => (
                  <li key={piece.id}>
                    <div className="declutter-piece">
                      <img src={piece.thumb ?? piece.image} alt="" />
                      <span>
                        <strong>{piece.name}</strong>
                        <small>
                          {[
                            piece.brand,
                            piece.size,
                            piece.price ? `Paid ${formatMoney(piece.price)}` : "",
                            piece.archivedAt ? `Moved ${shortDate(piece.archivedAt)}` : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </span>
                    </div>
                    <div className="declutter-actions">
                      {letGoReasons
                        .filter((reason) => reason !== pileView)
                        .map((reason) => {
                          const Icon = reasonIcons[reason];
                          return (
                            <Button
                              key={reason}
                              size="sm"
                              variant="ghost"
                              onClick={() => pile.changeReason(piece, reason)}
                            >
                              <Icon /> {letGoLabels[reason]}
                            </Button>
                          );
                        })}
                      <Button size="sm" variant="outline" onClick={() => pile.restore([piece])}>
                        <RotateCcw /> Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="danger"
                        aria-label={`Delete ${piece.name} for good`}
                        onClick={() => pile.deleteForever([piece])}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              {pileView !== "archive" && pileItems.length > 1 && (
                <button className="declutter-more" onClick={() => pile.deleteForever(pileItems)}>
                  {pileView === "donate" ? "Donated them all? Clear this pile" : "Sold them all? Clear this pile"}
                </button>
              )}
            </>
          ) : (
            <p className="insight-empty">
              {pileView === "donate"
                ? "Nothing waiting to be donated."
                : pileView === "sell"
                  ? "Nothing waiting to be sold."
                  : "Archived pieces leave your closet but keep their photos and wear history."}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
