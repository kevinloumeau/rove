"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { lookOccasions, pieceCategories, seasons, type SavedLook, type WardrobeItem } from "@/lib/wardrobe-types";

export type PieceChanges = Pick<WardrobeItem, "name" | "category" | "color" | "season" | "description"> & {
  brand: string;
  size: string;
  notes: string;
  price: number | null;
};
type LookChanges = Pick<SavedLook, "name" | "occasion">;

function withCurrent(options: string[], current: string) {
  return options.includes(current) ? options : [current, ...options];
}

export function EditPieceDialog({
  item,
  onOpenChange,
  onSave,
}: {
  item: WardrobeItem | null;
  onOpenChange: (open: boolean) => void;
  onSave: (changes: PieceChanges) => Promise<void>;
}) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="edit-dialog">
        {item && <PieceForm key={String(item.id)} item={item} onCancel={() => onOpenChange(false)} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}

function PieceForm({
  item,
  onCancel,
  onSave,
}: {
  item: WardrobeItem;
  onCancel: () => void;
  onSave: (changes: PieceChanges) => Promise<void>;
}) {
  const [draft, setDraft] = useState<PieceChanges>({
    name: item.name,
    category: item.category,
    color: item.color,
    season: item.season,
    description: item.description,
    brand: item.brand ?? "",
    size: item.size ?? "",
    notes: item.notes ?? "",
    price: item.price ?? null,
  });
  const [priceText, setPriceText] = useState(item.price == null ? "" : String(item.price));
  const [saving, setSaving] = useState(false);
  const set = (key: Exclude<keyof PieceChanges, "price">) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const parsedPrice = priceText.trim() === "" ? null : Number(priceText.replace(",", "."));
  const priceValid =
    parsedPrice === null || (Number.isFinite(parsedPrice) && parsedPrice >= 0 && parsedPrice < 1_000_000);

  return (
    <form
      aria-busy={saving}
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await onSave({
            ...draft,
            name: draft.name.trim(),
            color: draft.color.trim(),
            brand: draft.brand.trim(),
            size: draft.size.trim(),
            notes: draft.notes.trim(),
            price: parsedPrice === null ? null : Math.round(parsedPrice * 100) / 100,
          });
        } finally {
          setSaving(false);
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>Edit piece</DialogTitle>
        <DialogDescription>Fix anything the photo import got wrong.</DialogDescription>
      </DialogHeader>
      <div className="edit-fields">
        <label>
          Name
          <Input required maxLength={120} value={draft.name} onChange={(event) => set("name")(event.target.value)} />
        </label>
        <div className="edit-row">
          <label>
            Category
            <select value={draft.category} onChange={(event) => set("category")(event.target.value)}>
              {withCurrent(pieceCategories, item.category).map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            Season
            <select value={draft.season} onChange={(event) => set("season")(event.target.value)}>
              {withCurrent(seasons, item.season).map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Color
          <Input required maxLength={80} value={draft.color} onChange={(event) => set("color")(event.target.value)} />
        </label>
        <div className="edit-row">
          <label>
            Brand
            <Input maxLength={80} value={draft.brand} onChange={(event) => set("brand")(event.target.value)} />
          </label>
          <label>
            Size
            <Input maxLength={40} value={draft.size} onChange={(event) => set("size")(event.target.value)} />
          </label>
        </div>
        <label>
          Price paid
          <Input
            inputMode="decimal"
            placeholder="Optional, used for cost per wear"
            value={priceText}
            aria-invalid={!priceValid}
            onChange={(event) => setPriceText(event.target.value)}
          />
        </label>
        <label>
          Description
          <Textarea
            maxLength={600}
            value={draft.description}
            onChange={(event) => set("description")(event.target.value)}
          />
        </label>
        <label>
          Notes
          <Textarea
            maxLength={1000}
            placeholder="Care instructions, where you bought it, how it fits…"
            value={draft.notes}
            onChange={(event) => set("notes")(event.target.value)}
          />
        </label>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !draft.name.trim() || !draft.color.trim() || !priceValid}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditLookDialog({
  look,
  onOpenChange,
  onSave,
}: {
  look: SavedLook | null;
  onOpenChange: (open: boolean) => void;
  onSave: (changes: LookChanges) => Promise<void>;
}) {
  return (
    <Dialog open={Boolean(look)} onOpenChange={onOpenChange}>
      <DialogContent className="edit-dialog">
        {look && <LookForm key={look.id} look={look} onCancel={() => onOpenChange(false)} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}

function LookForm({
  look,
  onCancel,
  onSave,
}: {
  look: SavedLook;
  onCancel: () => void;
  onSave: (changes: LookChanges) => Promise<void>;
}) {
  const [name, setName] = useState(look.name);
  const [occasion, setOccasion] = useState(look.occasion);
  const [saving, setSaving] = useState(false);

  return (
    <form
      aria-busy={saving}
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await onSave({ name: name.trim(), occasion });
        } finally {
          setSaving(false);
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>Rename look</DialogTitle>
        <DialogDescription>Give it a name and an occasion so it&apos;s easy to plan.</DialogDescription>
      </DialogHeader>
      <div className="edit-fields">
        <label>
          Name
          <Input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Occasion
          <select value={occasion} onChange={(event) => setOccasion(event.target.value)}>
            {withCurrent(lookOccasions, look.occasion).map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ConfirmDeleteDialog({
  open,
  title,
  description,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
