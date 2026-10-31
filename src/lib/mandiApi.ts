import type { CropKey, LiveMandiRecord, MandiRecord } from '../types'

interface MandiApiResponse {
  records: LiveMandiRecord[]
  fetchedAt: string
  cached: boolean
}

export class MandiApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'MandiApiError'
    this.status = status
  }
}

export async function fetchLiveMandiRecords(state: string, crop: CropKey): Promise<MandiApiResponse> {
  const params = new URLSearchParams({ state, crop })
  const response = await fetch(`/api/mandi?${params}`, { headers: { Accept: 'application/json' } })
  const body = await response.json() as { error?: string; records?: LiveMandiRecord[]; fetchedAt?: string; cached?: boolean }

  if (!response.ok) {
    throw new MandiApiError(body.error ?? 'Live mandi data is unavailable.', response.status)
  }
  if (!Array.isArray(body.records) || !body.fetchedAt) {
    throw new MandiApiError('The mandi service returned an invalid response.', 502)
  }

  return {
    records: body.records,
    fetchedAt: body.fetchedAt,
    cached: body.cached ?? false,
  }
}

export function toAdvisoryMandiRecords(records: LiveMandiRecord[]): MandiRecord[] {
  return records.map((record) => ({
    state: record.state,
    district: record.district,
    market: record.market,
    commodity: record.commodity,
    variety: record.variety,
    modalPrice: record.modalPrice,
    minPrice: record.minPrice,
    maxPrice: record.maxPrice,
    yesterdayPrice: record.modalPrice,
    nearbyMandis: [],
  }))
}
