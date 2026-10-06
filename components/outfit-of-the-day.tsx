"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Heart,
  MapPin,
  Shuffle,
} from "lucide-react";
import { type DayWeather, forecastUrl, parseForecast, weatherEmoji, weatherHint, weatherLabel } from "@/lib/weather";
import type { SavedLook, WardrobeItem } from "@/lib/wardrobe-types";

const COORDS_KEY = "rove-weather-coords";
const COLLAPSED_KEY = "rove-ootd-collapsed";

/** Whether the card starts folded. Read once per page load, so using the card folds it from the next visit on. */
function storedCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}
function rememberCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* not remembered: the card opens again next visit */
  }
}
const noSubscribe = () => () => {};

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
  lovedLook,
  onStyle,
}: {
  items: WardrobeItem[];
  looks: SavedLook[];
  plans: Record<string, string>;
  todayIso: string;
  onOpenLook: (look: SavedLook) => void;
  onPlanDay: (date: string) => void;
  onWear: (pieces: WardrobeItem[]) => void;
  onSurprise: () => void;
  /** A loved outfit from the journal to suggest when today has no plan. */
  lovedLook?: { date: string; pieces: WardrobeItem[] } | null;
  /** Opens pieces on the outfit canvas. */
  onStyle?: (pieces: WardrobeItem[]) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date(`${todayIso}T00:00:00`)));
  const [day, setDay] = useState(todayIso);
  const weather = useForecast();
  const startsCollapsed = useSyncExternalStore(noSubscribe, storedCollapsed, () => false);
  const [collapsedChoice, setCollapsedChoice] = useState<boolean | null>(null);
  const collapsed = collapsedChoice ?? startsCollapsed;
  const dayWeather = weather.days.find((entry) => entry.date === day);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
  const look = looks.find((candidate) => candidate.id === plans[day]);
  // With nothing planned today, suggest wearing a loved outfit from the journal again.
  const again = !look && day === todayIso && lovedLook ? lovedLook : null;
  const pieces = again
    ? again.pieces
    : (look?.itemIds ?? [])
        .map((id) => items.find((item) => String(item.id) === String(id)))
        .filter((item): item is WardrobeItem => Boolean(item));
  const dayDate = new Date(`${day}T00:00:00`);
  const dayLabel = `${dayDate.toLocaleDateString(undefined, { weekday: "long" })} ${dayDate.getDate()}`;
  const wornToday =
    day === todayIso && (look || again) && pieces.length > 0 && pieces.every((piece) => piece.lastWorn === todayIso);

  function setCollapsed(next: boolean) {
    setCollapsedChoice(next);
    rememberCollapsed(next);
  }
  /** After the first real use the card folds away on later visits, leaving room for the closet. */
  function used<T extends unknown[]>(action: (...args: T) => void) {
    return (...args: T) => {
      if (collapsedChoice === null) rememberCollapsed(true);
      action(...args);
    };
  }

  function shiftWeek(offset: number) {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + offset * 7);
    setWeekStart(next);
    setDay(isoDate(next));
  }

  const todayLook = looks.find((candidate) => candidate.id === plans[todayIso]);
  const todayAgain = !todayLook && lovedLook ? lovedLook : null;
  const todayPieces = todayAgain
    ? todayAgain.pieces
    : (todayLook?.itemIds ?? [])
        .map((id) => items.find((item) => String(item.id) === String(id)))
        .filter((item): item is WardrobeItem => Boolean(item));

  if (collapsed)
    return (
      <section className="ootd ootd-compact" aria-label="Outfit of the day">
        <button className="ootd-expand" aria-expanded={false} onClick={() => setCollapsed(false)}>
          <span className="ootd-compact-thumbs" aria-hidden>
            {todayPieces.length ? (
              todayPieces.slice(0, 3).map((piece) => <img key={piece.id} src={piece.thumb ?? piece.image} alt="" />)
            ) : (
              <CalendarDays />
            )}
          </span>
          <span className="ootd-compact-copy">
            <strong>Outfit of the day</strong>
            <span>
              {todayLook
                ? todayLook.name
                : todayAgain
                  ? "A look you loved. Wear it again?"
                  : "Nothing planned for today"}
            </span>
          </span>
          <ChevronDown aria-hidden />
        </button>
      </section>
    );

  return (
    <section className="ootd" aria-labelledby="ootd-title">
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
                  aria-current={iso === day ? "true" : undefined}
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
      <h2 className="display-title" id="ootd-title">
        {day === todayIso ? (
          <>
            Outfit of the <em>day</em>
          </>
        ) : look ? (
          "Planned look"
        ) : (
          "Nothing yet"
        )}
      </h2>
      <p className="ootd-date">
        {dayLabel}
        {look ? ` · ${look.name}` : ""}
      </p>
      {dayWeather ? (
        <p className="ootd-weather">
          <span>
            <span className="weather-emoji" aria-hidden>
              {weatherEmoji(dayWeather.code)}
            </span>
            {`${dayWeather.high}° / ${dayWeather.low}° · ${weatherLabel(dayWeather.code)}`}
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
          aria-label={again ? "Style this loved outfit" : look ? `Open ${look.name}` : undefined}
          onClick={used(() => (look ? onOpenLook(look) : again && onStyle?.(again.pieces)))}
        >
          {pieces.slice(0, 4).map((piece) => (
            <span key={piece.id}>
              <img src={piece.thumb ?? piece.image} alt={piece.name} />
            </span>
          ))}
        </button>
      ) : (
        <p className="ootd-empty">
          {looks.length ? "No look planned for this day yet." : "Save a look on the Outfits tab, then plan it here."}
        </p>
      )}
      {again && (
        <p className="ootd-again">
          <Heart aria-hidden /> You loved this on{" "}
          <strong>
            {new Date(`${again.date}T00:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}
          </strong>
          . Wear it again?
        </p>
      )}
      <div className="ootd-actions">
        {(look || again) && day === todayIso ? (
          <button className="primary" disabled={Boolean(wornToday)} onClick={used(() => onWear(pieces))}>
            <Check /> {wornToday ? "Worn today" : again ? "Wear it again" : "Wear this today"}
          </button>
        ) : (
          <button className="primary" onClick={used(() => onPlanDay(day))}>
            <CalendarDays /> {look ? "Change plan" : "Plan this day"}
          </button>
        )}
        <button onClick={used(onSurprise)} disabled={!items.length}>
          <Shuffle /> Surprise me
        </button>
        <button
          className="ootd-collapse"
          aria-expanded
          aria-label="Fold away outfit of the day"
          onClick={() => setCollapsed(true)}
        >
          <ChevronUp />
        </button>
      </div>
    </section>
  );
}
