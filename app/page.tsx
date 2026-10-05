"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  CalendarDays,
  Check,
  ArrowUpDown,
  Camera,
  ChartColumn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  Heart,
  Pencil,
  Layers3,
  Plus,
  ScanSearch,
  Search,
  Share2,
  Shirt,
  Shuffle,
  Sparkles,
  Trash2,
  WandSparkles,
  WashingMachine,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { EditLookDialog, EditPieceDialog, type PieceChanges } from "@/components/closet-dialogs";
import { ClosetInsights } from "@/components/closet-insights";
import { OutfitOfTheDay } from "@/components/outfit-of-the-day";
import { costPerWear, formatMoney } from "@/lib/closet-stats";
import { colorSwatch, processWardrobeImage } from "@/lib/local-wardrobe";
import { suggestLook } from "@/lib/outfit-shuffle";
import { photoHash, shrinkPhoto } from "@/lib/photo-resize";
import { renderLookImage, shareLookImage } from "@/lib/share-look";
import { pieceCategories, seasons, type SavedLook, type WardrobeItem } from "@/lib/wardrobe-types";

const categories = ["All", "Tops", "Bottoms", "Outerwear", "Dresses", "Shoes", "Accessories", "Other", "Favorites"];
const occasions = ["All", "Casual", "Work", "Dinner", "Event"];
const slotDefs = [
  { label: "Layer", category: "Outerwear" },
  { label: "Top", category: "Tops" },
  { label: "Bottom", category: "Bottoms" },
  { label: "Shoes", category: "Shoes" },
  { label: "Extras", category: "Accessories" },
];
// Dresses fill the top slot; anything uncategorized rides along as an extra.
function slotFor(category: string) {
  if (category === "Dresses") return "Tops";
  if (category === "Other") return "Accessories";
  return category;
}

async function sendJson(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(payload.error || "Rove could not complete that request.");
  return payload;
}
function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function monthKey(date: Date) {
  return isoDate(date).slice(0, 7);
}
function sameId(a: number | string, b: number | string) {
  return String(a) === String(b);
}

type DuplicateMatch = { id: string; name: string; image: string };
/** How long a delete can be undone before it is sent to the server. */
const UNDO_MS = 6000;

function isNarrow(maxWidth: number) {
  return typeof window !== "undefined" && window.matchMedia(`(max-width: ${maxWidth}px)`).matches;
}

