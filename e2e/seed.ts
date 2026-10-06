import { deflateSync } from "node:zlib";
import type { APIRequestContext } from "@playwright/test";

type Rgb = [number, number, number];

// A PNG drawn pixel by pixel, so tests need no image fixtures.
function png(size: number, pixel: (x: number, y: number) => Rgb) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes: Buffer) => {
    let c = 0xffffffff;
    for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  const rows = Array.from({ length: size }, (_, y) =>
    Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, (_, x) => pixel(x, y)).flat())]),
  );
  const pixels = deflateSync(Buffer.concat(rows));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", pixels),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// A solid-color PNG, so seeding skips the in-browser cutout model.
function solidPng(size: number, color: Rgb) {
  return png(size, () => color);
}

// Stands in for a Workers AI studio photo: a piece with a white logo on a white backdrop.
export function studioShotPng(size: number, color: Rgb) {
  return png(size, (x, y) => {
    const inPiece = x > size * 0.3 && x < size * 0.7 && y > size * 0.2 && y < size * 0.8;
    const inLogo = Math.abs(x - size / 2) < size * 0.06 && Math.abs(y - size * 0.4) < size * 0.06;
    return inPiece && !inLogo ? color : [255, 255, 255];
  });
}

export type SeedPiece = { name: string; category: string; color: string; rgb: Rgb; season?: string };

// Adds pieces through the same two API calls the upload dialog makes.
export async function seedPieces(request: APIRequestContext, pieces: SeedPiece[]) {
  const multipart: Record<string, { name: string; mimeType: string; buffer: Buffer } | string> = {
    image: { name: "seed.png", mimeType: "image/png", buffer: solidPng(48, [240, 240, 240]) },
    manifest: JSON.stringify(pieces.map(({ name, category, color, season }) => ({ name, category, color, season }))),
  };
  pieces.forEach((piece, index) => {
    multipart[`cutout-${index}`] = {
      name: `cutout-${index}.png`,
      mimeType: "image/png",
      buffer: solidPng(48, piece.rgb),
    };
  });
  const imported = await request.post("/api/wardrobe/import", { multipart });
  if (!imported.ok()) throw new Error(`import failed: ${imported.status()} ${await imported.text()}`);
  const { importId, items } = (await imported.json()) as { importId: string; items: Array<{ id: string }> };
  const confirmed = await request.post("/api/wardrobe", { data: { importId, itemIds: items.map((item) => item.id) } });
  if (!confirmed.ok()) throw new Error(`confirm failed: ${confirmed.status()} ${await confirmed.text()}`);
}
