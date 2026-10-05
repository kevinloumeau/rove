"use client";

import { useEffect } from "react";

/** Registers public/sw.js in production so Rove can be installed and opened offline. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.warn("Rove could not enable offline mode.", error);
    });
  }, []);
  return null;
}
