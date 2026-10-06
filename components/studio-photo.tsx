"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { makeThumbnail } from "@/lib/photo-resize";
import { studioCutout, studioInput } from "@/lib/studio-photo-client";
import type { WardrobeItem } from "@/lib/wardrobe-types";

/** Redraws a piece as a clean product shot, shows it beside the current cutout, and saves it on request. */
export function StudioPhoto({
  item,
  onOpenChange,
  onSaved,
}: {
  item: WardrobeItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (id: WardrobeItem["id"], image: string, thumb?: string) => void;
}) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="studio-dialog">
        {item && <Studio key={String(item.id)} item={item} onCancel={() => onOpenChange(false)} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

type Status = "working" | "ready" | "error" | "saving";

function Studio({
  item,
  onCancel,
  onSaved,
}: {
  item: WardrobeItem;
  onCancel: () => void;
  onSaved: (id: WardrobeItem["id"], image: string, thumb?: string) => void;
}) {
  const [status, setStatus] = useState<Status>("working");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; url: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const resultUrl = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function generate() {
      setStatus("working");
      setMessage(null);
      try {
        const form = new FormData();
        form.set("id", String(item.id));
        form.set("image", new File([await studioInput(item.image)], "piece.jpg", { type: "image/jpeg" }));
        const response = await fetch("/api/wardrobe/studio", { method: "POST", body: form });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error || "The studio photo could not be made. Try again.");
        }
        const cutout = await studioCutout(await response.blob());
        if (cancelled) return;
        if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
        resultUrl.current = URL.createObjectURL(cutout);
        setResult({ blob: cutout, url: resultUrl.current });
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "The studio photo could not be made. Try again.");
        setStatus("error");
      }
    }
    void generate();
    return () => {
      cancelled = true;
    };
  }, [item.id, item.image, attempt]);

  useEffect(
    () => () => {
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    },
    [],
  );

  async function save() {
    if (!result) return;
    setStatus("saving");
    try {
      const form = new FormData();
      form.set("id", String(item.id));
      form.set("image", new File([result.blob], "studio.png", { type: "image/png" }));
      const thumb = await makeThumbnail(result.blob);
      if (thumb) form.set("thumb", new File([thumb], "thumb.webp", { type: "image/webp" }));
      const response = await fetch("/api/wardrobe/image", { method: "POST", body: form });
      const payload = (await response.json().catch(() => ({}))) as {
        image?: string;
        thumb?: string | null;
        error?: string;
      };
      if (!response.ok || !payload.image) throw new Error(payload.error || "That photo could not be saved.");
      onSaved(item.id, payload.image, payload.thumb ?? undefined);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That photo could not be saved.");
      setStatus("ready");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Studio photo</DialogTitle>
        <DialogDescription>
          Rove redraws {item.name} as a clean product shot. Compare, then keep whichever you like.
        </DialogDescription>
      </DialogHeader>
      <div className="studio-compare">
        <figure>
          <div className="studio-frame">
            <img src={item.image} alt={`Current photo of ${item.name}`} />
          </div>
          <figcaption>Current</figcaption>
        </figure>
        <figure>
          <div className="studio-frame" aria-busy={status === "working"}>
            {result && status !== "working" ? (
              <img src={result.url} alt={`Studio photo of ${item.name}`} />
            ) : status === "working" ? (
              <p className="studio-working">
                <Sparkles /> Styling the shot…
              </p>
            ) : null}
          </div>
          <figcaption>Studio</figcaption>
        </figure>
      </div>
      {message && (
        <p className="cutout-status" role="status">
          {message}
        </p>
      )}
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={status === "saving"}>
          Keep current
        </Button>
        <Button
          variant="outline"
          onClick={() => setAttempt((value) => value + 1)}
          disabled={status === "working" || status === "saving"}
        >
          <RefreshCw /> Try again
        </Button>
        <Button onClick={save} disabled={!result || status !== "ready"}>
          {status === "saving" ? "Saving…" : "Use studio photo"}
        </Button>
      </DialogFooter>
    </>
  );
}
