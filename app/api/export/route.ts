import { apiError, getWardrobeBindings, requireApiUser } from "@/lib/wardrobe-backend";
import { ZipWriter } from "@/lib/zip";

export const dynamic = "force-dynamic";

/**
 * Downloads the signed-in user's closet as a ZIP: closet.json with their pieces, looks and plans,
 * plus every piece's image under images/. Images are read from R2 one at a time as the archive
 * streams out, so only one image is held in memory at once.
 */
export async function GET() {
  try {
    const user = await requireApiUser();
    const { db, bucket } = getWardrobeBindings();
    const [items, outfits, plans] = await db.batch<Record<string, unknown>>([
      db.prepare(`SELECT * FROM wardrobe_items WHERE user_id = ? ORDER BY created_at`).bind(user.userId),
      db.prepare(`SELECT * FROM wardrobe_outfits WHERE user_id = ? ORDER BY created_at`).bind(user.userId),
      db.prepare(`SELECT * FROM wardrobe_plans WHERE user_id = ? ORDER BY planned_date`).bind(user.userId),
    ]);
    const exportedAt = new Date();
    const imageKeys = [...new Set(items.results.map((row) => String(row.image_key ?? "")).filter(Boolean))];
    const closet = {
      app: "Rove",
      version: 1,
      exportedAt: exportedAt.toISOString(),
      user: { email: user.email },
      // Each piece's image_key is its file name under images/ in this archive.
      items: items.results,
      outfits: outfits.results,
      plans: plans.results,
    };

    const zip = new ZipWriter();
    let next = 0;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(zip.add("closet.json", JSON.stringify(closet, null, 2), exportedAt));
      },
      async pull(controller) {
        while (next < imageKeys.length) {
          const key = imageKeys[next++];
          const object = await bucket.get(key);
          if (!object) continue;
          controller.enqueue(zip.add(`images/${key}`, new Uint8Array(await object.arrayBuffer()), object.uploaded));
          return;
        }
        controller.enqueue(zip.finish());
        controller.close();
      },
    });

    const filename = `rove-backup-${exportedAt.toISOString().slice(0, 10)}.zip`;
    return new Response(stream, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error, "Your backup could not be created. Try again.");
  }
}
