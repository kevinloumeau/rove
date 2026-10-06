"use client";

import { CalendarPlus, Heart, Pencil, Layers3, MoreHorizontal, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TabsContent } from "@/components/ui/tabs";
import { type WardrobeItem } from "@/lib/wardrobe-types";
import { sameId } from "@/lib/home-utils";
import { type HomeState } from "@/hooks/use-home";
import { LookBuilder } from "@/components/home/look-builder";

export function OutfitsTab({ home }: { home: HomeState }) {
  const {
    items,
    outfitMode,
    setOutfitMode,
    savedLooks,
    setEditingLook,
    deleteLook,
    shareLook,
    loadLook,
    toggleLookFavorite,
    startPlanningLook,
  } = home;
  return (
    <>
      <TabsContent value="outfits" className="outfit-view">
        <section className="outfit-intro">
          <div>
            <h1>
              Style a <em>look</em>
            </h1>
            <p>Stack pieces from your closet, shuffle for ideas, and save what works.</p>
          </div>
          <div className="view-switch" aria-label="Outfit view">
            <button className={outfitMode === "canvas" ? "active" : ""} onClick={() => setOutfitMode("canvas")}>
              Build
            </button>
            <button className={outfitMode === "saved" ? "active" : ""} onClick={() => setOutfitMode("saved")}>
              Saved looks <span>{savedLooks.length}</span>
            </button>
          </div>
        </section>
        {outfitMode === "canvas" ? (
          <LookBuilder home={home} />
        ) : (
          <section className="saved-look-grid">
            {!savedLooks.length && (
              <div className="empty-state saved-empty">
                <span className="empty-emoji" aria-hidden>
                  ✨
                </span>
                <h2>No saved looks yet</h2>
                <p>Build an outfit and save it to see it here.</p>
              </div>
            )}
            {savedLooks.map((look) => {
              const pieces = look.itemIds
                .map((id) => items.find((piece) => sameId(piece.id, id)))
                .filter((piece): piece is WardrobeItem => Boolean(piece));
              return (
                <article className="look-card" key={look.id}>
                  <button
                    className={`look-heart ${look.favorite ? "active" : ""}`}
                    aria-label={look.favorite ? `Unfavorite ${look.name}` : `Favorite ${look.name}`}
                    onClick={() => toggleLookFavorite(look)}
                  >
                    <Heart fill={look.favorite ? "currentColor" : "none"} />
                  </button>
                  <button
                    className="look-collage"
                    data-count={Math.min(pieces.length, 4)}
                    aria-label={`Open ${look.name}`}
                    onClick={() => loadLook(look)}
                  >
                    {pieces.slice(0, 4).map((item) => (
                      <img
                        key={item.id}
                        src={item.thumb ?? item.image}
                        alt=""
                        width={480}
                        height={480}
                        loading="lazy"
                        decoding="async"
                      />
                    ))}
                  </button>
                  <div className="look-card-body">
                    <h2>{look.name}</h2>
                    <p>
                      {look.occasion} · {pieces.length} {pieces.length === 1 ? "piece" : "pieces"}
                    </p>
                    <div className="look-card-actions">
                      <Button variant="outline" className="look-edit" onClick={() => loadLook(look)}>
                        <Pencil /> Edit
                      </Button>
                      <Button variant="outline" onClick={() => startPlanningLook(look)}>
                        <CalendarPlus /> Plan
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" aria-label={`More for ${look.name}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="phone-menu-only" onSelect={() => loadLook(look)}>
                            <Layers3 /> Edit look
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => shareLook(look.name, look.occasion, pieces)}>
                            <Share2 /> Share as image
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setEditingLook(look)}>
                            <Pencil /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => deleteLook(look)}>
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </TabsContent>
    </>
  );
}
