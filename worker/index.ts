import handler from "vinext/server/fetch-handler";

const worker: ExportedHandler<Cloudflare.Env> = {
  fetch(request, env, ctx) {
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
