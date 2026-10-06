"use client";

import { useEffect, useState } from "react";
import { Archive, CalendarDays, ChartColumn, Layers3, Plus, Shirt, Sparkles } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { EditLookDialog, EditPieceDialog } from "@/components/closet-dialogs";
import { CutoutEditor } from "@/components/cutout-editor";
import { StudioPhoto } from "@/components/studio-photo";
import { PackingDialog } from "@/components/packing-dialog";
import { useHome } from "@/hooks/use-home";
import { ClosetTab } from "@/components/home/closet-tab";
import { OutfitsTab } from "@/components/home/outfits-tab";
import { CalendarTab } from "@/components/home/calendar-tab";
import { InsightsTab } from "@/components/home/insights-tab";
import { UploadDialog } from "@/components/home/upload-dialog";

/** True while the page is scrolling down, so the floating Add button gets out of the way of what's under it. */
function useScrollingDown() {
  const [down, setDown] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return;
      setDown(y > last && y > 120);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return down;
}

export default function Home() {
  const home = useHome();
  const fabHidden = useScrollingDown();
  const {
    items,
    activeTab,
    setActiveTab,
    selecting,
    cameraRef,
    savedLooks,
    setCalendarMonth,
    selectedDate,
    setSelectedDate,
    packingOpen,
    setPackingOpen,
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
    setActiveImportId,
    importError,
    setImportError,
    importNotice,
    setImportNotice,
    isSavingImport,
    duplicateMatches,
    setDuplicateMatches,
    batch,
    setBatch,
    skipDuplicates,
    setSkipDuplicates,

    fixingItem,
    setFixingItem,
    studioItem,
    setStudioItem,
    fileRef,
    editingItem,
    setEditingItem,
    editingLook,
    setEditingLook,
    updateItem,
    savePieceEdits,
    saveLookEdits,
    handleFile,
    handleFiles,
    saveUploadedItem,
    cancelBatch,
  } = home;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Rove closet home">
          <span className="brand-mark">
            <Shirt />
          </span>
          <span>Rove</span>
        </a>
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
            handleFiles,
            saveUploadedItem,
            batch,
            setBatch,
            skipDuplicates,
            setSkipDuplicates,
            cancelBatch,
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
            <a className="rail-export" href="/api/export" download>
              Export backup
            </a>
          </div>
        </nav>
        <ClosetTab home={home} />
        <OutfitsTab home={home} />
        <CalendarTab home={home} />
        <InsightsTab home={home} />
      </Tabs>
      {activeTab === "closet" && !selecting && items.length > 0 && (
        <button className={`fab-add ${fabHidden ? "tucked" : ""}`} onClick={() => setDialogOpen(true)}>
          Add clothes <Plus />
        </button>
      )}
      <PackingDialog
        open={packingOpen}
        onOpenChange={setPackingOpen}
        startDate={selectedDate}
        items={items}
        looks={savedLooks}
        onPlanDay={(date) => {
          setPackingOpen(false);
          setSelectedDate(date);
          const month = new Date(`${date}T00:00:00`);
          setCalendarMonth(new Date(month.getFullYear(), month.getMonth(), 1));
        }}
      />
      <CutoutEditor
        item={fixingItem}
        onOpenChange={(open) => !open && setFixingItem(null)}
        onSaved={(id, image, thumb) => {
          updateItem(id, { image, thumb });
          setFixingItem(null);
          toast.success("Cutout saved");
        }}
      />
      <StudioPhoto
        item={studioItem}
        onOpenChange={(open) => !open && setStudioItem(null)}
        onSaved={(id, image, thumb) => {
          updateItem(id, { image, thumb });
          setStudioItem(null);
          toast.success("Studio photo saved");
        }}
      />
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
