import { spawnSync } from "node:child_process";
import { deployTarget } from "./deploy-target.ts";

// Builds for the Worker this branch deploys to. The build output carries that Worker's name and
// bindings, and `wrangler deploy` / `wrangler versions upload` read it, so a branch build can only
// ever reach rove-preview.
const target = deployTarget(process.env);
const env = { ...process.env };
if (target === "preview") env.CLOUDFLARE_ENV = "preview";
console.log(
  `Building for ${target}${process.env.WORKERS_CI_BRANCH ? ` (branch ${process.env.WORKERS_CI_BRANCH})` : ""}`,
);

const result = spawnSync("npx", ["vinext", "build"], { stdio: "inherit", env });
process.exit(result.status ?? 1);
