// Saves shouldn't be lost to a dropped connection. Every write Rove retries is idempotent: PATCH
// and DELETE by id, wears with INSERT OR IGNORE, plans by date, and new looks by a client-made id.

const RETRY_STATUSES = new Set([429, 502, 503, 504]);

export type RetryOptions = {
  attempts?: number;
  /** Delay before retry N (1-based), in ms. */
  delay?: (attempt: number) => number;
  /** Resolves once the browser is back online, or right away when it already is. */
  waitForOnline?: () => Promise<void>;
  fetcher?: typeof fetch;
};

export function waitForOnline(timeoutMs = 60_000) {
  if (typeof navigator === "undefined" || navigator.onLine) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => {
      window.removeEventListener("online", done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    window.addEventListener("online", done);
  });
}

/** fetch() that retries network failures and gateway errors with backoff. */
export async function fetchWithRetry(url: string, init: RequestInit, options: RetryOptions = {}) {
  const {
    attempts = 4,
    delay = (attempt) => 1000 * 2 ** (attempt - 1),
    waitForOnline: online = waitForOnline,
    fetcher = fetch,
  } = options;
  for (let attempt = 1; ; attempt += 1) {
    await online();
    try {
      const response = await fetcher(url, init);
      if (!RETRY_STATUSES.has(response.status) || attempt >= attempts) return response;
    } catch (error) {
      if (attempt >= attempts || (error instanceof DOMException && error.name === "AbortError")) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delay(attempt)));
  }
}
