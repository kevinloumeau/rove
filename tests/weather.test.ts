import assert from "node:assert/strict";
import { test } from "node:test";
import { forecastUrl, parseForecast, weatherHint, weatherLabel } from "../lib/weather.ts";

test("labels WMO codes", () => {
  assert.equal(weatherLabel(0), "Clear");
  assert.equal(weatherLabel(63), "Rain");
  assert.equal(weatherLabel(81), "Rain");
  assert.equal(weatherLabel(73), "Snow");
  assert.equal(weatherLabel(95), "Storms");
});

test("gives dressing advice in either unit", () => {
  assert.match(weatherHint({ date: "", high: 6, low: 1, rain: 10, code: 3 }, false), /warm coat/);
  assert.match(weatherHint({ date: "", high: 20, low: 12, rain: 80, code: 61 }, false), /layer and an umbrella/);
  assert.match(weatherHint({ date: "", high: 90, low: 72, rain: 0, code: 0 }, true), /keep it light/);
  assert.match(weatherHint({ date: "", high: 72, low: 64, rain: 0, code: 1 }, true), /anything goes/);
});

test("parses the daily block and builds the request", () => {
  const days = parseForecast({
    daily: {
      time: ["2026-10-05", "2026-10-06"],
      temperature_2m_max: [18.4, 15.6],
      temperature_2m_min: [9.2, 7.5],
      precipitation_probability_max: [10, 70],
      weather_code: [2, 61],
    },
  });
  assert.deepEqual(days[1], { date: "2026-10-06", high: 16, low: 8, rain: 70, code: 61 });
  assert.deepEqual(parseForecast(null), []);
  assert.match(forecastUrl(48.8566, 2.3522, true), /latitude=48\.86&longitude=2\.35.*temperature_unit=fahrenheit/);
});
