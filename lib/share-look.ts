"use client";

const WIDTH = 1080;
const HEIGHT = 1350;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

/** Cells for 1 to 6 pieces inside the content box, as [x, y, w, h]. */
function layout(count: number, x: number, y: number, w: number, h: number): Array<[number, number, number, number]> {
  const gap = 24;
  if (count <= 1) return [[x, y, w, h]];
  if (count === 2) return [0, 1].map((row) => [x, y + row * ((h + gap) / 2), w, (h - gap) / 2]);
  const rows = Math.ceil(count / 2);
  const cellH = (h - gap * (rows - 1)) / rows;
  const cellW = (w - gap) / 2;
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / 2);
    // An odd last piece gets the full width.
    const alone = count % 2 === 1 && index === count - 1;
    return [alone ? x : x + (index % 2) * (cellW + gap), y + row * (cellH + gap), alone ? w : cellW, cellH];
  });
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  context.beginPath();
  context.roundRect(x, y, w, h, r);
  context.fill();
}

/** Draws a 1080x1350 PNG card of the look: its name, the pieces on white tiles, and a footer. */
export async function renderLookImage(title: string, subtitle: string, imageUrls: string[]) {
  await document.fonts?.load('104px "Instrument Serif"').catch(() => undefined);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot draw images.");

  context.fillStyle = "#f3eee8";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = "#1c1917";
  context.textAlign = "center";
  context.font = '104px "Instrument Serif", Georgia, serif';
  context.fillText(title, WIDTH / 2, 150, WIDTH - 120);
  context.fillStyle = "#6b6259";
  context.font = '36px "Avenir Next", Avenir, "Helvetica Neue", Arial, sans-serif';
  context.fillText(subtitle, WIDTH / 2, 210, WIDTH - 120);

  const images = (await Promise.all(imageUrls.slice(0, 6).map((url) => loadImage(url).catch(() => null)))).filter(
    (image): image is HTMLImageElement => Boolean(image),
  );
  for (const [index, [x, y, w, h]] of layout(images.length, 70, 260, WIDTH - 140, HEIGHT - 380).entries()) {
    const image = images[index];
    context.fillStyle = "#ffffff";
    roundRect(context, x, y, w, h, 36);
    const pad = Math.min(w, h) * 0.1;
    const scale = Math.min((w - pad * 2) / image.width, (h - pad * 2) / image.height);
    const dw = image.width * scale;
    const dh = image.height * scale;
    context.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  context.fillStyle = "#6750d0";
  context.font = '600 30px "Avenir Next", Avenir, "Helvetica Neue", Arial, sans-serif';
  context.fillText("Styled with Rove ✨", WIDTH / 2, HEIGHT - 50);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The image could not be created.");
  return blob;
}

/** Opens the share sheet with the image where the browser supports it, otherwise downloads it. */
export async function shareLookImage(blob: Blob, fileName: string, title: string) {
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared" as const;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled" as const;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded" as const;
}
