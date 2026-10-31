import { cropMatchesCommodity, DISTRICT_COORDINATES } from '../data/cropsAndMandis'
import { getIndianPlaceCoordinates } from './openMeteo'
import type { CropKey, LiveMandiRecord, MandiLocation, NearbyMandiQuote } from '../types'

const GEOCODING_CONCURRENCY = 5

function arrivalDateValue(value: string): number {
  const [day, month, year] = value.split('/').map(Number)
  if (day && month && year) return Date.UTC(year, month - 1, day)
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function distanceBetween(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const latitudeDifference = radians(latitudeB - latitudeA)
  const longitudeDifference = radians(longitudeB - longitudeA)
  const a = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB))
    * Math.sin(longitudeDifference / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function latestQuotesByMarket(records: LiveMandiRecord[], crop: CropKey): LiveMandiRecord[] {
  const latest = new Map<string, LiveMandiRecord>()
  for (const record of records.filter((item) => cropMatchesCommodity(crop, item.commodity))) {
    const key = `${record.market.toLowerCase()}:${record.district.toLowerCase()}`
    const previous = latest.get(key)
    if (!previous || arrivalDateValue(record.arrivalDate) > arrivalDateValue(previous.arrivalDate)) {
      latest.set(key, record)
    }
  }
  return [...latest.values()]
}

async function getLocationCoordinates(
  place: string,
  state: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const knownLocation = DISTRICT_COORDINATES[place]
  if (knownLocation) return { latitude: knownLocation.lat, longitude: knownLocation.lon }
  return getIndianPlaceCoordinates(place, state)
}

export async function findNearbyMandiQuotes(
  records: LiveMandiRecord[],
  crop: CropKey,
  origin: MandiLocation,
): Promise<NearbyMandiQuote[]> {
  const candidates = latestQuotesByMarket(records, crop)
    .filter((record) =>
      record.state.toLowerCase() === origin.state.toLowerCase()
      && record.district.toLowerCase() !== origin.district.toLowerCase())

  const locations: Array<{ place: string; fallbackDistrict: string; state: string }> = []
  const seenLocations = new Set<string>()
  for (const candidate of candidates) {
    const place = candidate.market.trim() || candidate.district
    const key = `${candidate.state.toLowerCase()}:${place.toLowerCase()}`
    if (seenLocations.has(key)) continue
    seenLocations.add(key)
    locations.push({ place, fallbackDistrict: candidate.district, state: candidate.state })
  }

  const coordinatesByPlace = new Map<string, { latitude: number; longitude: number } | null>()
  for (let offset = 0; offset < locations.length; offset += GEOCODING_CONCURRENCY) {
    const batch = locations.slice(offset, offset + GEOCODING_CONCURRENCY)
    const results = await Promise.all(batch.map(async ({ place, fallbackDistrict, state }) => {
      try {
        const coordinates = await getLocationCoordinates(place, state)
          ?? await getLocationCoordinates(fallbackDistrict, state)
        return { place, coordinates }
      } catch (error) {
        console.warn(`Could not locate mandi ${place}, ${state}`, error)
        return { place, coordinates: null }
      }
    }))
    for (const result of results) coordinatesByPlace.set(result.place.toLowerCase(), result.coordinates)
  }

  const withDistances = candidates.flatMap((record) => {
    const coordinates = coordinatesByPlace.get((record.market.trim() || record.district).toLowerCase())
    if (!coordinates) return []
    return [{
      record,
      distanceKm: Math.round(distanceBetween(origin.lat, origin.lon, coordinates.latitude, coordinates.longitude)),
    }]
  })

  return withDistances
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .slice(0, 5)
    .map(({ record, distanceKm }) => ({
      market: record.market,
      district: record.district,
      modalPrice: record.modalPrice,
      minPrice: record.minPrice,
      maxPrice: record.maxPrice,
      arrivalDate: record.arrivalDate,
      distanceKm,
    }))
    .sort((left, right) => right.modalPrice - left.modalPrice)
}
