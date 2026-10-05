// A minimal ZIP writer: stored entries only (no compression), no ZIP64, UTF-8 names.
// Images are already compressed, so storing them keeps the archive small without a deflate
// implementation. Kept free of imports so `node --test` can load it directly.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (IEEE 802.3), as ZIP uses. Pass a previous result as `crc` to continue a running checksum. */
export function crc32(data: Uint8Array, crc = 0): number {
  let c = (crc ^ 0xffffffff) >>> 0;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date) {
  const year = Math.max(1980, date.getUTCFullYear());
  return {
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  };
}

type CentralRecord = { name: Uint8Array; crc: number; size: number; offset: number; time: number; date: number };

/**
 * Writes a ZIP archive one entry at a time, so callers can stream entries out as they are produced.
 * `add` returns the bytes for that entry; `finish` returns the central directory.
 */
export class ZipWriter {
  private records: CentralRecord[] = [];
  private offset = 0;
  private names = new Set<string>();

  add(name: string, data: Uint8Array | string, modified = new Date()): Uint8Array {
    if (this.names.has(name)) throw new Error(`Duplicate ZIP entry: ${name}`);
    this.names.add(name);
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const encodedName = new TextEncoder().encode(name);
    const { time, date } = dosDateTime(modified);
    const crc = crc32(bytes);
    if (bytes.length > 0xffffffff || this.offset > 0xffffffff) throw new Error("ZIP archive too large.");

    const out = new Uint8Array(30 + encodedName.length + bytes.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, 0x04034b50, true); // local file header signature
    view.setUint16(4, 20, true); // version needed to extract (2.0)
    view.setUint16(6, 0x0800, true); // flags: UTF-8 names
    view.setUint16(8, 0, true); // method: stored
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, bytes.length, true); // compressed size
    view.setUint32(22, bytes.length, true); // uncompressed size
    view.setUint16(26, encodedName.length, true);
    view.setUint16(28, 0, true); // extra field length
    out.set(encodedName, 30);
    out.set(bytes, 30 + encodedName.length);

    this.records.push({ name: encodedName, crc, size: bytes.length, offset: this.offset, time, date });
    this.offset += out.length;
    return out;
  }

  finish(): Uint8Array {
    const centralSize = this.records.reduce((sum, record) => sum + 46 + record.name.length, 0);
    const out = new Uint8Array(centralSize + 22);
    const view = new DataView(out.buffer);
    let at = 0;
    for (const record of this.records) {
      view.setUint32(at, 0x02014b50, true); // central directory header signature
      view.setUint16(at + 4, 20, true); // version made by
      view.setUint16(at + 6, 20, true); // version needed
      view.setUint16(at + 8, 0x0800, true);
      view.setUint16(at + 10, 0, true);
      view.setUint16(at + 12, record.time, true);
      view.setUint16(at + 14, record.date, true);
      view.setUint32(at + 16, record.crc, true);
      view.setUint32(at + 20, record.size, true);
      view.setUint32(at + 24, record.size, true);
      view.setUint16(at + 28, record.name.length, true);
      // extra length, comment length, disk number, internal attrs, external attrs stay 0
      view.setUint32(at + 42, record.offset, true);
      out.set(record.name, at + 46);
      at += 46 + record.name.length;
    }
    if (this.records.length > 0xffff) throw new Error("Too many ZIP entries.");
    view.setUint32(at, 0x06054b50, true); // end of central directory signature
    view.setUint16(at + 8, this.records.length, true); // entries on this disk
    view.setUint16(at + 10, this.records.length, true); // total entries
    view.setUint32(at + 12, centralSize, true);
    view.setUint32(at + 16, this.offset, true); // central directory offset
    return out;
  }
}

/** Builds a whole archive in memory. */
export function createZip(entries: Array<{ name: string; data: Uint8Array | string; modified?: Date }>): Uint8Array {
  const writer = new ZipWriter();
  const parts = entries.map((entry) => writer.add(entry.name, entry.data, entry.modified));
  parts.push(writer.finish());
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
