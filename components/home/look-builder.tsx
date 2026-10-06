"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Share2,
  Shuffle,
  WashingMachine,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { colorSwatch } from "@/lib/local-wardrobe";
import { slotDefs, slotFor, sameId, isNarrow } from "@/lib/home-utils";
import { type HomeState } from "@/hooks/use-home";
import { type WardrobeItem } from "@/lib/wardrobe-types";

const slotNoun: Record<string, string> = {
  Outerwear: "a layer",
  Tops: "a top",
  Bottoms: "a bottom",
  Shoes: "shoes",
  Accessories: "an extra",
};

/**
 * One filled row of the stack: the chosen piece in the middle with the slot's other pieces peeking in at the
 * sides. Swiping (or the arrows on wider screens) swaps in whichever piece settles in the middle.
 */
function SlotCarousel({
  slot,
  pieces,
  current,
  active,
  onSelect,
  onOpen,
  onRemove,
}: {
  slot: { label: string; category: string };
  pieces: WardrobeItem[];
  current: WardrobeItem;
  active: boolean;
  onSelect: (id: number | string) => void;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const programmatic = useRef(false);
  const index = pieces.findIndex((piece) => sameId(piece.id, current.id));

  const offsetFor = (row: HTMLDivElement, i: number) => {
    const child = row.children[i] as HTMLElement | undefined;
    return child ? child.offsetLeft - (row.clientWidth - child.clientWidth) / 2 : null;
  };
  const scrollToPiece = (i: number) => {
    const row = rowRef.current;
    const left = row && offsetFor(row, Math.max(0, Math.min(pieces.length - 1, i)));
    if (row && left !== null) row.scrollTo({ left, behavior: "smooth" });
  };

  // Keep the chosen piece centred when it changes from elsewhere (shuffle, the picker, loading a look).
  useLayoutEffect(() => {
    const row = rowRef.current;
    const left = row && offsetFor(row, index);
    if (!row || left === null || Math.abs(row.scrollLeft - left) < 2) return;
    programmatic.current = true;
    row.scrollTo({ left, behavior: "instant" });
    const frame = requestAnimationFrame(() => (programmatic.current = false));
    return () => cancelAnimationFrame(frame);
  }, [index, pieces.length]);

  // When a swipe settles, wear whichever piece ended up in the middle.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      if (programmatic.current) return;
      const middle = row.scrollLeft + row.clientWidth / 2;
      let best = -1;
      let distance = Infinity;
      Array.from(row.children).forEach((child, i) => {
        const element = child as HTMLElement;
        const gap = Math.abs(element.offsetLeft + element.clientWidth / 2 - middle);
        if (gap < distance) {
          distance = gap;
          best = i;
        }
      });
      const piece = pieces[best];
      if (piece && !sameId(piece.id, current.id)) onSelect(piece.id);
    };
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(settle, 140);
    };
    row.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      row.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [pieces, current.id, onSelect]);

  const noun = slot.label.toLowerCase();
  return (
    <div className="lb-slot filled" data-slot={slot.category}>
      <div className="lb-carousel" ref={rowRef}>
        {pieces.map((piece, i) => {
          const on = i === index;
          return (
            <div key={piece.id} className={`lb-piece ${on ? "on" : ""}`}>
              <button
                className="lb-piece-select"
                aria-label={on ? `${slot.label}: ${piece.name}` : `Wear ${piece.name} instead`}
                aria-current={on && active ? "true" : undefined}
                tabIndex={on ? 0 : -1}
                onClick={() => (on ? onOpen() : scrollToPiece(i))}
              >
                <img src={piece.thumb ?? piece.image} alt="" loading={on ? "eager" : "lazy"} decoding="async" />
              </button>
              {on && (
                <button className="lb-remove" aria-label={`Remove ${piece.name}`} onClick={onRemove}>
                  <X aria-hidden />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {pieces.length > 1 && (
        <>
          <button
            className="lb-step prev"
            aria-label={`Previous ${noun}`}
            disabled={index <= 0}
            onClick={() => scrollToPiece(index - 1)}
          >
            <ChevronLeft aria-hidden />
          </button>
          <button
            className="lb-step next"
            aria-label={`Next ${noun}`}
            disabled={index >= pieces.length - 1}
            onClick={() => scrollToPiece(index + 1)}
          >
            <ChevronRight aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}

/**
 * The look builder: the outfit as a vertical stack of cutouts on a soft backdrop. Swipe a piece to try the
 * others from that slot; tap it (or a + between pieces) to choose from a bottom sheet on phones, or from the
 * side panel on wider screens.
 */
export function LookBuilder({ home }: { home: HomeState }) {
  const {
    items,
    outfit,
    setOutfit,
    activeSlot,
    setActiveSlot,
    pickerOpen,
    setPickerOpen,
    savedLooks,
    canvasLookId,
    setCanvasLookId,
    addToOutfit,
    railItems,
    outfitItems,
    outfitColors,
    todayIso,
    logWear,
    updateCanvasLook,
    shuffleLook,
    shareLook,
    saveCurrentLook,
  } = home;
  const editingLook = canvasLookId ? savedLooks.find((look) => look.id === canvasLookId) : undefined;
  const wornToday = outfitItems.length > 0 && outfitItems.every((item) => item.lastWorn === todayIso);
  const inWash = outfitItems.filter((item) => item.inLaundry);
  const activeLabel = slotDefs.find((slot) => slot.category === activeSlot)?.label ?? activeSlot;

  const chooseSlot = (category: string) => {
    setActiveSlot(category);
    // On phones pieces are picked from a bottom sheet instead of the side panel.
    if (isNarrow(760)) setPickerOpen(true);
  };
  const removePiece = (id: number | string) =>
    setOutfit((current) => current.filter((pieceId) => !sameId(pieceId, id)));
  const startOver = () => {
    setOutfit([]);
    setCanvasLookId(null);
  };

  const pieceList = (onPick: () => void) =>
    railItems.length ? (
      <ul className="lb-pieces">
        {railItems.map((item) => {
          const inLook = outfit.some((id) => sameId(id, item.id));
          return (
            <li key={item.id}>
              <button
                className={inLook ? "active" : ""}
                aria-pressed={inLook}
                draggable
                onDragStart={(event) => event.dataTransfer.setData("text/plain", String(item.id))}
                onClick={() => {
                  if (inLook) removePiece(item.id);
                  else addToOutfit(item.id);
                  onPick();
                }}
              >
                <img src={item.thumb ?? item.image} alt="" loading="lazy" decoding="async" />
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.color}
                    {item.inLaundry ? " · in the wash" : ""}
                  </small>
                </span>
                {inLook ? <Check aria-hidden /> : <Plus aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    ) : (
      <p className="lb-empty">No {activeLabel.toLowerCase()} pieces yet. Add clothes to fill this spot.</p>
    );

  const slotTabs = (
    <div className="lb-slot-tabs" role="group" aria-label="Part of the look">
      {slotDefs.map((slot) => (
        <button
          key={slot.category}
          aria-current={activeSlot === slot.category ? "true" : undefined}
          onClick={() => setActiveSlot(slot.category)}
        >
          {slot.label}
          {outfitItems.some((item) => slotFor(item.category) === slot.category) && (
            <i aria-hidden>
              <span className="sr-only"> (chosen)</span>
            </i>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <div className="look-builder">
      <section
        className="lb-stage"
        aria-label="Your look"
        data-count={outfitItems.length}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          const value = event.dataTransfer.getData("text/plain");
          const item = items.find((piece) => String(piece.id) === value);
          if (item) addToOutfit(item.id);
        }}
      >
        <div className="lb-stage-tools">
          <button onClick={shuffleLook} aria-label="Shuffle a new look" title="Shuffle">
            <Shuffle />
          </button>
          {outfitItems.length > 0 && (
            <button onClick={startOver} aria-label="Start over" title="Start over">
              <RotateCcw />
            </button>
          )}
        </div>
        <div className="lb-stack">
          {slotDefs.map((slot) => {
            const item = outfitItems.find((piece) => slotFor(piece.category) === slot.category);
            const current = activeSlot === slot.category ? "true" : undefined;
            if (!item)
              return (
                <div key={slot.category} className="lb-slot empty" data-slot={slot.category}>
                  <button
                    className="lb-add"
                    aria-label={`Choose ${slot.label.toLowerCase()}`}
                    aria-current={current}
                    onClick={() => chooseSlot(slot.category)}
                  >
                    <Plus aria-hidden />
                    <span>{slot.label}</span>
                  </button>
                </div>
              );
            const pieces = items.filter(
              (piece) => slotFor(piece.category) === slot.category && (!piece.storedAt || sameId(piece.id, item.id)),
            );
            return (
              <SlotCarousel
                key={slot.category}
                slot={slot}
                pieces={pieces}
                current={item}
                active={Boolean(current)}
                onSelect={addToOutfit}
                onOpen={() => chooseSlot(slot.category)}
                onRemove={() => removePiece(item.id)}
              />
            );
          })}
        </div>
        {outfitItems.length === 0 && <p className="lb-hint">Tap + to start with any piece, or shuffle for an idea.</p>}
        {(outfitColors.length > 0 || inWash.length > 0) && (
          <div className="lb-stage-foot">
            {outfitColors.length > 0 && (
              <div className="lb-palette" aria-label={`Colors: ${outfitColors.join(", ")}`}>
                {outfitColors.map((color) => (
                  <i key={color} title={color} style={{ background: colorSwatch(color) }} />
                ))}
              </div>
            )}
            {inWash.length > 0 && (
              <p className="lb-wash">
                <WashingMachine aria-hidden /> {inWash.map((item) => item.name).join(", ")}{" "}
                {inWash.length === 1 ? "is" : "are"} in the wash
              </p>
            )}
          </div>
        )}
      </section>

      <aside className="lb-panel" aria-label="Pieces">
        {slotTabs}
        <div className="lb-panel-list">{pieceList(() => undefined)}</div>
      </aside>

      <div className="lb-actions">
        <button
          className="lb-save"
          disabled={!outfitItems.length}
          onClick={editingLook ? updateCanvasLook : saveCurrentLook}
        >
          {editingLook ? <Check aria-hidden /> : <Heart aria-hidden />}
          <span>{editingLook ? `Update “${editingLook.name}”` : "Save this look"}</span>
        </button>
        <button
          className="lb-secondary"
          disabled={!outfitItems.length || wornToday}
          onClick={() => logWear(outfitItems)}
          title={wornToday ? "Worn today" : "Wear this look today"}
        >
          <Check aria-hidden /> <span className="lb-label">{wornToday ? "Worn today" : "Wear today"}</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="lb-more" aria-label="More look actions" disabled={!outfitItems.length}>
              <MoreHorizontal aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            <DropdownMenuItem
              onSelect={() =>
                shareLook(editingLook?.name ?? "My look", outfitItems.map((item) => item.name).join(" · "), outfitItems)
              }
            >
              <Share2 /> Share as image
            </DropdownMenuItem>
            {editingLook && (
              <DropdownMenuItem onSelect={saveCurrentLook}>
                <Plus /> Save as new look
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={startOver}>
              <RotateCcw /> Start over
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="lb-sheet" showCloseButton={false}>
          <div className="lb-sheet-head">
            <SheetTitle>Choose {slotNoun[activeSlot] ?? activeLabel.toLowerCase()}</SheetTitle>
            <button className="lb-sheet-close" aria-label="Close" onClick={() => setPickerOpen(false)}>
              <X aria-hidden />
            </button>
          </div>
          <SheetDescription className="sr-only">Pick a piece for this part of the look.</SheetDescription>
          {slotTabs}
          <div className="lb-sheet-list">{pieceList(() => setPickerOpen(false))}</div>
          <button className="lb-sheet-done" onClick={() => setPickerOpen(false)}>
            Done
          </button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
