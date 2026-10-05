"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CloudSun, MapPin, Shuffle } from "lucide-react";
import { type DayWeather, forecastUrl, parseForecast, weatherHint, weatherLabel } from "@/lib/weather";
import type { SavedLook, WardrobeItem } from "@/lib/wardrobe-types";

const COORDS_KEY = "rove-weather-coords";

function usesFahrenheit() {
  return /^en-(US|LR)|^my\b/i.test(navigator.language);
}

/** Forecast for the week strip. Location is asked for only when the person taps "Show weather". */
function useForecast() {
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

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COORDS_KEY) ?? "null") as [number, number] | null;
      if (Array.isArray(saved) && saved.length === 2) load(saved[0], saved[1]);
    } catch {
      /* storage unavailable: weather stays off until asked */
    }
  }, [load]);

  function ask() {
    if (!("geolocation" in navigator)) {
      setState("denied");
      return;
    }
    setState("loading");
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
  }

  return { days, state, fahrenheit, ask };
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function mondayOf(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/** Home card: a Monday-to-Sunday strip and the look planned for the chosen day. */
export function OutfitOfTheDay({
  items,
  looks,
  plans,
  todayIso,
  onOpenLook,
  onPlanDay,
  onWear,
  onSurprise,
}: {
  items: WardrobeItem[];
  looks: SavedLook[];
  plans: Record<string, string>;
  todayIso: string;
  onOpenLook: (look: SavedLook) => void;
  onPlanDay: (date: string) => void;
  onWear: (pieces: WardrobeItem[]) => void;
  onSurprise: () => void;
}) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date(`${todayIso}T00:00:00`)));
  const [day, setDay] = useState(todayIso);
  const weather = useForecast();
  const dayWeather = weather.days.find((entry) => entry.date === day);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
  const look = looks.find((candidate) => candidate.id === plans[day]);
  const pieces = (look?.itemIds ?? [])
    .map((id) => items.find((item) => String(item.id) === String(id)))
    .filter((item): item is WardrobeItem => Boolean(item));
  const dayDate = new Date(`${day}T00:00:00`);
  const dayLabel = `${dayDate.toLocaleDateString(undefined, { weekday: "long" })} ${dayDate.getDate()}`;
  const wornToday = day === todayIso && pieces.length > 0 && pieces.every((piece) => piece.lastWorn === todayIso);

  function shiftWeek(offset: number) {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + offset * 7);
    setWeekStart(next);
    setDay(isoDate(next));
  }

  return (
    <section className="ootd" aria-label="Outfit of the day">
      <div className="week-strip">
        <button className="week-arrow" aria-label="Previous week" onClick={() => shiftWeek(-1)}>
          <ArrowLeft />
        </button>
        <ol>
          {days.map((date) => {
            const iso = isoDate(date);
            return (
              <li key={iso}>
                <button
                  className={`${iso === day ? "active" : ""} ${plans[iso] ? "planned" : ""} ${iso < todayIso ? "past" : ""}`}
                  aria-pressed={iso === day}
                  aria-label={date.toLocaleDateString(undefined, { dateStyle: "full" })}
                  onClick={() => setDay(iso)}
                >
                  {date.toLocaleDateString(undefined, { weekday: "narrow" })}
                </button>
                <span className={iso === todayIso ? "today" : ""}>{date.getDate()}</span>
              </li>
            );
          })}
        </ol>
        <button className="week-arrow" aria-label="Next week" onClick={() => shiftWeek(1)}>
          <ArrowRight />
        </button>
      </div>
      <h2 className="display-title">
        {day === todayIso ? "Outfit of the Day" : look ? "Planned look" : "Nothing yet"}
      </h2>
      <p className="ootd-date">
        {dayLabel}
        {look ? ` · ${look.name}` : ""}
      </p>
      {dayWeather ? (
        <p className="ootd-weather">
          <span>
            <CloudSun /> {dayWeather.high}° / {dayWeather.low}° · {weatherLabel(dayWeather.code)}
          </span>
          {weatherHint(dayWeather, weather.fahrenheit)}
        </p>
      ) : weather.state === "off" || weather.state === "error" ? (
        <button className="ootd-weather-ask" onClick={weather.ask}>
          <MapPin /> {weather.state === "error" ? "Weather unavailable, try again" : "Show weather"}
        </button>
      ) : weather.state === "loading" ? (
        <p className="ootd-weather muted">Checking the forecast…</p>
      ) : weather.state === "denied" ? (
        <p className="ootd-weather muted">Allow location to see the forecast here.</p>
      ) : null}
      {pieces.length ? (
        <button
          className="ootd-collage"
          data-count={Math.min(pieces.length, 4)}
          onClick={() => look && onOpenLook(look)}
        >
          {pieces.slice(0, 4).map((piece) => (
            <span key={piece.id}>
              <img src={piece.image} alt={piece.name} />
            </span>
          ))}
        </button>
      ) : (
        <p className="ootd-empty">
          {looks.length ? "No look planned for this day yet." : "Save a look on the Outfits tab, then plan it here."}
        </p>
      )}
      <div className="ootd-actions">
        {look && day === todayIso ? (
          <button className="primary" disabled={wornToday} onClick={() => onWear(pieces)}>
            <Check /> {wornToday ? "Worn today" : "Wear this today"}
          </button>
        ) : (
          <button className="primary" onClick={() => onPlanDay(day)}>
            <CalendarDays /> {look ? "Change plan" : "Plan this day"}
          </button>
        )}
        <button onClick={onSurprise} disabled={!items.length}>
          <Shuffle /> Surprise me
        </button>
      </div>
    </section>
  );
}
