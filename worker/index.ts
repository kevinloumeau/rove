import handler from "vinext/server/fetch-handler";
import { MODEL_PROXY_PREFIX, handleModelRequest } from "../lib/model-proxy";

const worker: ExportedHandler<Cloudflare.Env> = {
  fetch(request, env, ctx) {
    if (new URL(request.url).pathname.startsWith(MODEL_PROXY_PREFIX)) return handleModelRequest(request, ctx);
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
