"use client";

import { useEffect } from "react";

const MAX_REPORTS = 5;

/** Sends uncaught browser errors to the Worker's logs, a few per page load at most. */
export function ErrorReporter() {
  useEffect(() => {
    const seen = new Set<string>();
    const report = (error: unknown, fallback: string) => {
      const message = error instanceof Error ? error.message : String(error ?? fallback);
      if (seen.size >= MAX_REPORTS || seen.has(message)) return;
      seen.add(message);
      void fetch("/api/client-errors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          message,
          stack: error instanceof Error ? error.stack : undefined,
          page: window.location.pathname + window.location.search,
        }),
      }).catch(() => {});
    };
    const onError = (event: ErrorEvent) => report(event.error ?? event.message, "Unknown error");
    const onRejection = (event: PromiseRejectionEvent) => report(event.reason, "Unhandled rejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
