"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Paintbrush, Sparkles, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { removeSpecks } from "@/lib/cutout-refine";
import type { WardrobeItem } from "@/lib/wardrobe-types";

/** Erase stray bits, paint back what was cut too far, or clear specks, then save a new cutout. */
export function CutoutEditor({
  item,
  onOpenChange,
  onSaved,
}: {
  item: WardrobeItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (id: WardrobeItem["id"], image: string) => void;
}) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="cutout-dialog">
        {item && <Editor key={String(item.id)} item={item} onCancel={() => onOpenChange(false)} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function Editor({
  item,
  onCancel,
  onSaved,
}: {
  item: WardrobeItem;
  onCancel: () => void;
  onSaved: (id: WardrobeItem["id"], image: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const drawingRef = useRef<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<"erase" | "restore">("erase");
  const [brush, setBrush] = useState(4);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "saving">("loading");
  const [changed, setChanged] = useState(false);
  const [historyLength, setHistoryLength] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d", { willReadFrequently: true })?.drawImage(image, 0, 0);
      // The cutout as it was when the editor opened; "Restore" paints from this.
      const original = document.createElement("canvas");
      original.width = image.naturalWidth;
      original.height = image.naturalHeight;
      original.getContext("2d")?.drawImage(image, 0, 0);
      originalRef.current = original;
      setStatus("ready");
    };
    image.onerror = () => setStatus("error");
    image.src = item.image;
  }, [item.image]);

  function context() {
    return canvasRef.current?.getContext("2d", { willReadFrequently: true }) ?? null;
  }
  function snapshot() {
    const canvas = canvasRef.current;
    const ctx = context();
    if (!canvas || !ctx) return;
    historyRef.current = [...historyRef.current.slice(-19), ctx.getImageData(0, 0, canvas.width, canvas.height)];
    setHistoryLength(historyRef.current.length);
  }
  function undo() {
    const previous = historyRef.current.pop();
    setHistoryLength(historyRef.current.length);
    if (previous) context()?.putImageData(previous, 0, 0);
  }
  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }
  function stroke(from: { x: number; y: number }, to: { x: number; y: number }) {
    const canvas = canvasRef.current;
    const ctx = context();
    if (!canvas || !ctx) return;
    const radius = (Math.max(canvas.width, canvas.height) * brush) / 100 / 2;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = radius * 2;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x + 0.01, to.y);
    if (tool === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.stroke();
    } else if (originalRef.current) {
      // Paint the original pixels back inside the stroke.
      ctx.clip(strokePath(from, to, radius));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(originalRef.current, 0, 0);
    }
    ctx.restore();
    setChanged(true);
  }
  function strokePath(from: { x: number; y: number }, to: { x: number; y: number }, radius: number) {
    const path = new Path2D();
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (radius / 2)));
    for (let step = 0; step <= steps; step += 1) {
      const x = from.x + ((to.x - from.x) * step) / steps;
      const y = from.y + ((to.y - from.y) * step) / steps;
      path.moveTo(x + radius, y);
      path.arc(x, y, radius, 0, Math.PI * 2);
    }
    return path;
  }
  function cleanSpecks() {
    const canvas = canvasRef.current;
    const ctx = context();
    if (!canvas || !ctx) return;
    snapshot();
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
    for (let index = 0; index < alpha.length; index += 1) alpha[index] = pixels.data[index * 4 + 3];
    const cleared = removeSpecks(alpha, canvas.width, canvas.height);
    for (let index = 0; index < alpha.length; index += 1) pixels.data[index * 4 + 3] = alpha[index];
    ctx.putImageData(pixels, 0, 0);
    setMessage(cleared ? "Cleared the stray specks." : "No stray specks found.");
    if (cleared) setChanged(true);
  }
  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStatus("saving");
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("The cutout could not be exported.");
      const form = new FormData();
      form.set("id", String(item.id));
      form.set("image", new File([blob], "cutout.png", { type: "image/png" }));
      const response = await fetch("/api/wardrobe/image", { method: "POST", body: form });
      const payload = (await response.json().catch(() => ({}))) as { image?: string; error?: string };
      if (!response.ok || !payload.image) throw new Error(payload.error || "That cutout could not be saved.");
      onSaved(item.id, payload.image);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That cutout could not be saved.");
      setStatus("ready");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Fix cutout</DialogTitle>
        <DialogDescription>
          Erase leftover background, or paint back parts of {item.name} that were cut off.
        </DialogDescription>
      </DialogHeader>
      <div className="cutout-stage">
        <canvas
          ref={canvasRef}
          className={`cutout-canvas tool-${tool}`}
          aria-label={`Cutout of ${item.name}`}
          onPointerDown={(event) => {
            if (status !== "ready") return;
            event.currentTarget.setPointerCapture(event.pointerId);
            snapshot();
            const at = point(event);
            drawingRef.current = at;
            stroke(at, at);
          }}
          onPointerMove={(event) => {
            if (!drawingRef.current) return;
            const at = point(event);
            stroke(drawingRef.current, at);
            drawingRef.current = at;
          }}
          onPointerUp={() => (drawingRef.current = null)}
          onPointerCancel={() => (drawingRef.current = null)}
        />
        {status === "loading" && <p className="cutout-status">Loading the cutout…</p>}
        {status === "error" && <p className="cutout-status">The cutout could not be loaded.</p>}
      </div>
      <div className="cutout-tools">
        <div className="view-switch" role="group" aria-label="Brush">
          <button
            className={tool === "erase" ? "active" : ""}
            aria-pressed={tool === "erase"}
            onClick={() => setTool("erase")}
          >
            <Eraser /> Erase
          </button>
          <button
            className={tool === "restore" ? "active" : ""}
            aria-pressed={tool === "restore"}
            onClick={() => setTool("restore")}
          >
            <Paintbrush /> Restore
          </button>
        </div>
        <label className="brush-size">
          Brush
          <input
            type="range"
            min={1}
            max={12}
            value={brush}
            onChange={(event) => setBrush(Number(event.target.value))}
          />
        </label>
        <Button variant="outline" size="sm" onClick={cleanSpecks} disabled={status !== "ready"}>
          <Sparkles /> Clear specks
        </Button>
        <Button variant="ghost" size="sm" onClick={undo} disabled={!historyLength}>
          <Undo2 /> Undo
        </Button>
      </div>
      {message && (
        <p className="cutout-status" role="status">
          {message}
        </p>
      )}
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={status === "saving"}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!changed || status !== "ready"}>
          {status === "saving" ? "Saving…" : "Save cutout"}
        </Button>
      </DialogFooter>
    </>
  );
}
