/** Which Worker a build or deploy targets: the real app, or rove-preview with its own database and bucket. */
export type DeployTarget = "production" | "preview";

/**
 * Workers Builds sets WORKERS_CI_BRANCH on every build. Any branch other than the production branch
 * goes to rove-preview, so a branch can never deploy to, or migrate, the real closet. Outside Workers
 * Builds (a laptop, GitHub Actions) the target is production unless CLOUDFLARE_ENV asks for preview.
 */
export function deployTarget(env: Record<string, string | undefined>): DeployTarget {
  if (env.CLOUDFLARE_ENV === "preview") return "preview";
  const branch = env.WORKERS_CI_BRANCH;
  const productionBranch = env.PRODUCTION_BRANCH || "main";
  if (branch && branch !== productionBranch) return "preview";
  return "production";
}

/** The Worker name each target's build must produce (top level and env.preview in wrangler.jsonc). */
export const workerName: Record<DeployTarget, string> = { production: "rove", preview: "rove-preview" };
