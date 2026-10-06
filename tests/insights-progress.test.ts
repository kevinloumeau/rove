import assert from "node:assert/strict";
import { test } from "node:test";
import { insightStage, nextStep } from "../lib/insights-progress.ts";

const piece = (name: string, wearCount = 0) => ({ id: name, name, wearCount });

test("rotation insights unlock after three wears", () => {
  assert.deepEqual(insightStage([piece("a"), piece("b", 2)]), {
    totalWears: 2,
    rotationUnlocked: false,
    wearsToGo: 1,
    showRecommendations: false,
  });
  assert.equal(insightStage([piece("a", 1), piece("b", 2)]).rotationUnlocked, true);
});

test("the next step moves from logging wears to looks to first outings", () => {
  assert.deepEqual(nextStep([piece("a")], 0), { kind: "log-wears", wearsToGo: 3 });
  assert.deepEqual(nextStep([piece("a", 3)], 0), { kind: "save-look" });
  assert.deepEqual(nextStep([piece("a", 3), piece("b")], 1), { kind: "first-outing", piece: piece("b") });
  assert.deepEqual(nextStep([piece("a", 3)], 1), { kind: "all-worn" });
});
