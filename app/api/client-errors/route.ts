import { apiError, requireApiUser } from "@/lib/wardrobe-backend";

export const dynamic = "force-dynamic";

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

/** Writes a browser error to the Worker's logs (Workers & Pages > rove > Logs). */
export async function POST(request: Request) {
  try {
    await requireApiUser();
    const raw = await request.text();
    if (raw.length > 16_000) return Response.json({ error: "Too large." }, { status: 413 });
    const payload = JSON.parse(raw || "{}") as Record<string, unknown>;
    console.error("Client error", {
      message: text(payload.message, 500),
      stack: text(payload.stack, 4000),
      page: text(payload.page, 300),
      userAgent: text(request.headers.get("user-agent"), 300),
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error, "That error could not be reported.");
  }
}
