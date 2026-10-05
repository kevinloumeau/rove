/** Same-origin path the browser loads the clothing model from (see lib/local-wardrobe.ts). */
export const MODEL_PROXY_PREFIX = "/hf/";
export const CLOTHING_MODEL = "Xenova/segformer_b0_clothes";

const UPSTREAM = "https://huggingface.co/";
const FILE_PATTERN = /^[\w.-]+(\/[\w.-]+)*$/;

/**
 * Maps a proxied model path to its Hugging Face URL, or null when the path is not one of the
 * clothing model's files. Only that one model is served, so the Worker is not an open proxy.
 */
export function modelUpstreamUrl(pathname: string) {
  const prefix = `${MODEL_PROXY_PREFIX}${CLOTHING_MODEL}/resolve/main/`;
  if (!pathname.startsWith(prefix)) return null;
  const file = pathname.slice(prefix.length);
  if (!FILE_PATTERN.test(file) || file.split("/").includes("..")) return null;
  return `${UPSTREAM}${CLOTHING_MODEL}/resolve/main/${file}`;
}

/**
 * Serves the clothing model from this origin so photo import works even when the browser can't
 * reach huggingface.co directly (content blockers, strict networks). Files are cached at the edge.
 */
export async function handleModelRequest(request: Request, ctx: ExecutionContext) {
  const upstream = modelUpstreamUrl(new URL(request.url).pathname);
  if (!upstream) return new Response("Not found", { status: 404 });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  }

  // The DOM lib types `caches` without the Workers-only `default` cache.
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(upstream);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const response = await fetch(upstream, { redirect: "follow" });
  if (!response.ok) return new Response("Model file unavailable", { status: 502 });

  const headers = new Headers();
  for (const name of ["content-type", "content-length", "etag"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("cache-control", "public, max-age=604800");
  const result = new Response(response.body, { status: 200, headers });
  ctx.waitUntil(cache.put(cacheKey, result.clone()));
  return result;
}