/** Scrolls an element into view after React has rendered the change that revealed it. */
function scrollIntoViewSoon(element: HTMLElement | null) {
  requestAnimationFrame(() => element?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

export default function Home() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [closetStatus, setClosetStatus] = useState<"loading" | "ready" | "error">("loading");
  const [closetError, setClosetError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("closet");
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("Recently added");
  const [colorFilter, setColorFilter] = useState("All colors");
  const [seasonFilter, setSeasonFilter] = useState("All seasons");
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const pendingDeletes = useRef(new Map<string, { timer: number; urls: string[] }>());
  const [selectedId, setSelectedId] = useState<number | string | null>(null);
  const [outfit, setOutfit] = useState<Array<number | string>>([]);
  const [activeSlot, setActiveSlot] = useState("Tops");
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const dayPanelRef = useRef<HTMLElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [outfitMode, setOutfitMode] = useState<"canvas" | "saved">("canvas");
  const [savedLooks, setSavedLooks] = useState<SavedLook[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [occasionFilter, setOccasionFilter] = useState("All");
  const [plans, setPlans] = useState<Record<string, string>>({});
  const [planLookId, setPlanLookId] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState("auto");
  const [detectedItems, setDetectedItems] = useState<WardrobeItem[]>([]);
  const [selectedExtractions, setSelectedExtractions] = useState<string[]>([]);
  const [activeImportId, setActiveImportId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);
  const [editingLook, setEditingLook] = useState<SavedLook | null>(null);
  const [canvasLookId, setCanvasLookId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/wardrobe", { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as { items?: WardrobeItem[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Your closet could not be loaded. Try again.");
        const loaded = payload.items ?? [];
        setItems(loaded);
        setSelectedId(loaded[0]?.id ?? null);
        setClosetStatus("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setClosetError(error instanceof Error ? error.message : "Your closet could not be loaded. Try again.");
        setClosetStatus("error");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/outfits", { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ looks?: SavedLook[] }>) : null))
      .then((payload) => {
        const looks = payload?.looks ?? [];
        setSavedLooks(looks);
        setPlanLookId((current) => current || looks[0]?.id || "");
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    // A delete still in its undo window is sent anyway if the page is closed.
    const pending = pendingDeletes.current;
    const flush = () => {
      for (const { timer, urls } of pending.values()) {
        window.clearTimeout(timer);
        for (const url of urls) void fetch(url, { method: "DELETE", keepalive: true });
      }
      pending.clear();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const visibleMonth = monthKey(calendarMonth);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/plans?month=${visibleMonth}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ plans?: Record<string, string> }>) : null))
      .then((payload) => {
        if (payload?.plans) setPlans((current) => ({ ...current, ...payload.plans }));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [visibleMonth]);

  const addToOutfit = useCallback(
    (id: number | string) => {
      const item = items.find((piece) => sameId(piece.id, id));
      if (!item) return;
      const slotCategory = slotFor(item.category);
      setOutfit((current) => [
        ...current.filter((pieceId) => {
          const piece = items.find((candidate) => sameId(candidate.id, pieceId));
          return piece && slotFor(piece.category) !== slotCategory;
        }),
        item.id,
      ]);
    },
    [items],
  );

  useEffect(() => {
    const modelContext = (
      document as Document & {
        modelContext?: { registerTool?: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> };
      }
    ).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: unknown) => {
      try {
        void Promise.resolve(modelContext.registerTool?.(tool, { signal: lifecycle.signal })).catch(() => undefined);
      } catch {
        /* unsupported preview */
      }
    };
    register({
      name: "filter_closet",
      title: "Filter closet",
      description: "Show wardrobe pieces matching a category and optional search query.",
      inputSchema: {
        type: "object",
        properties: { category: { type: "string", enum: categories }, query: { type: "string" } },
        required: ["category"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const value = input as { category?: string; query?: string };
        if (!value.category || !categories.includes(value.category)) throw new Error("Choose a valid closet category.");
        setActiveCategory(value.category);
        setQuery(value.query ?? "");
        setActiveTab("closet");
        return { category: value.category, query: value.query ?? "" };
      },
    });
    register({
      name: "add_piece_to_outfit",
      title: "Add piece to outfit",
      description: "Add one wardrobe piece to the current visual outfit using its item ID.",
      inputSchema: {
        type: "object",
        properties: { itemId: { anyOf: [{ type: "number" }, { type: "string" }] } },
        required: ["itemId"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const itemId = (input as { itemId?: number | string }).itemId;
        const item = items.find((piece) => String(piece.id) === String(itemId));
        if (!item) throw new Error("That wardrobe piece was not found.");
        addToOutfit(item.id);
        setActiveTab("outfits");
        return { itemId: item.id, added: true };
      },
    });
    return () => lifecycle.abort();
  }, [items, addToOutfit]);

  const closetColors = useMemo(() => [...new Set(items.map((item) => item.color))].sort(), [items]);
  const visibleItems = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    let next = items.filter((item) => {
      if (
        activeCategory !== "All" &&
        item.category !== activeCategory &&
        !(activeCategory === "Favorites" && item.favorite)
      )
        return false;
      if (colorFilter !== "All colors" && item.color !== colorFilter) return false;
      if (seasonFilter !== "All seasons" && item.season !== seasonFilter && item.season !== "All season") return false;
      const haystack =
        `${item.name} ${item.category} ${item.color} ${item.season} ${item.brand ?? ""} ${(item.tags ?? []).join(" ")}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
    if (sort === "A–Z") next = [...next].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "Color") next = [...next].sort((a, b) => a.color.localeCompare(b.color));
    if (sort === "Most worn") next = [...next].sort((a, b) => (b.wearCount ?? 0) - (a.wearCount ?? 0));
    if (sort === "Least worn") next = [...next].sort((a, b) => (a.wearCount ?? 0) - (b.wearCount ?? 0));
    return next;
  }, [activeCategory, colorFilter, items, query, seasonFilter, sort]);
  const filtersActive = colorFilter !== "All colors" || seasonFilter !== "All seasons";
  const selected = items.find((item) => selectedId !== null && sameId(item.id, selectedId)) ?? items[0];
  const railItems = items.filter((item) => slotFor(item.category) === activeSlot);
  const outfitItems = outfit
    .map((id) => items.find((item) => sameId(item.id, id)))
    .filter((item): item is WardrobeItem => Boolean(item));
  const outfitColors = [...new Set(outfitItems.map((item) => item.color))];
  const filteredLooks = savedLooks.filter((look) => occasionFilter === "All" || look.occasion === occasionFilter);
  const plannedLook = savedLooks.find((look) => look.id === plans[selectedDate]);
  const lookToPlan = filteredLooks.some((look) => look.id === planLookId) ? planLookId : (filteredLooks[0]?.id ?? "");
  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();
  const leadingBlanks = new Date(calendarYear, calendarMonthIndex, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();
  const monthDates = Array.from({ length: daysInMonth }, (_, index) =>
    isoDate(new Date(calendarYear, calendarMonthIndex, index + 1)),
  );
  const plannedThisMonth = monthDates.filter((date) => savedLooks.some((look) => look.id === plans[date])).length;
  const todayIso = isoDate(new Date());
  const selectedDateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });

  function updateItem(id: number | string, changes: Partial<WardrobeItem>) {
    setItems((current) => current.map((piece) => (sameId(piece.id, id) ? { ...piece, ...changes } : piece)));
  }
  function toggleFavorite(id: number | string) {
    const item = items.find((piece) => sameId(piece.id, id));
    if (!item) return;
    const favorite = !item.favorite;
    updateItem(id, { favorite });
    sendJson("/api/wardrobe", "PATCH", { id, favorite }).catch((error: unknown) => {
      updateItem(id, { favorite: !favorite });
      toast.error(errorMessage(error, "That favorite could not be saved."));
    });
  }
  function toggleLaundry(item: WardrobeItem) {
    const inLaundry = !item.inLaundry;
    updateItem(item.id, { inLaundry });
    sendJson("/api/wardrobe", "PATCH", { id: item.id, inLaundry }).catch((error: unknown) => {
      updateItem(item.id, { inLaundry: !inLaundry });
      toast.error(errorMessage(error, "That change could not be saved."));
    });
  }
  /** Logs today's wear for each piece; pieces already logged today are left alone. */
  function logWear(pieces: WardrobeItem[]) {
    const fresh = pieces.filter((piece) => piece.lastWorn !== todayIso);
    if (!fresh.length) {
      toast("Already logged for today");
      return;
    }
    const before = new Map(fresh.map((piece) => [String(piece.id), piece]));
    for (const piece of fresh) updateItem(piece.id, { wearCount: (piece.wearCount ?? 0) + 1, lastWorn: todayIso });
    sendJson("/api/wears", "POST", { itemIds: fresh.map((piece) => String(piece.id)), date: todayIso })
      .then(() => toast.success(fresh.length === 1 ? `Logged ${fresh[0].name}` : `Logged ${fresh.length} pieces`))
      .catch((error: unknown) => {
        for (const [, piece] of before) updateItem(piece.id, { wearCount: piece.wearCount, lastWorn: piece.lastWorn });
        toast.error(errorMessage(error, "That wear could not be logged."));
      });
  }
  function unlogWearToday(item: WardrobeItem) {
    const previous = { wearCount: item.wearCount, lastWorn: item.lastWorn };
    updateItem(item.id, { wearCount: Math.max(0, (item.wearCount ?? 1) - 1) });
    sendJson(`/api/wears?itemId=${encodeURIComponent(String(item.id))}&date=${todayIso}`, "DELETE")
      .then((payload) => {
        const result = payload as { wearCount?: number; lastWorn?: string | null };
        updateItem(item.id, { wearCount: result.wearCount ?? 0, lastWorn: result.lastWorn ?? null });
      })
      .catch((error: unknown) => {
        updateItem(item.id, previous);
        toast.error(errorMessage(error, "That wear could not be removed."));
      });
  }
  async function savePieceEdits(changes: PieceChanges) {
    if (!editingItem) return;
    try {
      await sendJson("/api/wardrobe", "PATCH", { id: editingItem.id, ...changes });
      updateItem(editingItem.id, changes);
      setEditingItem(null);
      toast.success("Piece updated");
    } catch (error) {
      toast.error(errorMessage(error, "Those changes could not be saved."));
    }
  }
  /** Waits out the undo window, then sends the deletes. Undo cancels them and restores the UI. */
  function deferDelete(label: string, urls: string[], restore: () => void, failure: string) {
    const key = crypto.randomUUID();
    const timer = window.setTimeout(() => {
      pendingDeletes.current.delete(key);
      Promise.all(urls.map((url) => sendJson(url, "DELETE"))).catch((error: unknown) => {
        restore();
        toast.error(errorMessage(error, failure));
      });
    }, UNDO_MS);
    pendingDeletes.current.set(key, { timer, urls });
    toast(label, {
      duration: UNDO_MS,
      action: {
        label: "Undo",
        onClick: () => {
          window.clearTimeout(timer);
          pendingDeletes.current.delete(key);
          restore();
        },
      },
    });
  }
  function deletePieces(doomed: WardrobeItem[]) {
    if (!doomed.length) return;
    const doomedIds = new Set(doomed.map((item) => String(item.id)));
    const positions = doomed
      .map((item) => ({ item, index: items.findIndex((piece) => sameId(piece.id, item.id)) }))
      .filter(({ index }) => index >= 0)
      .sort((a, b) => a.index - b.index);
    const outfitSnapshot = outfit;
    const lookItemIds = new Map(savedLooks.map((look) => [look.id, look.itemIds]));
    setItems((current) => current.filter((piece) => !doomedIds.has(String(piece.id))));
    setOutfit((current) => current.filter((id) => !doomedIds.has(String(id))));
    setSavedLooks((current) =>
      current.map((look) => ({ ...look, itemIds: look.itemIds.filter((id) => !doomedIds.has(String(id))) })),
    );
    if (selectedId !== null && doomedIds.has(String(selectedId))) setSelectedId(null);
    deferDelete(
      doomed.length === 1 ? `Deleted ${doomed[0].name}` : `Deleted ${doomed.length} pieces`,
      doomed.map((item) => `/api/wardrobe?id=${encodeURIComponent(String(item.id))}`),
      () => {
        // Put each piece back at its old position, lowest first so later positions stay right.
        setItems((current) => {
          const next = current.filter((piece) => !doomedIds.has(String(piece.id)));
          for (const { item, index } of positions) next.splice(Math.min(index, next.length), 0, item);
          return next;
        });
        setOutfit((current) => (current.length ? current : outfitSnapshot));
        setSavedLooks((current) =>
          current.map((look) => ({ ...look, itemIds: lookItemIds.get(look.id) ?? look.itemIds })),
        );
      },
      doomed.length === 1 ? "That piece could not be deleted." : "Those pieces could not be deleted.",
    );
  }
  function togglePicked(id: number | string) {
    const key = String(id);
    setPicked((current) => (current.includes(key) ? current.filter((value) => value !== key) : [...current, key]));
  }
  function endSelecting() {
    setSelecting(false);
    setPicked([]);
  }
  function bulkUpdate(changes: Partial<Pick<WardrobeItem, "category" | "season" | "favorite" | "inLaundry">>) {
    const ids = picked;
    if (!ids.length) return;
    const before = new Map(
      items.filter((item) => ids.includes(String(item.id))).map((item) => [String(item.id), item]),
    );
    setItems((current) => current.map((item) => (ids.includes(String(item.id)) ? { ...item, ...changes } : item)));
    sendJson("/api/wardrobe", "PATCH", { ids, ...changes })
      .then(() => toast.success(`Updated ${ids.length} ${ids.length === 1 ? "piece" : "pieces"}`))
      .catch((error: unknown) => {
        setItems((current) => current.map((item) => before.get(String(item.id)) ?? item));
        toast.error(errorMessage(error, "Those changes could not be saved."));
      });
  }
  async function saveLookEdits(changes: Pick<SavedLook, "name" | "occasion">) {
    if (!editingLook) return;
    try {
      await sendJson("/api/outfits", "PATCH", { id: editingLook.id, ...changes });
      setSavedLooks((current) => current.map((look) => (look.id === editingLook.id ? { ...look, ...changes } : look)));
      setEditingLook(null);
    } catch (error) {
      toast.error(errorMessage(error, "Those changes could not be saved."));
    }
  }
  function deleteLook(look: SavedLook) {
    const index = savedLooks.findIndex((candidate) => candidate.id === look.id);
    const removedPlans = Object.entries(plans).filter(([, outfitId]) => outfitId === look.id);
    const wasOnCanvas = canvasLookId === look.id;
    setSavedLooks((current) => current.filter((candidate) => candidate.id !== look.id));
    setPlans((current) => Object.fromEntries(Object.entries(current).filter(([, outfitId]) => outfitId !== look.id)));
    if (wasOnCanvas) setCanvasLookId(null);
    deferDelete(
      `Deleted ${look.name}`,
      [`/api/outfits?id=${encodeURIComponent(look.id)}`],
      () => {
        setSavedLooks((current) => {
          const next = [...current];
          next.splice(Math.max(0, index), 0, look);
          return next;
        });
        setPlans((current) => ({ ...current, ...Object.fromEntries(removedPlans) }));
        if (wasOnCanvas) setCanvasLookId(look.id);
      },
      "That look could not be deleted.",
    );
  }
  function updateCanvasLook() {
    const look = savedLooks.find((candidate) => candidate.id === canvasLookId);
    if (!look || !outfitItems.length) return;
    const itemIds = outfitItems.map((item) => item.id);
    const previous = look.itemIds;
    const setIds = (ids: Array<number | string>) =>
      setSavedLooks((current) =>
        current.map((candidate) => (candidate.id === look.id ? { ...candidate, itemIds: ids } : candidate)),
      );
    setIds(itemIds);
    sendJson("/api/outfits", "PATCH", { id: look.id, itemIds })
      .then(() => toast.success(`Updated ${look.name}`))
      .catch((error: unknown) => {
        setIds(previous);
        toast.error(errorMessage(error, "That look could not be updated."));
      });
  }
  function shuffleLook() {
    // Color- and season-aware, skips the wash, and avoids repeating the look already on the canvas.
    const look = suggestLook(items, { today: todayIso, current: outfit });
    if (!look.length) {
      toast("Add a top or a dress to get outfit ideas.");
      return;
    }
    setOutfit(look.map((item) => item.id));
  }
  async function shareLook(name: string, subtitle: string, pieces: WardrobeItem[]) {
    if (!pieces.length) return;
    try {
      const blob = await renderLookImage(
        name,
        subtitle,
        pieces.map((piece) => piece.image),
      );
      const fileName = `${
        name
          .replace(/[^\w-]+/g, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase() || "look"
      }.png`;
      const result = await shareLookImage(blob, fileName, name);
      if (result === "downloaded") toast.success("Saved the look as an image");
    } catch (error) {
      toast.error(errorMessage(error, "That look could not be shared."));
    }
  }
  function saveCurrentLook() {
    if (!outfitItems.length) return;
    const id = crypto.randomUUID();
    const next: SavedLook = {
      id,
      name: `Look ${String(savedLooks.length + 1).padStart(2, "0")}`,
      itemIds: outfitItems.map((item) => item.id),
      occasion: "Casual",
    };
    setSavedLooks((current) => [next, ...current]);
    setPlanLookId(id);
    setCanvasLookId(id);
    setOutfitMode("saved");
    sendJson("/api/outfits", "POST", next).catch((error: unknown) => {
      setSavedLooks((current) => current.filter((look) => look.id !== id));
      setPlanLookId((current) => (current === id ? "" : current));
      toast.error(errorMessage(error, "That look could not be saved."));
    });
  }
  function loadLook(look: SavedLook) {
    setOutfit(look.itemIds);
    setCanvasLookId(look.id);
    setOutfitMode("canvas");
    setActiveTab("outfits");
  }
  function toggleLookFavorite(look: SavedLook) {
    const favorite = !look.favorite;
    const setFavorite = (value: boolean) =>
      setSavedLooks((current) =>
        current.map((candidate) => (candidate.id === look.id ? { ...candidate, favorite: value } : candidate)),
      );
    setFavorite(favorite);
    sendJson("/api/outfits", "PATCH", { id: look.id, favorite }).catch((error: unknown) => {
      setFavorite(!favorite);
      toast.error(errorMessage(error, "That favorite could not be saved."));
    });
  }
  function setPlan(date: string, outfitId: string | undefined) {
    setPlans((current) => {
      const next = { ...current };
      if (outfitId) next[date] = outfitId;
      else delete next[date];
      return next;
    });
  }
  function planSelectedLook() {
    if (!lookToPlan) return;
    const date = selectedDate;
    const previous = plans[date];
    setPlan(date, lookToPlan);
    sendJson("/api/plans", "POST", { date, outfitId: lookToPlan }).catch((error: unknown) => {
      setPlan(date, previous);
      toast.error(errorMessage(error, "That day could not be planned."));
    });
  }
  function removePlan() {
    const date = selectedDate;
    const previous = plans[date];
    setPlan(date, undefined);
    sendJson(`/api/plans?date=${date}`, "DELETE").catch((error: unknown) => {
      setPlan(date, previous);
      toast.error(errorMessage(error, "That plan could not be removed."));
    });
  }
  function shiftMonth(offset: number) {
    const next = new Date(calendarYear, calendarMonthIndex + offset, 1);
    setCalendarMonth(next);
    setSelectedDate(monthKey(next) === todayIso.slice(0, 7) ? todayIso : isoDate(next));
  }

  async function handleFile(picked?: File) {
    if (!picked) return;
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(picked.type)) {
      setImportError("Use a JPEG, PNG, or WebP image.");
      return;
    }
    // Phone photos are often 4000px+; a smaller copy segments faster and uploads quicker.
    const file = await shrinkPhoto(picked);
    if (file.size > 12 * 1024 * 1024) {
      setImportError("Choose an image smaller than 12 MB.");
      return;
    }
    const imageUrl = URL.createObjectURL(file);
    setPreview(imageUrl);
    setProcessed(false);
    setIsProcessing(true);
    setUploadMode("auto");
    setDetectedItems([]);
    setSelectedExtractions([]);
    setActiveImportId(null);
    setImportError(null);
    setImportNotice(null);
    setDuplicateMatches([]);
    const hash = await photoHash(file);
    if (hash)
      void fetch(`/api/wardrobe/duplicates?hash=${hash}`)
        .then((response) => (response.ok ? (response.json() as Promise<{ matches?: DuplicateMatch[] }>) : null))
        .then((payload) => setDuplicateMatches(payload?.matches ?? []))
        .catch(() => undefined);
    try {
      const garments = await processWardrobeImage(file, setImportNotice);
      const form = new FormData();
      form.set("image", file);
      if (hash) form.set("photoHash", hash);
      form.set(
        "manifest",
        JSON.stringify(
          garments.map((garment) => ({
            name: garment.name,
            category: garment.category,
            color: garment.color,
            season: garment.season,
            description: garment.description,
            tags: garment.tags,
          })),
        ),
      );
      garments.forEach((garment, index) =>
        form.set(`cutout-${index}`, new File([garment.image], `cutout-${index}.png`, { type: "image/png" })),
      );
      setImportNotice("Saving the privately processed pieces…");
      const response = await fetch("/api/wardrobe/import", { method: "POST", body: form });
      const payload = (await response.json()) as {
        importId?: string;
        items?: WardrobeItem[];
        localProcessing?: boolean;
        cleanedCount?: number;
        error?: string;
      };
      if (!response.ok || !payload.importId || !payload.items?.length)
        throw new Error(payload.error || "Rove could not save that photo.");
      setActiveImportId(payload.importId);
      setDetectedItems(payload.items);
      setSelectedExtractions(payload.items.map((item) => String(item.id)));
      setUploadMode(payload.items.length > 1 ? "look" : "single");
      setImportNotice(
        (payload.cleanedCount ?? 0) === payload.items.length
          ? "Processed privately on this device—no paid API used."
          : "Processed on this device. Rove kept the original photo for any piece that could not be cleanly separated.",
      );
      setProcessed(true);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Rove could not analyze that photo. Try another image.");
    } finally {
      setIsProcessing(false);
    }
  }
  async function saveUploadedItem() {
    if (!activeImportId || !detectedItems.length) return;
    const itemIds = uploadMode === "look" ? selectedExtractions : [String(detectedItems[0].id)];
    if (!itemIds.length) return;
    setIsSavingImport(true);
    setImportError(null);
    try {
      const response = await fetch("/api/wardrobe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ importId: activeImportId, itemIds }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Those pieces could not be added.");
      const additions = detectedItems.filter((item) => itemIds.includes(String(item.id)));
      setItems((current) => [...additions, ...current]);
      setSelectedId(additions[0].id);
      setDialogOpen(false);
      setPreview(null);
      setProcessed(false);
      setDetectedItems([]);
      setActiveImportId(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Those pieces could not be added. Try again.");
    } finally {
      setIsSavingImport(false);
    }
  }

  const pieceDetails = selected ? (
    <>
      <div className="detail-image">
        <img src={selected.image} alt={selected.name} />
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
  ) : null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Rove closet home">
          <span className="brand-mark">
            <Shirt />
          </span>
          <span>Rove</span>
        </a>
        <p className="closet-count">
          <span>{items.length}</span> {items.length === 1 ? "piece" : "pieces"} · <span>{savedLooks.length}</span>{" "}
          {savedLooks.length === 1 ? "saved look" : "saved looks"}
        </p>
        <UploadDialog
          {...{
            dialogOpen,
            setDialogOpen,
            preview,
            setPreview,
            processed,
            setProcessed,
            isProcessing,
            setIsProcessing,
            uploadMode,
            setUploadMode,
            detectedItems,
            setDetectedItems,
            selectedExtractions,
            setSelectedExtractions,
            setActiveImportId,
            importError,
            setImportError,
            importNotice,
            setImportNotice,
            isSavingImport,
            duplicateMatches,
            setDuplicateMatches,
            fileRef,
            cameraRef,
            handleFile,
            saveUploadedItem,
          }}
        />
      </header>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="workspace" id="top">
        <nav className="rail" aria-label="Primary navigation">
          <TabsList variant="line" className="rail-tabs">
            <TabsTrigger value="closet">
              <Archive />
              <span>Closet</span>
            </TabsTrigger>
            <TabsTrigger value="outfits">
              <Layers3 />
              <span>Outfits</span>
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarDays />
              <span>Calendar</span>
            </TabsTrigger>
            <TabsTrigger value="insights">
              <ChartColumn />
              <span>Insights</span>
            </TabsTrigger>
          </TabsList>
          <div className="rail-note">
            <Sparkles />
            <p>
              <strong>Smart closet</strong>
              <br />
              Build looks from clean, tagged pieces.
            </p>
          </div>
        </nav>
        <TabsContent value="closet" className="closet-view">
          <section className="closet-main">
            {items.length > 0 && (
              <OutfitOfTheDay
                items={items}
                looks={savedLooks}
                plans={plans}
                todayIso={todayIso}
                onOpenLook={loadLook}
                onWear={logWear}
                onPlanDay={(date) => {
                  setCalendarMonth(new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, 1));
                  setSelectedDate(date);
                  setActiveTab("calendar");
                }}
                onSurprise={() => {
                  shuffleLook();
                  setCanvasLookId(null);
                  setOutfitMode("canvas");
                  setActiveTab("outfits");
                }}
              />
            )}
            <div className="section-heading">
              <div>
                <h1>Your closet</h1>
                <p>Everything you own, ready to wear again.</p>
              </div>
              <div className="search-wrap">
                <Search />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search your closet"
                  aria-label="Search your closet"
                />
              </div>
            </div>
            <div className="filter-row">
              <div className="category-list" aria-label="Filter by category">
                {categories.map((category) => (
                  <button
                    key={category}
                    className={activeCategory === category ? "active" : ""}
                    onClick={() => setActiveCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <div className="filter-tools">
                <label className={`pill-select ${colorFilter !== "All colors" ? "active" : ""}`}>
                  <span className="sr-only">Filter by color</span>
                  <select value={colorFilter} onChange={(event) => setColorFilter(event.target.value)}>
                    <option>All colors</option>
                    {closetColors.map((color) => (
                      <option key={color}>{color}</option>
                    ))}
                  </select>
                  <ChevronDown />
                </label>
                <label className={`pill-select ${seasonFilter !== "All seasons" ? "active" : ""}`}>
                  <span className="sr-only">Filter by season</span>
                  <select value={seasonFilter} onChange={(event) => setSeasonFilter(event.target.value)}>
                    <option>All seasons</option>
                    {seasons
                      .filter((season) => season !== "All season")
                      .map((season) => (
                        <option key={season}>{season}</option>
                      ))}
                  </select>
                  <ChevronDown />
                </label>
                {filtersActive && (
                  <button
                    className="clear-filters"
                    onClick={() => {
                      setColorFilter("All colors");
                      setSeasonFilter("All seasons");
                    }}
                  >
                    Clear
                  </button>
                )}
                <label className="sort-control">
                  <span className="sr-only">Sort closet</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value)}>
                    <option>Recently added</option>
                    <option>A–Z</option>
                    <option>Color</option>
                    <option>Most worn</option>
                    <option>Least worn</option>
                  </select>
                  <ChevronDown className="sort-chevron" />
                  <ArrowUpDown className="sort-icon" />
                </label>
                <button
                  className={`select-toggle ${selecting ? "active" : ""}`}
                  aria-pressed={selecting}
                  disabled={!items.length}
                  onClick={() => (selecting ? endSelecting() : setSelecting(true))}
                >
                  {selecting ? "Done" : "Select"}
                </button>
              </div>
            </div>
            {visibleItems.length ? (
              <div className="wardrobe-grid">
                {visibleItems.map((item) => (
                  <article
                    key={item.id}
                    className={`item-card ${!selecting && selected && sameId(selected.id, item.id) ? "selected" : ""} ${item.inLaundry ? "in-laundry" : ""} ${selecting && picked.includes(String(item.id)) ? "picked" : ""}`}
                    draggable={!selecting}
                    onDragStart={(event) => event.dataTransfer.setData("text/plain", String(item.id))}
                    onClick={() => {
                      if (selecting) {
                        togglePicked(item.id);
                        return;
                      }
                      setSelectedId(item.id);
                      // Below this width the details panel is hidden, so details open in a sheet.
                      if (isNarrow(1100)) setDetailSheetOpen(true);
                    }}
                  >
                    {selecting ? (
                      <span className="pick-mark">
                        {picked.includes(String(item.id)) && <Check aria-hidden />}
                        <span className="sr-only">
                          {picked.includes(String(item.id)) ? "Selected" : "Not selected"}
                        </span>
                      </span>
                    ) : (
                      <button
                        className={`heart-button ${item.favorite ? "active" : ""}`}
                        aria-label={item.favorite ? `Remove ${item.name} from favorites` : `Favorite ${item.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleFavorite(item.id);
                        }}
                      >
                        <Heart fill={item.favorite ? "currentColor" : "none"} />
                      </button>
                    )}
                    <div className="item-image">
                      <img src={item.image} alt={item.name} />
                      {item.inLaundry && (
                        <span className="laundry-badge">
                          <WashingMachine /> In the wash
                        </span>
                      )}
                    </div>
                    <div className="item-meta">
                      <p>{item.category}</p>
                      <h2>{item.name}</h2>
                      <span>{item.color}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : closetStatus === "loading" ? (
              <div className="empty-state" role="status">
                <Shirt />
                <h2>Opening your closet…</h2>
              </div>
            ) : closetStatus === "error" ? (
              <div className="empty-state" role="alert">
                <X />
                <h2>Your closet could not be loaded</h2>
                <p>{closetError}</p>
              </div>
            ) : items.length ? (
              <div className="empty-state">
                <Grid2X2 />
                <h2>No pieces found</h2>
                <p>Try another search, category or filter.</p>
              </div>
            ) : (
              <div className="empty-state">
                <ScanSearch />
                <h2>Your closet is empty</h2>
                <p>Add a photo of a piece or a full outfit and Rove will cut out each garment.</p>
                <Button className="empty-action" onClick={() => setDialogOpen(true)}>
                  <Plus /> Add your first photo
                </Button>
              </div>
            )}
            {selecting && (
              <div className="bulk-bar" role="toolbar" aria-label="Selected pieces">
                <span>
                  <strong>{picked.length}</strong> selected
                </span>
                <button
                  onClick={() =>
                    setPicked(picked.length === visibleItems.length ? [] : visibleItems.map((item) => String(item.id)))
                  }
                >
                  {picked.length === visibleItems.length && picked.length ? "None" : "All"}
                </button>
                <button aria-label="Favorite" disabled={!picked.length} onClick={() => bulkUpdate({ favorite: true })}>
                  <Heart /> <span className="bulk-label">Favorite</span>
                </button>
                <button
                  aria-label="Toggle in the wash"
                  disabled={!picked.length}
                  onClick={() =>
                    bulkUpdate({
                      inLaundry: !items
                        .filter((item) => picked.includes(String(item.id)))
                        .every((item) => item.inLaundry),
                    })
                  }
                >
                  <WashingMachine /> <span className="bulk-label">Wash</span>
                </button>
                <label className="bulk-select">
                  <span className="sr-only">Move to category</span>
                  <select
                    value=""
                    disabled={!picked.length}
                    onChange={(event) => event.target.value && bulkUpdate({ category: event.target.value })}
                  >
                    <option value="">Move to…</option>
                    {pieceCategories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="danger"
                  aria-label="Delete"
                  disabled={!picked.length}
                  onClick={() => {
                    deletePieces(items.filter((item) => picked.includes(String(item.id))));
                    endSelecting();
                  }}
                >
                  <Trash2 /> <span className="bulk-label">Delete</span>
                </button>
              </div>
            )}
          </section>
          <aside className="detail-panel" aria-label="Selected item details">
            {selected ? (
              <div className="detail-sticky">{pieceDetails}</div>
            ) : (
              <div className="detail-sticky detail-empty">
                <p>Pick a piece to see its details here.</p>
              </div>
            )}
          </aside>
          <Sheet open={detailSheetOpen && Boolean(selected)} onOpenChange={setDetailSheetOpen}>
            <SheetContent side="bottom" className="piece-sheet">
              <SheetTitle className="sr-only">{selected?.name ?? "Piece details"}</SheetTitle>
              <SheetDescription className="sr-only">Details and actions for this piece.</SheetDescription>
              <div className="detail-sticky">{pieceDetails}</div>
            </SheetContent>
          </Sheet>
        </TabsContent>
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
                        <img src={item.image} alt="" />
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
                            <img src={item.image} alt="" />
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
                      return item ? <img key={id} src={item.image} alt={item.name} /> : null;
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
                        <img src={item.image} alt="" />
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
        <TabsContent value="calendar" className="calendar-view">
          <section className="calendar-intro">
            <div>
              <h1>Plan your month</h1>
              <p>Put saved looks on the calendar so getting dressed is already decided.</p>
            </div>
            <div className="occasion-list">
              {occasions.map((occasion) => (
                <button
                  key={occasion}
                  className={occasionFilter === occasion ? "active" : ""}
                  onClick={() => setOccasionFilter(occasion)}
                >
                  {occasion}
                </button>
              ))}
            </div>
          </section>
          <div className="calendar-workspace">
            <section className="month-panel">
              <div className="month-heading">
                <div className="month-nav">
                  <button aria-label="Previous month" onClick={() => shiftMonth(-1)}>
                    <ChevronLeft />
                  </button>
                  <h2>{calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
                  <button aria-label="Next month" onClick={() => shiftMonth(1)}>
                    <ChevronRight />
                  </button>
                </div>
                <span>
                  {plannedThisMonth} {plannedThisMonth === 1 ? "look" : "looks"} planned
                </span>
              </div>
              <div className="calendar-grid">
                {weekdayLabels.map((day) => (
                  <span className="weekday" key={day}>
                    {day}
                  </span>
                ))}
                {Array.from({ length: leadingBlanks }, (_, index) => (
                  <span key={`blank-${index}`} />
                ))}
                {monthDates.map((date) => {
                  const look = savedLooks.find((candidate) => candidate.id === plans[date]);
                  const thumb = look && items.find((item) => look.itemIds.some((id) => sameId(id, item.id)));
                  return (
                    <button
                      key={date}
                      className={`${selectedDate === date ? "selected" : ""} ${look ? "planned" : ""} ${date === todayIso ? "today" : ""}`}
                      aria-label={new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { dateStyle: "full" })}
                      aria-pressed={selectedDate === date}
                      onClick={() => {
                        setSelectedDate(date);
                        if (isNarrow(760)) scrollIntoViewSoon(dayPanelRef.current);
                      }}
                    >
                      <span>{Number(date.slice(-2))}</span>
                      {thumb && <img src={thumb.image} alt="" />}
                    </button>
                  );
                })}
              </div>
            </section>
            <aside className="day-panel" ref={dayPanelRef}>
              <p>{selectedDateLabel}</p>
              <h2>{plannedLook ? plannedLook.name : "Nothing planned"}</h2>
              {plannedLook ? (
                <>
                  <div className="day-look">
                    {plannedLook.itemIds.map((id) => {
                      const item = items.find((piece) => sameId(piece.id, id));
                      return item ? <img key={id} src={item.image} alt={item.name} /> : null;
                    })}
                  </div>
                  <span>
                    {plannedLook.occasion} · {plannedLook.itemIds.length} pieces
                  </span>
                  <Button variant="outline" onClick={() => loadLook(plannedLook)}>
                    Open look
                  </Button>
                </>
              ) : (
                <div className="day-empty">
                  <CalendarDays />
                  <span>Pick a saved look for this day.</span>
                </div>
              )}
              <div className="plan-control">
                <label htmlFor="plan-look">Saved look</label>
                <select
                  id="plan-look"
                  value={lookToPlan}
                  disabled={!filteredLooks.length}
                  onChange={(event) => setPlanLookId(event.target.value)}
                >
                  {!filteredLooks.length && (
                    <option value="">{savedLooks.length ? "No looks for this occasion" : "Save a look first"}</option>
                  )}
                  {filteredLooks.map((look) => (
                    <option key={look.id} value={look.id}>
                      {look.name} · {look.occasion}
                    </option>
                  ))}
                </select>
                <Button disabled={!lookToPlan} onClick={planSelectedLook}>
                  {plannedLook ? "Replace planned look" : "Plan this look"}
                </Button>
                {plannedLook && (
                  <button className="remove-plan" onClick={removePlan}>
                    Remove from day
                  </button>
                )}
              </div>
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="insights" className="insights-view">
          <section className="insights-intro">
            <h1>Closet insights</h1>
            <p>What you reach for, what you paid, and what&apos;s waiting for its turn.</p>
          </section>
          <ClosetInsights
            items={items}
            onOpenPiece={(item) => {
              setSelectedId(item.id);
              setActiveTab("closet");
              if (isNarrow(1100)) setDetailSheetOpen(true);
            }}
          />
        </TabsContent>
      </Tabs>
      {activeTab === "closet" && !selecting && items.length > 0 && (
        <button className="fab-add" onClick={() => setDialogOpen(true)}>
          Add clothes <Plus />
        </button>
      )}
      <EditPieceDialog
        item={editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        onSave={savePieceEdits}
      />
      <EditLookDialog
        look={editingLook}
        onOpenChange={(open) => !open && setEditingLook(null)}
        onSave={saveLookEdits}
      />
    </main>
  );
}

const detectionPositions = ["detection-one", "detection-two", "detection-three"];

type UploadDialogProps = {
  dialogOpen: boolean;
  setDialogOpen: (value: boolean) => void;
  preview: string | null;
  setPreview: (value: string | null) => void;
  processed: boolean;
  setProcessed: (value: boolean) => void;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
  uploadMode: string;
  setUploadMode: (value: string) => void;
  detectedItems: WardrobeItem[];
  setDetectedItems: (value: WardrobeItem[]) => void;
  selectedExtractions: string[];
  setSelectedExtractions: React.Dispatch<React.SetStateAction<string[]>>;
  setActiveImportId: (value: string | null) => void;
  importError: string | null;
  setImportError: (value: string | null) => void;
  importNotice: string | null;
  setImportNotice: (value: string | null) => void;
  isSavingImport: boolean;
  duplicateMatches: DuplicateMatch[];
  setDuplicateMatches: (value: DuplicateMatch[]) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  cameraRef: React.RefObject<HTMLInputElement | null>;
  handleFile: (file?: File) => Promise<void>;
  saveUploadedItem: () => Promise<void>;
};

function UploadDialog({
  dialogOpen,
  setDialogOpen,
  preview,
  setPreview,
  processed,
  setProcessed,
  isProcessing,
  setIsProcessing,
  uploadMode,
  setUploadMode,
  detectedItems,
  setDetectedItems,
  selectedExtractions,
  setSelectedExtractions,
  setActiveImportId,
  importError,
  setImportError,
  importNotice,
  setImportNotice,
  isSavingImport,
  duplicateMatches,
  setDuplicateMatches,
  fileRef,
  cameraRef,
  handleFile,
  saveUploadedItem,
}: UploadDialogProps) {
  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setPreview(null);
          setProcessed(false);
          setIsProcessing(false);
          setUploadMode("auto");
          setDetectedItems([]);
          setSelectedExtractions([]);
          setActiveImportId(null);
          setImportError(null);
          setImportNotice(null);
          setDuplicateMatches([]);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="add-button">
          <Plus /> Add photo
        </Button>
      </DialogTrigger>
      <DialogContent className={`upload-dialog ${uploadMode === "look" ? "look-import-dialog" : ""}`}>
        <DialogHeader>
          <DialogTitle>
            {uploadMode === "look"
              ? "Full look detected"
              : uploadMode === "single"
                ? "One piece detected"
                : "Add to your closet"}
          </DialogTitle>
          <DialogDescription>
            {uploadMode === "look"
              ? "Rove found multiple garments and separated them for review."
              : uploadMode === "single"
                ? "Rove found one garment and prepared its details."
                : "Upload any clothing or full-body photo. Rove will automatically find every garment."}
          </DialogDescription>
        </DialogHeader>
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept="image/*"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        <input
          ref={cameraRef}
          className="sr-only"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        {!preview ? (
          <button
            className="drop-zone"
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleFile(event.dataTransfer.files?.[0]);
            }}
          >
            <span className="upload-icon">
              <ScanSearch />
            </span>
            <strong className="pointer-fine">Drop a clothing photo here, or click to browse</strong>
            <strong className="pointer-coarse">Tap to choose a clothing photo</strong>
            <span>One piece or a full look—we’ll sort it out</span>
          </button>
        ) : null}
        {!preview ? (
          <Button variant="outline" className="camera-button pointer-coarse" onClick={() => cameraRef.current?.click()}>
            <Camera /> Take a photo
          </Button>
        ) : (
          <div className="processing-grid">
            <div className={`processing-photo ${uploadMode === "look" && processed ? "look-detected" : ""}`}>
              <img
                src={preview}
                alt={uploadMode === "look" ? "Uploaded full-body look" : "Uploaded clothing preview"}
              />
              {isProcessing && <div className="scan-line" />}
              {uploadMode === "look" && processed && (
                <>
                  {[...new Set(detectedItems.map((piece) => piece.category))].slice(0, 3).map((category, index) => (
                    <span key={category} className={`detection-label ${detectionPositions[index]}`}>
                      {category}
                    </span>
                  ))}
                </>
              )}
            </div>
            <div className="processing-copy" aria-live="polite">
              {isProcessing && (
                <div className="styling-icons" aria-hidden>
                  <span>
                    <Shirt />
                  </span>
                  <span>
                    <Layers3 />
                  </span>
                  <span>
                    <Sparkles />
                  </span>
                  <span>
                    <WandSparkles />
                  </span>
                </div>
              )}
              <p className="process-status">
                {isProcessing ? <WandSparkles /> : importError ? <X /> : <Check />}
                {isProcessing
                  ? "Detecting, cleaning, and tagging…"
                  : importError
                    ? "Import needs attention"
                    : uploadMode === "look"
                      ? `${detectedItems.length} pieces found`
                      : "1 piece ready"}
              </p>
              <ul>
                <li className={processed ? "done" : "active"}>
                  <span /> Understanding the photo
                </li>
                <li className={processed ? "done" : ""}>
                  <span /> Separating and cleaning pieces
                </li>
                <li className={processed ? "done" : ""}>
                  <span /> Writing names and tags
                </li>
              </ul>
              {importError && (
                <div className="import-message error" role="alert">
                  <p>{importError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPreview(null);
                      setImportError(null);
                      fileRef.current?.click();
                    }}
                  >
                    Choose another photo
                  </Button>
                </div>
              )}
              {duplicateMatches.length > 0 && (
                <div className="import-message warning" role="status">
                  <div className="duplicate-thumbs">
                    {duplicateMatches.slice(0, 3).map((match) => (
                      <img key={match.id} src={match.image} alt="" />
                    ))}
                  </div>
                  <p>
                    You may have added this photo before:{" "}
                    {duplicateMatches
                      .slice(0, 3)
                      .map((match) => match.name)
                      .join(", ")}
                    {duplicateMatches.length > 3 ? ` and ${duplicateMatches.length - 3} more` : ""}. You can still add
                    it, or cancel.
                  </p>
                </div>
              )}
              {importNotice && (
                <div className="import-message" role="status">
                  <p>{importNotice}</p>
                </div>
              )}
              {processed && uploadMode === "single" && detectedItems[0] && (
                <div className="generated-fields">
                  <label>
                    Name <Input value={detectedItems[0].name} readOnly />
                  </label>
                  <label>
                    Description <textarea value={detectedItems[0].description} readOnly />
                  </label>
                  <div className="tag-row">
                    <span>{detectedItems[0].category}</span>
                    <span>{detectedItems[0].color}</span>
                    <span>{detectedItems[0].season}</span>
                  </div>
                </div>
              )}
              {processed && uploadMode === "look" && (
                <div className="extraction-review">
                  {detectedItems.map((piece) => {
                    const key = String(piece.id);
                    const checked = selectedExtractions.includes(key);
                    return (
                      <label key={key} className={checked ? "selected" : ""}>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) =>
                            setSelectedExtractions((current) =>
                              next ? [...current, key] : current.filter((value) => value !== key),
                            )
                          }
                          aria-label={`Add ${piece.name}`}
                        />
                        <span className="extracted-thumb">
                          <img src={piece.image} alt="" />
                        </span>
                        <span>
                          <strong>{piece.name}</strong>
                          <small>
                            {piece.category} · {piece.color}
                          </small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={isSavingImport}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            disabled={!processed || isSavingImport || (uploadMode === "look" && selectedExtractions.length === 0)}
            onClick={saveUploadedItem}
          >
            {isSavingImport
              ? "Saving…"
              : uploadMode === "look"
                ? `Add ${selectedExtractions.length} ${selectedExtractions.length === 1 ? "piece" : "pieces"}`
                : "Add to closet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
