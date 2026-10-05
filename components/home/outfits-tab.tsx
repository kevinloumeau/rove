"use client";

import { Check, Heart, Pencil, Layers3, Plus, Share2, Shuffle, Trash2, WashingMachine, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { TabsContent } from "@/components/ui/tabs";
import { colorSwatch } from "@/lib/local-wardrobe";
import { type WardrobeItem } from "@/lib/wardrobe-types";
import { slotDefs, slotFor, sameId, isNarrow } from "@/lib/home-utils";
import { type HomeState } from "@/hooks/use-home";

export function OutfitsTab({ home }: { home: HomeState }) {
  const {
    items,
    outfit,
    setOutfit,
    activeSlot,
    setActiveSlot,
    pickerOpen,
    setPickerOpen,
    outfitMode,
    setOutfitMode,
    savedLooks,
    setEditingLook,
    canvasLookId,
    setCanvasLookId,
    addToOutfit,
    railItems,
    outfitItems,
    outfitColors,
    todayIso,
    logWear,
    deleteLook,
    updateCanvasLook,
    shuffleLook,
    shareLook,
    saveCurrentLook,
    loadLook,
    toggleLookFavorite,
  } = home;
  return (
    <>
      <TabsContent value="outfits" className="outfit-view">
        <section className="outfit-intro">
          <div>
            <h1>Style a look</h1>
            <p>Fill each slot, shuffle ideas, and save the combinations that work.</p>
          </div>
          <div className="view-switch" aria-label="Outfit view">
            <button className={outfitMode === "canvas" ? "active" : ""} onClick={() => setOutfitMode("canvas")}>
              Canvas
            </button>
            <button className={outfitMode === "saved" ? "active" : ""} onClick={() => setOutfitMode("saved")}>
              Saved looks <span>{savedLooks.length}</span>
            </button>
          </div>
        </section>
        {outfitMode === "canvas" ? (
          <div className="styling-workspace">
            <aside className="piece-rail">
              <div className="rail-heading">
                <h2>{activeSlot}</h2>
                <span>{railItems.length}</span>
              </div>
              <div>
                {railItems.length ? (
                  railItems.map((item) => (
                    <button
                      key={item.id}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", String(item.id))}
                      onClick={() => addToOutfit(item.id)}
                    >
                      <img src={item.thumb ?? item.image} alt="" />
                      <span>{item.name}</span>
                      <Plus />
                    </button>
                  ))
                ) : (
                  <p className="rail-empty">No {activeSlot.toLowerCase()} yet. Add a photo to grow this slot.</p>
                )}
              </div>
            </aside>
            <section
              className="outfit-canvas"
              aria-label="Outfit canvas"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const value = event.dataTransfer.getData("text/plain");
                const item = items.find((piece) => String(piece.id) === value);
                if (item) addToOutfit(item.id);
              }}
            >
              <div className="canvas-header">
                <span>Look builder</span>
                <div>
                  <button onClick={shuffleLook}>
                    <Shuffle /> Shuffle
                  </button>
                  <button
                    onClick={() => {
                      setOutfit([]);
                      setCanvasLookId(null);
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div className="slot-stack">
                {slotDefs.map((slot) => {
                  const item = outfitItems.find((piece) => slotFor(piece.category) === slot.category);
                  return (
                    <div
                      key={slot.label}
                      className={`outfit-slot ${activeSlot === slot.category ? "active" : ""} ${item ? "filled" : ""}`}
                    >
                      <button
                        className="slot-select"
                        aria-label={item ? `${slot.label}: ${item.name}` : `Choose ${slot.label.toLowerCase()}`}
                        aria-pressed={activeSlot === slot.category}
                        onClick={() => {
                          setActiveSlot(slot.category);
                          // On phones pieces are picked from a bottom sheet instead of the side rail.
                          if (isNarrow(760)) setPickerOpen(true);
                        }}
                      >
                        <span className="slot-label">{slot.label}</span>
                        {item ? (
                          <img src={item.thumb ?? item.image} alt="" />
                        ) : (
                          <span className="empty-slot">
                            <Plus /> Add {slot.label.toLowerCase()}
                          </span>
                        )}
                      </button>
                      {item && (
                        <button
                          className="remove-slot"
                          aria-label={`Remove ${item.name}`}
                          onClick={() => setOutfit((current) => current.filter((id) => !sameId(id, item.id)))}
                        >
                          <X />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="canvas-floor" />
            </section>
            <aside className="look-notes">
              <p>Current look</p>
              <h2>{outfitItems.length ? "Ready to refine" : "Start with one piece"}</h2>
              <span>
                {outfitItems.length
                  ? `${outfitItems.length} ${outfitItems.length === 1 ? "piece" : "pieces"} selected. Tap a slot to swap pieces without rebuilding the whole look.`
                  : "Choose a slot, then pick something from your closet."}
              </span>
              {outfitColors.length > 0 && (
                <div className="palette" aria-label={`Colors: ${outfitColors.join(", ")}`}>
                  {outfitColors.map((color) => (
                    <i key={color} title={color} style={{ background: colorSwatch(color) }} />
                  ))}
                </div>
              )}
              {outfitItems.some((item) => item.inLaundry) && (
                <p className="look-warning">
                  <WashingMachine />{" "}
                  {outfitItems
                    .filter((item) => item.inLaundry)
                    .map((item) => item.name)
                    .join(", ")}{" "}
                  {outfitItems.filter((item) => item.inLaundry).length === 1 ? "is" : "are"} in the wash.
                </p>
              )}
              <button
                disabled={!outfitItems.length || outfitItems.every((item) => item.lastWorn === todayIso)}
                onClick={() => logWear(outfitItems)}
              >
                <Check />{" "}
                {outfitItems.length && outfitItems.every((item) => item.lastWorn === todayIso)
                  ? "Worn today"
                  : "Wear this look today"}
              </button>
              <button
                disabled={!outfitItems.length}
                onClick={() =>
                  shareLook(
                    savedLooks.find((look) => look.id === canvasLookId)?.name ?? "My look",
                    outfitItems.map((item) => item.name).join(" · "),
                    outfitItems,
                  )
                }
              >
                <Share2 /> Share as image
              </button>
              {canvasLookId && savedLooks.some((look) => look.id === canvasLookId) ? (
                <>
                  <button className="primary" disabled={!outfitItems.length} onClick={updateCanvasLook}>
                    <Check /> Update “{savedLooks.find((look) => look.id === canvasLookId)?.name}”
                  </button>
                  <button disabled={!outfitItems.length} onClick={saveCurrentLook}>
                    <Plus /> Save as new look
                  </button>
                </>
              ) : (
                <button className="primary" disabled={!outfitItems.length} onClick={saveCurrentLook}>
                  <Heart /> Save this look
                </button>
              )}
            </aside>
          </div>
        ) : (
          <section className="saved-look-grid">
            {!savedLooks.length && (
              <div className="empty-state saved-empty">
                <Layers3 />
                <h2>No saved looks yet</h2>
                <p>Build an outfit on the canvas and save it to see it here.</p>
              </div>
            )}
            {savedLooks.map((look) => (
              <article className="look-card" key={look.id}>
                <button
                  className={`look-heart ${look.favorite ? "active" : ""}`}
                  aria-label={look.favorite ? `Unfavorite ${look.name}` : `Favorite ${look.name}`}
                  onClick={() => toggleLookFavorite(look)}
                >
                  <Heart fill={look.favorite ? "currentColor" : "none"} />
                </button>
                <button className="look-collage" onClick={() => loadLook(look)}>
                  {look.itemIds.slice(0, 4).map((id) => {
                    const item = items.find((piece) => sameId(piece.id, id));
                    return item ? <img key={id} src={item.thumb ?? item.image} alt={item.name} /> : null;
                  })}
                </button>
                <div>
                  <span>{look.occasion}</span>
                  <h2>{look.name}</h2>
                  <div className="look-actions">
                    <button onClick={() => loadLook(look)}>Edit look</button>
                    <button
                      aria-label={`Share ${look.name}`}
                      onClick={() =>
                        shareLook(
                          look.name,
                          look.occasion,
                          look.itemIds
                            .map((id) => items.find((piece) => sameId(piece.id, id)))
                            .filter((piece): piece is WardrobeItem => Boolean(piece)),
                        )
                      }
                    >
                      <Share2 />
                    </button>
                    <button aria-label={`Rename ${look.name}`} onClick={() => setEditingLook(look)}>
                      <Pencil />
                    </button>
                    <button className="danger" aria-label={`Delete ${look.name}`} onClick={() => deleteLook(look)}>
                      <Trash2 />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </TabsContent>
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="picker-sheet">
          <SheetTitle>Choose {slotDefs.find((slot) => slot.category === activeSlot)?.label.toLowerCase()}</SheetTitle>
          <SheetDescription className="sr-only">Pick a piece for this slot.</SheetDescription>
          {railItems.length ? (
            <ul>
              {railItems.map((item) => {
                const inLook = outfit.some((id) => sameId(id, item.id));
                return (
                  <li key={item.id}>
                    <button
                      className={inLook ? "active" : ""}
                      aria-pressed={inLook}
                      onClick={() => {
                        addToOutfit(item.id);
                        setPickerOpen(false);
                      }}
                    >
                      <img src={item.thumb ?? item.image} alt="" />
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.color}
                          {item.inLaundry ? " · in the wash" : ""}
                        </small>
                      </span>
                      {inLook && <Check />}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rail-empty">Nothing in this slot yet. Add a photo to grow it.</p>
          )}
          <button className="picker-done" onClick={() => setPickerOpen(false)}>
            Done
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}
