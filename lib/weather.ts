// Open-Meteo daily forecast helpers. Import-free so node's test runner can load it directly.

export type DayWeather = { date: string; high: number; low: number; rain: number; code: number };

/** Short label for a WMO weather code, as returned by Open-Meteo. */
export function weatherLabel(code: number) {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "Rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Snow";
  if (code >= 95) return "Storms";
  return "Mixed";
}

const WEATHER_EMOJI: Record<string, string> = {
  Clear: "☀️",
  "Partly cloudy": "⛅️",
  Cloudy: "☁️",
  Fog: "🌫️",
  Drizzle: "🌦️",
  Rain: "🌧️",
  Snow: "❄️",
  Storms: "⛈️",
  Mixed: "🌤️",
};

/** A small weather emoji for the forecast chip. */
export function weatherEmoji(code: number) {
  return WEATHER_EMOJI[weatherLabel(code)];
}

/** One line of dressing advice. Temperatures are in the unit the forecast was fetched in. */
export function weatherHint(day: DayWeather, fahrenheit: boolean) {
  const cold = fahrenheit ? 50 : 10;
  const cool = fahrenheit ? 61 : 16;
  const hot = fahrenheit ? 82 : 28;
  const wet = day.rain >= 50 || ["Rain", "Drizzle", "Storms"].includes(weatherLabel(day.code));
  if (weatherLabel(day.code) === "Snow") return "Snow likely, so wear warm layers and boots.";
  if (day.high <= cold) return wet ? "Cold and wet, so wear a warm coat." : "Cold, so wear a warm coat.";
  if (day.low <= cool)
    return wet ? "Cool with rain, so bring a layer and an umbrella." : "Cool morning, so bring a layer.";
  if (day.high >= hot)
    return wet ? "Hot with showers, so keep it light and bring an umbrella." : "Hot, so keep it light.";
  return wet ? "Rain likely, so bring an umbrella." : "Mild, so anything goes.";
}

export function forecastUrl(latitude: number, longitude: number, fahrenheit: boolean) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(2),
    longitude: longitude.toFixed(2),
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
    timezone: "auto",
    forecast_days: "14",
  });
  if (fahrenheit) params.set("temperature_unit", "fahrenheit");
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

/** Turns Open-Meteo's column-per-field daily block into one record per day. */
export function parseForecast(payload: unknown): DayWeather[] {
  const daily = (payload as { daily?: Record<string, unknown[]> } | null)?.daily;
  if (!daily || !Array.isArray(daily.time)) return [];
  return daily.time.map((date, index) => ({
    date: String(date),
    high: Math.round(Number(daily.temperature_2m_max?.[index] ?? 0)),
    low: Math.round(Number(daily.temperature_2m_min?.[index] ?? 0)),
    rain: Number(daily.precipitation_probability_max?.[index] ?? 0),
    code: Number(daily.weather_code?.[index] ?? 0),
  }));
}
