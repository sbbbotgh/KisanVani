import { DISTRICT_COORDINATES, SUPPORTED_STATES } from '../data/cropsAndMandis'
import type { MandiLocation, MicroclimateForecast } from '../types'

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number
    relative_humidity_2m?: number
    wind_speed_10m?: number
  }
  daily?: {
    time?: string[]
    precipitation_probability_max?: number[]
  }
}

interface GeocodingResponse {
  results?: Array<{
    name?: string
    admin1?: string
    admin2?: string
    country_code?: string
    latitude?: number
    longitude?: number
  }>
}

interface IndianPlaceCoordinates {
  latitude: number
  longitude: number
}

interface WeatherCache {
  data: Omit<MicroclimateForecast, 'source'>
  savedAt: number
}

const placeCoordinateCache = new Map<string, IndianPlaceCoordinates | null>()
const pendingPlaceLookups = new Map<string, Promise<IndianPlaceCoordinates | null>>()

const sampleForecast: Omit<MicroclimateForecast, 'source'> = {
  currentTemp: 29,
  currentHumidity: 62,
  windSpeed: 11,
  threeDayMaxRainProb: 65,
  rainRiskLevel: 'HIGH',
  rawDailyRain: [65, 40, 15],
}

function isWeatherCache(value: unknown): value is WeatherCache {
  if (!value || typeof value !== 'object') return false
  const cache = value as Partial<WeatherCache>
  const forecast = cache.data
  return typeof cache.savedAt === 'number'
    && !!forecast
    && typeof forecast.currentTemp === 'number'
    && typeof forecast.currentHumidity === 'number'
    && typeof forecast.windSpeed === 'number'
    && typeof forecast.threeDayMaxRainProb === 'number'
    && Array.isArray(forecast.rawDailyRain)
    && forecast.rawDailyRain.every((value) => typeof value === 'number')
}

function readCache(key: string): Omit<MicroclimateForecast, 'source'> | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isWeatherCache(parsed) ? parsed.data : null
  } catch {
    return null
  }
}

function writeCache(key: string, data: Omit<MicroclimateForecast, 'source'>): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() } satisfies WeatherCache))
  } catch {
    // Storage can be disabled or full; live weather remains available for this session.
  }
}

function buildForecast(
  current: NonNullable<OpenMeteoResponse['current']>,
  dailyRain: number[],
): Omit<MicroclimateForecast, 'source'> {
  const threeDayMaxRainProb = Math.max(...dailyRain)
  const rainRiskLevel = threeDayMaxRainProb >= 60
    ? 'HIGH'
    : threeDayMaxRainProb >= 35
      ? 'MODERATE'
      : 'LOW'
  return {
    currentTemp: Math.round(current.temperature_2m ?? 28),
    currentHumidity: Math.round(current.relative_humidity_2m ?? 65),
    windSpeed: Math.round(current.wind_speed_10m ?? 12),
    threeDayMaxRainProb,
    rainRiskLevel,
    rawDailyRain: dailyRain.slice(0, 3),
  }
}

export async function fetchMicroclimate(districtName: string): Promise<MicroclimateForecast> {
  const coordinates = DISTRICT_COORDINATES[districtName]
  if (!coordinates) {
    const cached = readCache(`kisanvani_weather_${districtName.toLowerCase()}`)
    return cached ? { ...cached, source: 'cache' } : { ...sampleForecast, source: 'sample' }
  }
  return fetchMicroclimateAtCoordinates(
    coordinates.lat,
    coordinates.lon,
    `kisanvani_weather_${districtName.toLowerCase()}`,
  )
}

export async function fetchMicroclimateAtCoordinates(
  latitude: number,
  longitude: number,
  cacheKey: string,
): Promise<MicroclimateForecast> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m',
    daily: 'precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '3',
  }).toString()

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4500) })
    if (!response.ok) {
      throw new Error(`Open-Meteo returned ${response.status}`)
    }

    const payload = await response.json() as OpenMeteoResponse
    const dailyRain = payload.daily?.precipitation_probability_max?.slice(0, 3) ?? []
    if (!payload.current || dailyRain.length === 0) {
      throw new Error('Open-Meteo response did not contain current weather and a daily forecast')
    }

    const data = buildForecast(payload.current, dailyRain)
    writeCache(cacheKey, data)
    return { ...data, source: 'live' }
  } catch {
    const cached = readCache(cacheKey)
    if (cached) return { ...cached, source: 'cache' }
    return { ...sampleForecast, source: 'sample' }
  }
}

export async function searchIndianLocations(query: string): Promise<MandiLocation[]> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.search = new URLSearchParams({
    name: query,
    count: '10',
    language: 'en',
    countryCode: 'IN',
    format: 'json',
  }).toString()
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error(`Open-Meteo geocoding returned ${response.status}`)
  const payload = await response.json() as GeocodingResponse
  return (payload.results ?? []).flatMap((result) => {
    if (
      result.country_code !== 'IN'
      || !result.name
      || !result.admin1
      || !SUPPORTED_STATES.includes(result.admin1)
      || typeof result.latitude !== 'number'
      || typeof result.longitude !== 'number'
    ) return []
    const district = result.admin2?.replace(/\s+district$/i, '').trim() || result.name
    return [{
      district,
      state: result.admin1,
      lat: result.latitude,
      lon: result.longitude,
    }]
  }).filter((location, index, locations) =>
    locations.findIndex((other) =>
      other.district.toLowerCase() === location.district.toLowerCase()
      && other.state === location.state,
    ) === index)
}

export async function getIndianPlaceCoordinates(
  place: string,
  state: string,
): Promise<IndianPlaceCoordinates | null> {
  const cacheKey = `${state.toLowerCase()}:${place.toLowerCase()}`
  if (placeCoordinateCache.has(cacheKey)) return placeCoordinateCache.get(cacheKey) ?? null
  const pendingLookup = pendingPlaceLookups.get(cacheKey)
  if (pendingLookup) return pendingLookup

  const lookup = (async () => {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
    url.search = new URLSearchParams({
      name: place,
      count: '10',
      language: 'en',
      countryCode: 'IN',
      format: 'json',
    }).toString()

    const response = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!response.ok) throw new Error(`Open-Meteo geocoding returned ${response.status}`)
    const payload = await response.json() as GeocodingResponse
    const stateMatches = (payload.results ?? []).filter((result) =>
      result.country_code === 'IN'
      && result.admin1?.toLowerCase() === state.toLowerCase()
      && typeof result.latitude === 'number'
      && typeof result.longitude === 'number')
    const normalizedPlace = place.trim().toLowerCase()
    const match = stateMatches.find((result) =>
      result.name?.toLowerCase() === normalizedPlace
      || result.admin2?.replace(/\s+district$/i, '').trim().toLowerCase() === normalizedPlace
      || result.name?.toLowerCase().includes(normalizedPlace))
    const coordinates = match && typeof match.latitude === 'number' && typeof match.longitude === 'number'
      ? { latitude: match.latitude, longitude: match.longitude }
      : null
    placeCoordinateCache.set(cacheKey, coordinates)
    return coordinates
  })()
  pendingPlaceLookups.set(cacheKey, lookup)
  try {
    return await lookup
  } finally {
    pendingPlaceLookups.delete(cacheKey)
  }
}
