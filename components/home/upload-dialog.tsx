"use client";

import { Check, Camera, Footprints, Glasses, Plus, ScanSearch, Shirt, WandSparkles, Watch, X } from "lucide-react";
import { importStepFor, importSteps } from "@/lib/import-steps";
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
import { type WardrobeItem } from "@/lib/wardrobe-types";
import { type DuplicateMatch, type BatchEntry } from "@/lib/home-utils";

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
  handleFiles: (files: File[]) => Promise<void>;
  saveUploadedItem: () => Promise<void>;
  batch: BatchEntry[] | null;
  setBatch: (value: BatchEntry[] | null) => void;
  skipDuplicates: boolean;
  setSkipDuplicates: (value: boolean) => void;
  cancelBatch: () => void;
};

export function UploadDialog({
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
}: UploadDialogProps) {
  const step = importStepFor(importNotice);
  const batchRunning = Boolean(batch?.some((entry) => entry.status === "waiting" || entry.status === "working"));
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
          // Closing stops a batch after the photo in progress; pieces already added stay.
          if (batchRunning) cancelBatch();
          setBatch(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="add-button">
          <Plus /> Add clothes
        </Button>
      </DialogTrigger>
      <DialogContent className={`upload-dialog ${uploadMode === "look" ? "look-import-dialog" : ""}`}>
        <DialogHeader>
          <DialogTitle>
            {uploadMode === "look"
              ? "Full look detected"
              : uploadMode === "single"
                ? "One piece detected"
                : "Add clothes"}
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
          multiple
          onChange={(event) => handleFiles(Array.from(event.target.files ?? []))}
        />
        <input
          ref={cameraRef}
          className="sr-only"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        {batch ? (
          <div className="batch-import" aria-live="polite">
            <p className="process-status">
              {batchRunning ? <WandSparkles /> : <Check />}
              {batchRunning
                ? `Processing ${batch.filter((entry) => entry.status !== "waiting").length} of ${batch.length} photos…`
                : `Done: ${batch.filter((entry) => entry.status === "added").length} of ${batch.length} photos added`}
            </p>
            <ul>
              {batch.map((entry, index) => (
                <li key={`${entry.name}-${index}`} className={entry.status}>
                  <span className="batch-dot" />
                  <span>
                    <strong>{entry.name}</strong>
                    <small>
                      {entry.status === "waiting"
                        ? "Waiting"
                        : entry.status === "skipped"
                          ? `Skipped · ${entry.detail}`
                          : entry.status === "failed"
                            ? `Failed · ${entry.detail}`
                            : entry.detail}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : !preview ? (
          <button
            className="drop-zone"
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleFiles(Array.from(event.dataTransfer.files ?? []));
            }}
          >
            <span className="upload-icon">
              <ScanSearch />
            </span>
            <strong className="pointer-fine">Drop a clothing photo here, or click to browse</strong>
            <strong className="pointer-coarse">Tap to choose a clothing photo</strong>
            <span>One piece or a full look—we’ll sort it out. Pick several photos to add them all at once.</span>
          </button>
        ) : null}
        {batch ? null : !preview ? (
          <>
            <Button
              variant="outline"
              className="camera-button pointer-coarse"
              onClick={() => cameraRef.current?.click()}
            >
              <Camera /> Take a photo
            </Button>
            <label className="skip-duplicates">
              <Checkbox checked={skipDuplicates} onCheckedChange={(value) => setSkipDuplicates(value === true)} />
              When adding several photos, skip ones already in my closet
            </label>
          </>
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
              {isProcessing ? (
                <div className="styling-status">
                  <div className="styling-icons" aria-hidden>
                    <span>
                      <Shirt />
                    </span>
                    <span>
                      <Glasses />
                    </span>
                    <span>
                      <Footprints />
                    </span>
                    <span>
                      <Watch />
                    </span>
                  </div>
                  <h3>Styling your look…</h3>
                  <p>{importNotice ?? "Matching your style with the perfect fit"}</p>
                </div>
              ) : (
                <p className="process-status">
                  {importError ? <X /> : <Check />}
                  {importError
                    ? "Import needs attention"
                    : uploadMode === "look"
                      ? `${detectedItems.length} pieces found`
                      : "1 piece ready"}
                </p>
              )}
              <ol className="import-steps">
                {importSteps.map((label, index) => (
                  <li
                    key={label}
                    className={
                      processed || (isProcessing && index < step)
                        ? "done"
                        : isProcessing && index === step
                          ? "active"
                          : ""
                    }
                  >
                    <span /> {label}
                  </li>
                ))}
              </ol>
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
              {importNotice && !isProcessing && (
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
        {batch ? (
          <DialogFooter>
            <DialogClose asChild>
              <Button variant={batchRunning ? "ghost" : "default"}>
                {batchRunning ? "Stop after this photo" : "Done"}
              </Button>
            </DialogClose>
          </DialogFooter>
        ) : (
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
        )}
      </DialogContent>
    </Dialog>
  );
}
