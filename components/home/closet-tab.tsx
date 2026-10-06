"use client";

import { useState, useSyncExternalStore } from "react";
import {
  Check,
  ArrowUpDown,
  ChevronDown,
  SlidersHorizontal,
  Heart,
  Package,
  Plus,
  Search,
  Shirt,
  Sparkles,
  Trash2,
  WashingMachine,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { TabsContent } from "@/components/ui/tabs";
import { OutfitOfTheDay } from "@/components/outfit-of-the-day";
import { SeasonalSwapCard, SeasonalSwapDialog } from "@/components/seasonal-swap";
import { isLetGoReason, letGoLabels, letGoReasons } from "@/lib/declutter";
import { pieceCategories, seasons } from "@/lib/wardrobe-types";
import { categories, sameId, isNarrow } from "@/lib/home-utils";
import { PieceDetails } from "@/components/home/piece-details";
import { ClosetFilterSheet } from "@/components/closet-filters";
import { activeFilterCount, primaryCategories, sortOptions } from "@/lib/closet-filters";
import { useMediaQuery } from "@/hooks/use-media-query";
import { greeting } from "@/lib/greeting";
import { type HomeState } from "@/hooks/use-home";

const noSubscribe = () => () => {};

export function ClosetTab({ home }: { home: HomeState }) {
  // Client-only: the server doesn't know the person's local hour.
  const hello = useSyncExternalStore(noSubscribe, () => greeting(new Date().getHours()), () => "");
  const {
    items,
    closetStatus,
    closetError,
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
    setSelectedId,
    detailSheetOpen,
    setDetailSheetOpen,
    setOutfitMode,
    savedLooks,
    setCalendarMonth,
    setSelectedDate,
    plans,
    setDialogOpen,
    setCanvasLookId,
    closetColors,
    visibleItems,
    filtersActive,
    selected,
    todayIso,
    toggleFavorite,
    logWear,
    deletePieces,
    pile,
    togglePicked,
    endSelecting,
    bulkUpdate,
    shuffleLook,
    loadLook,
    storedCount,
    swapOpen,
    setSwapOpen,
    swapSeasonal,
    toggleStored,
    lovedLook,
    setOutfit,
    studioPending,
  } = home;
  const storedView = activeCategory === "Stored";
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  // The side panel only shows on wide screens; skipping it elsewhere keeps its full-size photo from loading.
  const showDetailPanel = useMediaQuery("(min-width: 1101px)");
  const filterCount = activeFilterCount({ category: activeCategory, color: colorFilter, season: seasonFilter, sort });
  const phoneCategories = primaryCategories(
    categories,
    items.map((item) => item.category),
    // The Stored chip sits after the categories, so it isn't swapped in as a category.
    storedView ? "All" : activeCategory,
  );
  const storedChip = (storedCount > 0 || storedView) && (
    <button
      className={`stored-chip ${storedView ? "active" : ""}`}
      aria-pressed={storedView}
      onClick={() => setActiveCategory("Stored")}
    >
      <Package aria-hidden /> Stored <b>{storedCount}</b>
    </button>
  );
  const selectToggle = (
    <button
      className={`select-toggle ${selecting ? "active" : ""}`}
      aria-pressed={selecting}
      disabled={!items.length}
      onClick={() => (selecting ? endSelecting() : setSelecting(true))}
    >
      {selecting ? "Done" : "Select"}
    </button>
  );
  return (
    <TabsContent value="closet" className="closet-view">
      <section className="closet-main">
        {!storedView && hello && <p className="closet-greeting">{hello}</p>}
        <div className="section-heading">
          <div className="closet-title">
            <h1>{storedView ? <>Packed <em>away</em></> : <>Your <em>closet</em></>}</h1>
            <p>
              {storedView
                ? "Stored for the off season. Bring pieces back any time."
                : "Everything you own, ready to wear again."}
            </p>
            <span className="phone-only">{selectToggle}</span>
          </div>
          <div className="search-wrap">
            <Search />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your closet"
              aria-label="Search your closet"
            />
          </div>
        </div>
        {items.length > 0 && (
          <OutfitOfTheDay
            items={items}
            looks={savedLooks}
            plans={plans}
            todayIso={todayIso}
            onOpenLook={loadLook}
            onWear={logWear}
            lovedLook={lovedLook}
            onStyle={(pieces) => {
              setOutfit(pieces.map((piece) => piece.id));
              setCanvasLookId(null);
              setOutfitMode("canvas");
              setActiveTab("outfits");
            }}
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
        {items.length > 0 && <SeasonalSwapCard items={items} todayIso={todayIso} onReview={() => setSwapOpen(true)} />}
        <div className="phone-filter-row">
          <button
            className={`filter-button ${filterCount ? "active" : ""}`}
            onClick={() => setFilterSheetOpen(true)}
            aria-label={filterCount ? `Filter and sort, ${filterCount} active` : "Filter and sort"}
          >
            <SlidersHorizontal aria-hidden /> Filter
            {filterCount > 0 && <b aria-hidden>{filterCount}</b>}
          </button>
          <div className="category-list" aria-label="Filter by category">
            {phoneCategories.map((category) => (
              <button
                key={category}
                className={activeCategory === category ? "active" : ""}
                aria-pressed={activeCategory === category}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
            {storedChip}
            <button onClick={() => setFilterSheetOpen(true)}>
              More <ChevronDown aria-hidden />
            </button>
          </div>
        </div>
        <div className="filter-row">
          <div className="category-list" aria-label="Filter by category">
            {categories.map((category) => (
              <button
                key={category}
                className={activeCategory === category ? "active" : ""}
                aria-pressed={activeCategory === category}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
            {storedChip}
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
                {sortOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <ChevronDown className="sort-chevron" />
              <ArrowUpDown className="sort-icon" />
            </label>
            {selectToggle}
          </div>
        </div>
        {visibleItems.length ? (
          <div className="wardrobe-grid">
            {visibleItems.map((item, index) => (
              <article
                key={item.id}
                className={`item-card ${!selecting && selected && sameId(selected.id, item.id) ? "selected" : ""} ${item.inLaundry ? "in-laundry" : ""} ${item.storedAt && !storedView ? "is-stored" : ""} ${selecting && picked.includes(String(item.id)) ? "picked" : ""}`}
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
                    <span className="sr-only">{picked.includes(String(item.id)) ? "Selected" : "Not selected"}</span>
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
                  <img
                    src={item.thumb ?? item.image}
                    alt={item.name}
                    width={480}
                    height={480}
                    loading={index < 6 ? "eager" : "lazy"}
                    decoding="async"
                  />
                  {studioPending.includes(String(item.id)) ? (
                    <span className="laundry-badge studio-badge">
                      <Sparkles /> Styling…
                    </span>
                  ) : item.inLaundry ? (
                    <span className="laundry-badge">
                      <WashingMachine /> In the wash
                    </span>
                  ) : item.storedAt && !storedView ? (
                    <span className="laundry-badge">
                      <Package /> Packed away
                    </span>
                  ) : null}
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
        ) : storedView ? (
          <div className="empty-state">
            <span className="empty-emoji" aria-hidden>📦</span>
            <h2>Nothing packed away</h2>
            <p>Pieces you store for the off season wait here until you bring them back.</p>
            <Button className="empty-action" variant="outline" onClick={() => setActiveCategory("All")}>
              Back to your closet
            </Button>
          </div>
        ) : items.length ? (
          <div className="empty-state">
            <span className="empty-emoji" aria-hidden>🔍</span>
            <h2>No pieces found</h2>
            <p>Try another search, category or filter.</p>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-emoji" aria-hidden>🧺</span>
            <h2>Your closet is empty</h2>
            <p>Add a photo of a piece or a full outfit and Rove will cut out each garment.</p>
            <Button className="empty-action" onClick={() => setDialogOpen(true)}>
              <Plus /> Add clothes
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
                  inLaundry: !items.filter((item) => picked.includes(String(item.id))).every((item) => item.inLaundry),
                })
              }
            >
              <WashingMachine /> <span className="bulk-label">Wash</span>
            </button>
            <button
              aria-label={storedView ? "Bring back" : "Pack away"}
              disabled={!picked.length}
              onClick={() => {
                toggleStored(items.filter((item) => picked.includes(String(item.id))));
                endSelecting();
              }}
            >
              <Package /> <span className="bulk-label">{storedView ? "Bring back" : "Store"}</span>
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
            <label className="bulk-select">
              <span className="sr-only">Let go of these pieces</span>
              <select
                value=""
                disabled={!picked.length}
                onChange={(event) => {
                  const reason = event.target.value;
                  if (!isLetGoReason(reason)) return;
                  pile.letGo(
                    items.filter((item) => picked.includes(String(item.id))),
                    reason,
                  );
                  endSelecting();
                }}
              >
                <option value="">Let go…</option>
                {letGoReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {letGoLabels[reason]}
                  </option>
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
        {!showDetailPanel ? null : selected ? (
          <div className="detail-sticky">
            <PieceDetails home={home} />
          </div>
        ) : (
          <div className="detail-sticky detail-empty">
            <p>Pick a piece to see its details here.</p>
          </div>
        )}
      </aside>
      <SeasonalSwapDialog
        open={swapOpen}
        onOpenChange={setSwapOpen}
        items={items}
        todayIso={todayIso}
        onSwap={swapSeasonal}
      />
      <ClosetFilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        categories={categories}
        category={activeCategory}
        setCategory={setActiveCategory}
        colors={closetColors}
        color={colorFilter}
        setColor={setColorFilter}
        season={seasonFilter}
        setSeason={setSeasonFilter}
        sort={sort}
        setSort={setSort}
        resultCount={visibleItems.length}
      />
      <Sheet open={detailSheetOpen && Boolean(selected)} onOpenChange={setDetailSheetOpen}>
        <SheetContent side="bottom" className="piece-sheet">
          <SheetTitle className="sr-only">{selected?.name ?? "Piece details"}</SheetTitle>
          <SheetDescription className="sr-only">Details and actions for this piece.</SheetDescription>
          <div className="detail-sticky">
            <PieceDetails home={home} />
          </div>
        </SheetContent>
      </Sheet>
    </TabsContent>
  );
}
