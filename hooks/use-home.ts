"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { type PieceChanges } from "@/components/closet-dialogs";
import { useLetGoPile } from "@/components/declutter-review";
import { modelDownloadIsMetered } from "@/lib/local-wardrobe";
import { suggestLook } from "@/lib/outfit-shuffle";
import { makeThumbnail, photoHash, shrinkPhoto } from "@/lib/photo-resize";
import { renderLookImage, shareLookImage } from "@/lib/share-look";
import { type SavedLook, type WardrobeItem } from "@/lib/wardrobe-types";
import {
  categories,
  slotFor,
  sendJson,
  errorMessage,
  isoDate,
  monthKey,
  sameId,
  type DuplicateMatch,
  type BatchEntry,
  findDuplicates,
  analyzeAndUpload,
  confirmImport,
  UNDO_MS,
  addDays,
  weekOf,
  LOOK_DRAG_TYPE,
  isNarrow,
} from "@/lib/home-utils";

export function useHome() {
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
  const [repeatWeeks, setRepeatWeeks] = useState(0);
  const [calendarView, setCalendarView] = useState<"auto" | "month" | "week">("auto");
  const [calendarMode, setCalendarMode] = useState<"plan" | "journal">("plan");
  const [packingOpen, setPackingOpen] = useState(false);
  const [dropDate, setDropDate] = useState<string | null>(null);
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
  const [batch, setBatch] = useState<BatchEntry[] | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const batchCancelled = useRef(false);
  const [fixingItem, setFixingItem] = useState<WardrobeItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);
  const [editingLook, setEditingLook] = useState<SavedLook | null>(null);
  const [canvasLookId, setCanvasLookId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    // Pages of 200: the first page shows right away, later pages are appended as they arrive.
    async function loadCloset() {
      let cursor: string | null = null;
      let first = true;
      do {
        const response = await fetch(`/api/wardrobe${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as {
          items?: WardrobeItem[];
          nextCursor?: string | null;
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error || "Your closet could not be loaded. Try again.");
        const page = payload.items ?? [];
        if (first) {
          setItems(page);
          setSelectedId(page[0]?.id ?? null);
          setClosetStatus("ready");
          first = false;
        } else {
          setItems((current) => [...current, ...page.filter((item) => !current.some((c) => sameId(c.id, item.id)))]);
        }
        cursor = payload.nextCursor ?? null;
      } while (cursor);
    }
    void loadCloset().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setClosetError(error instanceof Error ? error.message : "Your closet could not be loaded. Try again.");
      setClosetStatus((current) => (current === "ready" ? current : "error"));
    });
    return () => controller.abort();
  }, []);

  // Pieces added before thumbnails existed (or with a freshly edited cutout) get one in the background.
  const needsThumb = closetStatus === "ready" ? items.filter((item) => !item.thumb).slice(0, 1)[0] : undefined;
  const needsThumbId = needsThumb ? String(needsThumb.id) : null;
  const needsThumbImage = needsThumb?.image;
  const thumbFailures = useRef(new Set<string>());
  useEffect(() => {
    if (!needsThumbId || !needsThumbImage || thumbFailures.current.has(needsThumbId)) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const thumb = await makeThumbnail(needsThumbImage);
      const form = new FormData();
      form.set("id", needsThumbId);
      if (thumb) form.set("thumb", new File([thumb], "thumb.webp", { type: "image/webp" }));
      const response = thumb
        ? await fetch("/api/wardrobe/image", { method: "POST", body: form }).catch(() => null)
        : null;
      const payload = response?.ok ? ((await response.json()) as { thumb?: string }) : null;
      if (cancelled) return;
      if (!payload?.thumb) thumbFailures.current.add(needsThumbId);
      // On failure the full image stands in, so this piece is not retried until the next visit.
      const thumbUrl = payload?.thumb ?? needsThumbImage;
      setItems((current) =>
        current.map((piece) => (String(piece.id) === needsThumbId ? { ...piece, thumb: thumbUrl } : piece)),
      );
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [needsThumbId, needsThumbImage]);

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

  /** Loads plans for a range the month view may not cover, such as a week that crosses months. */
  const loadPlanRange = useCallback((from: string, to: string) => {
    void fetch(`/api/plans?from=${from}&to=${to}`)
      .then((response) => (response.ok ? (response.json() as Promise<{ plans?: Record<string, string> }>) : null))
      .then((payload) => {
        if (payload?.plans) setPlans((current) => ({ ...current, ...payload.plans }));
      })
      .catch(() => undefined);
  }, []);
  const selectedWeek = weekOf(selectedDate);
  const selectedWeekKey = selectedWeek[0];
  useEffect(() => {
    loadPlanRange(selectedWeekKey, addDays(selectedWeekKey, 13));
  }, [loadPlanRange, selectedWeekKey]);

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
  const pile = useLetGoPile({ active: activeTab === "insights", setItems, setOutfit, deferDelete });
  /** "Keep" in the declutter review: restarts the piece's idle clock. */
  function keepPiece(item: WardrobeItem) {
    const keptAt = item.keptAt;
    updateItem(item.id, { keptAt: todayIso });
    sendJson("/api/wardrobe", "PATCH", { id: item.id, kept: true })
      .then(() => toast.success(`Keeping ${item.name}`))
      .catch((error: unknown) => {
        updateItem(item.id, { keptAt });
        toast.error(errorMessage(error, "That change could not be saved."));
      });
  }
  function openPieceFromInsights(item: WardrobeItem) {
    setSelectedId(item.id);
    setActiveTab("closet");
    if (isNarrow(1100)) setDetailSheetOpen(true);
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
  function planDates(dates: string[], outfitId: string) {
    const previous = Object.fromEntries(dates.map((date) => [date, plans[date]]));
    for (const date of dates) setPlan(date, outfitId);
    sendJson("/api/plans", "POST", { dates, outfitId })
      .then(() => {
        if (dates.length > 1) toast.success(`Planned ${dates.length} days`);
      })
      .catch((error: unknown) => {
        for (const date of dates) setPlan(date, previous[date]);
        toast.error(errorMessage(error, "That day could not be planned."));
      });
  }
  function planSelectedLook() {
    if (!lookToPlan) return;
    // "Repeat weekly" plans the same weekday for the next few weeks too.
    const dates = Array.from({ length: Math.max(1, repeatWeeks) }, (_, week) => addDays(selectedDate, week * 7));
    planDates(dates, lookToPlan);
  }
  function lookDropProps(date: string) {
    return {
      onDragOver: (event: React.DragEvent) => {
        if (!event.dataTransfer.types.includes(LOOK_DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDropDate(date);
      },
      onDragLeave: () => setDropDate((current) => (current === date ? null : current)),
      onDrop: (event: React.DragEvent) => {
        const outfitId = event.dataTransfer.getData(LOOK_DRAG_TYPE);
        setDropDate(null);
        if (!outfitId) return;
        event.preventDefault();
        setSelectedDate(date);
        planDates([date], outfitId);
      },
    };
  }
  function shiftWeek(offset: number) {
    const next = addDays(selectedDate, offset * 7);
    setSelectedDate(next);
    const nextMonth = new Date(`${next}T00:00:00`);
    setCalendarMonth(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1));
  }
  function lookThumbs(look: SavedLook, count: number) {
    return look.itemIds
      .map((id) => items.find((item) => sameId(item.id, id)))
      .filter((item): item is WardrobeItem => Boolean(item))
      .slice(0, count);
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
    void findDuplicates(hash).then(setDuplicateMatches);
    try {
      const payload = await analyzeAndUpload(file, hash, setImportNotice);
      setActiveImportId(payload.importId);
      setDetectedItems(payload.items);
      setSelectedExtractions(payload.items.map((item) => String(item.id)));
      setUploadMode(payload.items.length > 1 ? "look" : "single");
      setImportNotice(
        payload.cleanedCount === payload.items.length
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
  /** Several photos at once: each is processed in turn and every piece found is added. */
  async function handleFiles(picked: File[]) {
    if (fileRef.current) fileRef.current.value = "";
    if (
      picked.length &&
      (await modelDownloadIsMetered()) &&
      !window.confirm(
        "You seem to be on cellular data. The first photo downloads Rove's clothing models once, which is a large download. Continue?",
      )
    )
      return;
    if (picked.length <= 1) return handleFile(picked[0]);
    const files = picked.slice(0, 30);
    setPreview(null);
    setImportError(null);
    setImportNotice(null);
    setBatch(files.map((file) => ({ name: file.name, status: "waiting" })));
    const update = (index: number, entry: Partial<BatchEntry>) =>
      setBatch((current) => current?.map((value, at) => (at === index ? { ...value, ...entry } : value)) ?? null);
    let added = 0;
    for (const [index, original] of files.entries()) {
      if (batchCancelled.current) break;
      update(index, { status: "working", detail: "Getting ready…" });
      try {
        if (!["image/jpeg", "image/png", "image/webp"].includes(original.type))
          throw new Error("Not a JPEG, PNG, or WebP image");
        const file = await shrinkPhoto(original);
        if (file.size > 12 * 1024 * 1024) throw new Error("Larger than 12 MB");
        const hash = await photoHash(file);
        const duplicates = skipDuplicates ? await findDuplicates(hash) : [];
        if (duplicates.length) {
          update(index, { status: "skipped", detail: `Already added: ${duplicates[0].name}` });
          continue;
        }
        const result = await analyzeAndUpload(file, hash, (notice) => update(index, { detail: notice }));
        await confirmImport(
          result.importId,
          result.items.map((item) => String(item.id)),
        );
        setItems((current) => [...result.items, ...current]);
        added += result.items.length;
        update(index, {
          status: "added",
          detail: result.items.map((item) => item.name).join(", "),
        });
      } catch (error) {
        update(index, { status: "failed", detail: errorMessage(error, "Could not be processed") });
      }
    }
    batchCancelled.current = false;
    if (added) toast.success(`Added ${added} ${added === 1 ? "piece" : "pieces"}`);
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

  function cancelBatch() {
    batchCancelled.current = true;
  }

  return {
    cancelBatch,
    items,
    setItems,
    closetStatus,
    setClosetStatus,
    closetError,
    setClosetError,
    activeTab,
    setActiveTab,
    activeCategory,
    setActiveCategory,
    query,
    setQuery,
    sort,
    setSort,
    colorFilter,
    setColorFilter,
    seasonFilter,
    setSeasonFilter,
    selecting,
    setSelecting,
    picked,
    setPicked,
    pendingDeletes,
    selectedId,
    setSelectedId,
    outfit,
    setOutfit,
    activeSlot,
    setActiveSlot,
    detailSheetOpen,
    setDetailSheetOpen,
    pickerOpen,
    setPickerOpen,
    dayPanelRef,
    cameraRef,
    outfitMode,
    setOutfitMode,
    savedLooks,
    setSavedLooks,
    calendarMonth,
    setCalendarMonth,
    selectedDate,
    setSelectedDate,
    occasionFilter,
    setOccasionFilter,
    plans,
    setPlans,
    planLookId,
    setPlanLookId,
    repeatWeeks,
    setRepeatWeeks,
    calendarView,
    setCalendarView,
    calendarMode,
    setCalendarMode,
    packingOpen,
    setPackingOpen,
    dropDate,
    setDropDate,
    preview,
    setPreview,
    isProcessing,
    setIsProcessing,
    processed,
    setProcessed,
    dialogOpen,
    setDialogOpen,
    uploadMode,
    setUploadMode,
    detectedItems,
    setDetectedItems,
    selectedExtractions,
    setSelectedExtractions,
    activeImportId,
    setActiveImportId,
    importError,
    setImportError,
    importNotice,
    setImportNotice,
    isSavingImport,
    setIsSavingImport,
    duplicateMatches,
    setDuplicateMatches,
    batch,
    setBatch,
    skipDuplicates,
    setSkipDuplicates,
    fixingItem,
    setFixingItem,
    fileRef,
    editingItem,
    setEditingItem,
    editingLook,
    setEditingLook,
    canvasLookId,
    setCanvasLookId,
    needsThumb,
    needsThumbId,
    needsThumbImage,
    thumbFailures,
    visibleMonth,
    loadPlanRange,
    selectedWeek,
    selectedWeekKey,
    addToOutfit,
    closetColors,
    visibleItems,
    filtersActive,
    selected,
    railItems,
    outfitItems,
    outfitColors,
    filteredLooks,
    plannedLook,
    lookToPlan,
    calendarYear,
    calendarMonthIndex,
    leadingBlanks,
    daysInMonth,
    monthDates,
    plannedThisMonth,
    todayIso,
    selectedDateLabel,
    updateItem,
    toggleFavorite,
    toggleLaundry,
    logWear,
    unlogWearToday,
    savePieceEdits,
    deferDelete,
    deletePieces,
    pile,
    keepPiece,
    openPieceFromInsights,
    togglePicked,
    endSelecting,
    bulkUpdate,
    saveLookEdits,
    deleteLook,
    updateCanvasLook,
    shuffleLook,
    shareLook,
    saveCurrentLook,
    loadLook,
    toggleLookFavorite,
    setPlan,
    planDates,
    planSelectedLook,
    lookDropProps,
    shiftWeek,
    lookThumbs,
    removePlan,
    shiftMonth,
    handleFile,
    handleFiles,
    saveUploadedItem,
  };
}

export type HomeState = ReturnType<typeof useHome>;
