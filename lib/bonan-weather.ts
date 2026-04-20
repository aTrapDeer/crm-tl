const WMO_WEATHER_CONDITIONS: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Heavy freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Heavy showers",
  85: "Light snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm",
};

export function describeWeatherCode(code: unknown): string {
  const n = typeof code === "number" ? code : Number(code);
  if (!Number.isFinite(n)) return "Current conditions";
  return WMO_WEATHER_CONDITIONS[n] || "Current conditions";
}

export interface LocalWeather {
  summary: string;
  tempF: number;
  windMph: number;
  condition: string;
}

export async function fetchLocalWeather(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<LocalWeather | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude.toFixed(4));
  url.searchParams.set("longitude", longitude.toFixed(4));
  url.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");

  const response = await fetch(url.toString(), {
    cache: "no-store",
    signal,
  });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    current?: {
      temperature_2m?: number;
      weather_code?: number;
      wind_speed_10m?: number;
    };
  };
  const current = data.current;
  if (!current) return null;

  const tempF = Math.round(Number(current.temperature_2m ?? 0));
  const windMph = Math.round(Number(current.wind_speed_10m ?? 0));
  const condition = describeWeatherCode(current.weather_code);
  return {
    tempF,
    windMph,
    condition,
    summary: `${condition}, ${tempF}°F, wind ${windMph} mph`,
  };
}

export function requestBrowserGeolocation(
  options: PositionOptions = { timeout: 8000, maximumAge: 10 * 60 * 1000 }
): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      () => resolve(null),
      options
    );
  });
}
