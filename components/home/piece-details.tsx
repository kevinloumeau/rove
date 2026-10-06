"use client";

import { Camera, Check, HandHeart, Package, Pencil, Plus, Scissors, Trash2, WashingMachine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { costPerWear, formatMoney } from "@/lib/closet-stats";
import { letGoLabels, letGoReasons } from "@/lib/declutter";
import { type HomeState } from "@/hooks/use-home";

export function PieceDetails({ home }: { home: HomeState }) {
  const {
    setActiveTab,
    setDetailSheetOpen,
    setFixingItem,
    setStudioItem,
    setEditingItem,
    addToOutfit,
    selected,
    todayIso,
    toggleLaundry,
    logWear,
    unlogWearToday,
    deletePieces,
    pile,
    toggleStored,
  } = home;
  if (!selected) return null;
  return (
    <>
      <div className="detail-image">
        {/* The 480px WebP thumbnail is sharp at this size; the full cutout stays for editing and sharing. */}
        <img src={selected.thumb ?? selected.image} alt={selected.name} width={480} height={480} decoding="async" />
      </div>
      <div className="detail-copy">
        <p>{selected.category}</p>
        <h2>{selected.name}</h2>
        <span>{selected.description}</span>
      </div>
      <dl>
        <div>
          <dt>Color</dt>
          <dd>{selected.color}</dd>
        </div>
        <div>
          <dt>Season</dt>
          <dd>{selected.season}</dd>
        </div>
        {selected.brand ? (
          <div>
            <dt>Brand</dt>
            <dd>{selected.brand}</dd>
          </div>
        ) : null}
        {selected.size ? (
          <div>
            <dt>Size</dt>
            <dd>{selected.size}</dd>
          </div>
        ) : null}
        <div>
          <dt>Worn</dt>
          <dd>
            {selected.wearCount ? `${selected.wearCount} ${selected.wearCount === 1 ? "time" : "times"}` : "Not yet"}
          </dd>
        </div>
        {selected.price ? (
          <div>
            <dt>Cost per wear</dt>
            <dd>{formatMoney(costPerWear(selected.price, selected.wearCount) ?? 0)}</dd>
          </div>
        ) : null}
      </dl>
      {selected.notes ? <p className="detail-notes">{selected.notes}</p> : null}
      <div className="wear-actions">
        <Button
          variant={selected.lastWorn === todayIso ? "secondary" : "outline"}
          aria-pressed={selected.lastWorn === todayIso}
          onClick={() => (selected.lastWorn === todayIso ? unlogWearToday(selected) : logWear([selected]))}
        >
          <Check /> {selected.lastWorn === todayIso ? "Worn today" : "Wore it today"}
        </Button>
        <Button
          variant={selected.inLaundry ? "secondary" : "outline"}
          aria-pressed={Boolean(selected.inLaundry)}
          onClick={() => toggleLaundry(selected)}
        >
          <WashingMachine /> {selected.inLaundry ? "In the wash" : "Mark in wash"}
        </Button>
      </div>
      {selected.lastWorn && selected.lastWorn !== todayIso ? (
        <p className="detail-last-worn">
          Last worn{" "}
          {new Date(`${selected.lastWorn}T00:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}
        </p>
      ) : null}
      {selected.tags?.length ? (
        <ul className="detail-tags" aria-label="Tags">
          {selected.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      ) : null}
      <Button
        className="outfit-button"
        onClick={() => {
          setDetailSheetOpen(false);
          addToOutfit(selected.id);
          setActiveTab("outfits");
        }}
      >
        <Plus /> Style this piece
      </Button>
      <div className="detail-actions">
        <Button
          variant="outline"
          onClick={() => {
            setDetailSheetOpen(false);
            setEditingItem(selected);
          }}
        >
          <Pencil /> Edit
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setDetailSheetOpen(false);
            setFixingItem(selected);
          }}
        >
          <Scissors /> Fix cutout
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setDetailSheetOpen(false);
            setStudioItem(selected);
          }}
        >
          <Camera /> Studio photo
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <HandHeart /> Let go
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {letGoReasons.map((reason) => (
              <DropdownMenuItem
                key={reason}
                onSelect={() => {
                  setDetailSheetOpen(false);
                  pile.letGo([selected], reason);
                }}
              >
                {letGoLabels[reason]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" aria-pressed={Boolean(selected.storedAt)} onClick={() => toggleStored([selected])}>
          <Package /> {selected.storedAt ? "Bring back" : "Pack away"}
        </Button>
        <Button
          variant="outline"
          className="danger"
          onClick={() => {
            setDetailSheetOpen(false);
            deletePieces([selected]);
          }}
        >
          <Trash2 /> Delete
        </Button>
      </div>
    </>
  );
}
