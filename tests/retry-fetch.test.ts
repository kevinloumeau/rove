import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchWithRetry } from "../lib/retry-fetch.ts";

const fast = { delay: () => 0, waitForOnline: async () => {} };

function scripted(outcomes: Array<number | Error>) {
  const calls: string[] = [];
  const fetcher = (async (url: string) => {
    calls.push(url);
    const next = outcomes.shift();
    if (next instanceof Error) throw next;
    return new Response(null, { status: next ?? 200 });
  }) as typeof fetch;
  return { calls, fetcher };
}

test("retries a dropped connection until it gets through", async () => {
  const { calls, fetcher } = scripted([new TypeError("Failed to fetch"), 503, 200]);
  const response = await fetchWithRetry("/api/x", {}, { ...fast, fetcher });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 3);
});

test("returns client errors without retrying", async () => {
  const { calls, fetcher } = scripted([400]);
  assert.equal((await fetchWithRetry("/api/x", {}, { ...fast, fetcher })).status, 400);
  assert.equal(calls.length, 1);
});

test("gives up after the last attempt", async () => {
  const { calls, fetcher } = scripted([502, 502, 502]);
  assert.equal((await fetchWithRetry("/api/x", {}, { ...fast, attempts: 3, fetcher })).status, 502);
  assert.equal(calls.length, 3);
  const failing = scripted([new TypeError("a"), new TypeError("b")]);
  await assert.rejects(fetchWithRetry("/api/x", {}, { ...fast, attempts: 2, fetcher: failing.fetcher }), /b/);
});
