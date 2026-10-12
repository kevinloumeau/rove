import assert from "node:assert/strict";
import { test } from "node:test";
import { checkinStep } from "../lib/evening-checkin.ts";

const base = {
  hour: 19,
  today: "2026-10-12",
  closetSize: 9,
  wornToday: false,
  ratedToday: false,
  dismissedOn: null,
};

test("asks what you wore in the evening, then how it felt", () => {
  assert.equal(checkinStep(base), "log");
  assert.equal(checkinStep({ ...base, wornToday: true }), "rate");
  assert.equal(checkinStep({ ...base, wornToday: true, ratedToday: true }), null);
});

test("stays hidden before 5 pm, with an empty closet, or once dismissed today", () => {
  assert.equal(checkinStep({ ...base, hour: 16 }), null);
  assert.equal(checkinStep({ ...base, closetSize: 0 }), null);
  assert.equal(checkinStep({ ...base, dismissedOn: "2026-10-12" }), null);
  assert.equal(checkinStep({ ...base, dismissedOn: "2026-10-11" }), "log");
});
