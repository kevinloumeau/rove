import handler from "vinext/server/fetch-handler";
import { MODEL_PROXY_PREFIX, handleModelRequest } from "../lib/model-proxy";
import { cleanupStaleImports } from "../lib/storage-cleanup";

const worker: ExportedHandler<Cloudflare.Env> = {
  fetch(request, env, ctx) {
    if (new URL(request.url).pathname.startsWith(MODEL_PROXY_PREFIX)) return handleModelRequest(request, ctx);
    return handler.fetch(request, env, ctx);
  },
  // Nightly (see "triggers" in wrangler.jsonc): clear abandoned imports and their files.
  scheduled(_controller, env, ctx) {
    if (!env.DB || !env.BUCKET) return;
    ctx.waitUntil(
      cleanupStaleImports(env.DB, env.BUCKET).then((result) => console.log("Cleaned up stale imports", result)),
    );
  },
};

export default worker;
