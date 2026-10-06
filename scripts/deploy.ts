import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { deployTarget, workerName } from "./deploy-target.ts";

// Applies pending D1 migrations, then deploys. Production on main, rove-preview on any other branch.
const target = deployTarget(process.env);
const expected = workerName[target];

// `wrangler deploy` follows the build output, but `wrangler d1 migrations apply` reads wrangler.jsonc
// directly. Refuse to go on if the two would disagree, rather than migrate one database and deploy
// against another.
let built: string | undefined;
try {
  built = JSON.parse(readFileSync("dist/server/wrangler.json", "utf8")).name;
} catch {
  console.error("No build output found. Run `npm run build` first.");
  process.exit(1);
}
if (built !== expected) {
  console.error(`The build is for ${built}, but this deploy targets ${expected} (${target}). Rebuild first.`);
  process.exit(1);
}

function run(args: string[]) {
  console.log(`> wrangler ${args.join(" ")}`);
  const result = spawnSync("npx", ["wrangler", ...args], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["d1", "migrations", "apply", "DB", "--remote", ...(target === "preview" ? ["--env", "preview"] : [])]);
run(["deploy"]);
