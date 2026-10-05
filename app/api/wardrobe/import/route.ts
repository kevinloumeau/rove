import {
  ALLOWED_IMAGE_TYPES,
  apiError,
  assetUrl,
  getWardrobeBindings,
  MAX_UPLOAD_BYTES,
  requireApiUser,
} from "@/lib/wardrobe-backend";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let importId: string | null = null;
  let userId: string | null = null;
  try {
    const user = await requireApiUser();
    userId = user.userId;
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return Response.json({ error: "Choose an image to upload." }, { status: 400 });
    if (!ALLOWED_IMAGE_TYPES.has(file.type))
      return Response.json({ error: "Use a JPEG, PNG, or WebP image." }, { status: 415 });
    if (!file.size || file.size > MAX_UPLOAD_BYTES)
      return Response.json({ error: "Choose an image smaller than 12 MB." }, { status: 413 });
    const rawManifest = form.get("manifest");
    if (typeof rawManifest !== "string")
      return Response.json({ error: "Process the photo on this device before uploading it." }, { status: 400 });
    let manifest: Array<{
      name?: string;
      category?: string;
      color?: string;
      season?: string;
      description?: string;
      tags?: string[];
    }>;
    try {
      manifest = JSON.parse(rawManifest);
    } catch {
      return Response.json({ error: "The locally processed clothing details were not valid." }, { status: 400 });
    }
    if (!Array.isArray(manifest) || !manifest.length || manifest.length > 8)
      return Response.json({ error: "Choose a photo containing one to eight visible pieces." }, { status: 400 });

    const { db, bucket } = getWardrobeBindings();
    importId = crypto.randomUUID();
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const originalKey = `${crypto.randomUUID()}.${extension}`;
    const now = Date.now();
    await bucket.put(originalKey, file.stream(), {
      httpMetadata: { contentType: file.type, cacheControl: "private, max-age=3600" },
      customMetadata: { owner: user.userId, importId },
    });
    await db
      .prepare(
        `
      INSERT INTO wardrobe_imports (id, user_id, original_key, file_name, mime_type, status, detected_count, created_at)
      VALUES (?, ?, ?, ?, ?, 'processing', 0, ?)
    `,
      )
      .bind(importId, user.userId, originalKey, file.name || "wardrobe-upload", file.type, now)
      .run();

    const allowedCategories = new Set(["Tops", "Bottoms", "Outerwear", "Dresses", "Shoes", "Accessories", "Other"]);
    const itemRows = [] as Array<{
      id: string;
      importId: string;
      name: string;
      category: string;
      color: string;
      season: string;
      description: string;
      image: string;
      favorite: boolean;
      tags: string[];
    }>;
    const statements = [];
    let cleanedCount = 0;
    for (let index = 0; index < manifest.length; index += 1) {
      const garment = manifest[index];
      const generated = form.get(`cutout-${index}`);
      let imageKey = originalKey;
      if (
        generated instanceof File &&
        generated.type === "image/png" &&
        generated.size > 0 &&
        generated.size <= 8 * 1024 * 1024
      ) {
        imageKey = `${crypto.randomUUID()}.png`;
        await bucket.put(imageKey, generated.stream(), {
          httpMetadata: { contentType: "image/png", cacheControl: "private, max-age=3600" },
          customMetadata: { owner: user.userId, importId, generated: "local" },
        });
        cleanedCount += 1;
      }
      const id = crypto.randomUUID();
      const category = allowedCategories.has(garment.category ?? "") ? garment.category! : "Other";
      const name = (garment.name || `${category} piece`).slice(0, 120);
      const color = (garment.color || "Multicolor").slice(0, 80);
      const season = (garment.season || "All season").slice(0, 80);
      const description = (
        garment.description || `${color} ${category.toLowerCase()} isolated locally from the uploaded photo.`
      ).slice(0, 600);
      const tags = Array.isArray(garment.tags)
        ? garment.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 8)
        : [];
      statements.push(
        db
          .prepare(
            `
        INSERT INTO wardrobe_items (id, user_id, import_id, name, category, color, season, description, image_key, tags, favorite, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'draft', ?)
      `,
          )
          .bind(
            id,
            user.userId,
            importId,
            name,
            category,
            color,
            season,
            description,
            imageKey,
            JSON.stringify(tags),
            now + index,
          ),
      );
      itemRows.push({
        id,
        importId,
        name,
        category,
        color,
        season,
        description,
        image: assetUrl(imageKey),
        favorite: false,
        tags,
      });
    }
    statements.push(
      db
        .prepare(`UPDATE wardrobe_imports SET status = 'review', detected_count = ? WHERE id = ? AND user_id = ?`)
        .bind(itemRows.length, importId, user.userId),
    );
    await db.batch(statements);
    return Response.json({ importId, items: itemRows, localProcessing: true, cleanedCount }, { status: 201 });
  } catch (error) {
    if (importId && userId) {
      try {
        const { db } = getWardrobeBindings();
        await db
          .prepare(`UPDATE wardrobe_imports SET status = 'failed' WHERE id = ? AND user_id = ?`)
          .bind(importId, userId)
          .run();
      } catch {
        /* preserve the original failure */
      }
    }
    return apiError(error, "Rove could not analyze that photo. Try another image.");
  }
}
