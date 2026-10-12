"use client";

import { useCallback, useEffect, useState } from "react";
import { type DayWeather, forecastUrl, parseForecast } from "@/lib/weather";

const COORDS_KEY = "rove-weather-coords";

function usesFahrenheit() {
  return /^en-(US|LR)|^my\b/i.test(navigator.language);
}

export type Forecast = ReturnType<typeof useForecast>;

/**
 * The week's forecast for Outfit of the day and outfit ideas. It loads on its own once location was
 * shared before (saved rounded coordinates, or a browser that already allows location); otherwise
 * location is asked for only when the person taps "Show weather".
 */
export function useForecast() {
  const [days, setDays] = useState<DayWeather[]>([]);
  const [state, setState] = useState<"off" | "loading" | "ready" | "denied" | "error">("off");
  const [fahrenheit, setFahrenheit] = useState(false);

  // State is only set once the request settles, so this is safe to start from an effect.
  const load = useCallback((latitude: number, longitude: number) => {
    const imperial = usesFahrenheit();
    fetch(forecastUrl(latitude, longitude, imperial))
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("forecast"))))
      .then((payload) => {
        setFahrenheit(imperial);
        setDays(parseForecast(payload));
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  const locate = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        try {
          // Rounded to about 1 km; only used to look up the forecast.
          localStorage.setItem(
            COORDS_KEY,
            JSON.stringify([Number(coords.latitude.toFixed(2)), Number(coords.longitude.toFixed(2))]),
          );
        } catch {
          /* not remembered, asked again next visit */
        }
        load(coords.latitude, coords.longitude);
      },
      () => setState("denied"),
      { maximumAge: 3_600_000, timeout: 10_000 },
    );
  }, [load]);

  useEffect(() => {
    let saved: [number, number] | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(COORDS_KEY) ?? "null") as [number, number] | null;
    } catch {
      /* storage unavailable */
    }
    if (Array.isArray(saved) && saved.length === 2) {
      load(saved[0], saved[1]);
      return;
    }
    // Already allowed (say, from another tab): no prompt appears, so the forecast can just show.
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((status) => {
        if (status.state === "granted") locate();
      })
      .catch(() => undefined);
  }, [load, locate]);

  function ask() {
    if (!("geolocation" in navigator)) {
      setState("denied");
      return;
    }
    setState("loading");
    locate();
  }

  return { days, state, fahrenheit, ask };
}
