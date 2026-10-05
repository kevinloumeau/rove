import assert from "node:assert/strict";
import { test } from "node:test";
import { crc32, createZip, ZipWriter } from "../lib/zip.ts";

test("crc32 matches the standard check values", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  assert.equal(crc32(new Uint8Array()), 0);
  const whole = crc32(new TextEncoder().encode("hello world"));
  const running = crc32(new TextEncoder().encode(" world"), crc32(new TextEncoder().encode("hello")));
  assert.equal(running, whole);
});

/** Reads a stored-only archive back through its central directory. */
function readZip(zip: Uint8Array) {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const eocd = zip.length - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054b50);
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  assert.equal(at + view.getUint32(eocd + 12, true), eocd);
  const entries: Array<{ name: string; data: Uint8Array }> = [];
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(at, true), 0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength));
    assert.equal(view.getUint32(offset, true), 0x04034b50);
    assert.equal(view.getUint16(offset + 8, true), 0, "stored, not compressed");
    assert.equal(view.getUint32(offset + 14, true), crc);
    const localNameLength = view.getUint16(offset + 26, true);
    const start = offset + 30 + localNameLength + view.getUint16(offset + 28, true);
    const data = zip.subarray(start, start + size);
    assert.equal(crc32(data), crc);
    entries.push({ name, data });
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return entries;
}

test("createZip round-trips text and binary entries", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 255, 128]);
  const zip = createZip([
    { name: "closet.json", data: JSON.stringify({ items: [{ name: "Café jacket" }] }) },
    { name: "images/a.png", data: png, modified: new Date(Date.UTC(2026, 9, 5, 12, 30, 10)) },
  ]);
  const entries = readZip(zip);
  assert.deepEqual(
    entries.map((entry) => entry.name),
    ["closet.json", "images/a.png"],
  );
  assert.deepEqual(JSON.parse(new TextDecoder().decode(entries[0].data)), { items: [{ name: "Café jacket" }] });
  assert.deepEqual([...entries[1].data], [...png]);

  // DOS date/time for 2026-10-05 12:30:10 UTC on the second local header.
  const view = new DataView(zip.buffer);
  const second = 30 + "closet.json".length + entries[0].data.length;
  assert.equal(view.getUint16(second + 10, true), (12 << 11) | (30 << 5) | 5);
  assert.equal(view.getUint16(second + 12, true), (46 << 9) | (10 << 5) | 5);
});

test("an empty archive is just the end record", () => {
  const zip = createZip([]);
  assert.equal(zip.length, 22);
  assert.deepEqual(readZip(zip), []);
});

test("ZipWriter rejects duplicate names", () => {
  const writer = new ZipWriter();
  writer.add("a.txt", "one");
  assert.throws(() => writer.add("a.txt", "two"), /Duplicate/);
});
