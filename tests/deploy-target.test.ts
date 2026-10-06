import assert from "node:assert/strict";
import { test } from "node:test";
import { deployTarget } from "../scripts/deploy-target.ts";

test("main on Workers Builds deploys the real app", () => {
  assert.equal(deployTarget({ WORKERS_CI_BRANCH: "main" }), "production");
});

test("any other branch on Workers Builds goes to rove-preview", () => {
  assert.equal(deployTarget({ WORKERS_CI_BRANCH: "claude/new-thing" }), "preview");
  assert.equal(deployTarget({ WORKERS_CI_BRANCH: "mainline" }), "preview");
});

test("outside Workers Builds the target is production unless CLOUDFLARE_ENV asks for preview", () => {
  assert.equal(deployTarget({}), "production");
  assert.equal(deployTarget({ CLOUDFLARE_ENV: "preview" }), "preview");
});

test("PRODUCTION_BRANCH overrides main", () => {
  assert.equal(deployTarget({ WORKERS_CI_BRANCH: "release", PRODUCTION_BRANCH: "release" }), "production");
  assert.equal(deployTarget({ WORKERS_CI_BRANCH: "main", PRODUCTION_BRANCH: "release" }), "preview");
});
