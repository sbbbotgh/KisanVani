import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { SUPPORTED_STATES } from '../src/data/cropsAndMandis.js'
import type { LiveMandiRecord } from '../src/types.js'
import type { CropKey } from '../src/types.js'

const OGD_RESOURCE_URL = 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070'
const CACHE_TTL_MS = 5 * 60 * 1000
const RATE_WINDOW_MS = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 20
const MAX_UPSTREAM_ATTEMPTS = 3
const UPSTREAM_TIMEOUT_MS = 60_000
const RECORD_LIMIT = 1000

const commodityByCrop: Record<CropKey, string> = {
  wheat: 'Wheat',
  rice: 'Paddy(Common)',
  cotton: 'Cotton',
  onion: 'Onion',
  tomato: 'Tomato',
  potato: 'Potato',
  soybean: 'Soyabean',
  mustard: 'Mustard',
}

interface CacheEntry {
  records: LiveMandiRecord[]
  fetchedAt: string
  expiresAt: number
}

interface OGDRecord {
  state?: unknown
  district?: unknown
  market?: unknown
  commodity?: unknown
  variety?: unknown
  grade?: unknown
  arrival_date?: unknown
  min_price?: unknown
  max_price?: unknown
  modal_price?: unknown
}

const responseCache = new Map<string, CacheEntry>()
const rateLimits = new Map<string, { startedAt: number; count: number }>()

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.end(JSON.stringify(body))
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePrice(value: unknown): number | undefined {
  const price = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(price) && price >= 0 ? price : undefined
}

function normalizeRecord(record: OGDRecord): LiveMandiRecord | undefined {
  const minPrice = normalizePrice(record.min_price)
  const maxPrice = normalizePrice(record.max_price)
  const modalPrice = normalizePrice(record.modal_price)
  const normalized = {
    state: normalizeText(record.state),
    district: normalizeText(record.district),
    market: normalizeText(record.market),
    commodity: normalizeText(record.commodity),
    variety: normalizeText(record.variety),
    grade: normalizeText(record.grade),
    arrivalDate: normalizeText(record.arrival_date),
    minPrice,
    maxPrice,
    modalPrice,
  }

  if (!normalized.state || !normalized.district || !normalized.market || !normalized.commodity
    || minPrice === undefined || maxPrice === undefined || modalPrice === undefined) return undefined

  return { ...normalized, minPrice, maxPrice, modalPrice }
}

function isAllowedState(state: string): boolean {
  return SUPPORTED_STATES.includes(state)
}

function isRateLimited(request: IncomingMessage): boolean {
  const forwardedFor = request.headers['x-forwarded-for']
  const clientIp = typeof forwardedFor === 'string'
    ? forwardedFor.split(',')[0].trim()
    : request.socket.remoteAddress ?? 'unknown'
  const now = Date.now()
  const current = rateLimits.get(clientIp)
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateLimits.set(clientIp, { startedAt: now, count: 1 })
    return false
  }
  current.count += 1
  return current.count > MAX_REQUESTS_PER_WINDOW
}

async function fetchFromOGD(apiKey: string, state: string, crop: CropKey): Promise<LiveMandiRecord[]> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_UPSTREAM_ATTEMPTS; attempt += 1) {
    const url = new URL(OGD_RESOURCE_URL)
    url.searchParams.set('api-key', apiKey)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', String(RECORD_LIMIT))
    url.searchParams.set('filters[state]', state)
    url.searchParams.set('filters[commodity]', commodityByCrop[crop])

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'KisanVani/1.0 (voice-first agri-advisory demo)',
          Accept: 'application/json',
        },
      })
      if (!response.ok) {
        if (response.status < 500 && response.status !== 429) {
          throw new Error(`OGD returned HTTP ${response.status}`)
        }
        lastError = new Error(`OGD returned HTTP ${response.status}`)
      } else {
        const payload = await response.json() as { records?: OGDRecord[] }
        if (!Array.isArray(payload.records)) throw new Error('OGD response did not contain records')
        return payload.records
          .map(normalizeRecord)
          .filter((record): record is LiveMandiRecord => record !== undefined)
          .filter((record) => record.state.toLowerCase() === state.toLowerCase()
            && record.commodity.toLowerCase().includes(commodityByCrop[crop].toLowerCase()))
      }
    } catch (error) {
      lastError = error
      if (error instanceof Error && /^OGD returned HTTP 4/.test(error.message)) throw error
    } finally {
      clearTimeout(timeout)
    }

    if (attempt + 1 < MAX_UPSTREAM_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (2 ** attempt)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('OGD request failed')
}

function handleMandiRequest(apiKey: string | undefined): Connect.NextHandleFunction {
  return (request, response, next) => {
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Use GET to request mandi prices.' })
      return
    }
    if (!apiKey) {
      sendJson(response, 503, { error: 'Live mandi prices are not configured. Set OGD_API_KEY on the server.' })
      return
    }
    if (isRateLimited(request)) {
      sendJson(response, 429, { error: 'Too many mandi requests. Please wait a minute and try again.' })
      return
    }

    const requestUrl = new URL(request.url ?? '/', 'http://localhost')
    const state = requestUrl.searchParams.get('state')?.trim() ?? ''
    const crop = requestUrl.searchParams.get('crop')?.trim() as CropKey | undefined
    if (!isAllowedState(state) || !crop || !(crop in commodityByCrop)) {
      sendJson(response, 400, { error: 'Choose a supported state and crop.' })
      return
    }

    const cacheKey = `${state.toLowerCase()}:${crop}`
    const cached = responseCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      sendJson(response, 200, { records: cached.records, fetchedAt: cached.fetchedAt, cached: true })
      return
    }

    void fetchFromOGD(apiKey, state, crop).then((records) => {
      const fetchedAt = new Date().toISOString()
      responseCache.set(cacheKey, { records, fetchedAt, expiresAt: Date.now() + CACHE_TTL_MS })
      sendJson(response, 200, { records, fetchedAt, cached: false })
    }).catch((error: unknown) => {
      if (error instanceof Error && /^OGD returned HTTP 4/.test(error.message)) {
        sendJson(response, 502, { error: 'The OGD service rejected the request. Check the server API key and provider access.' })
        return
      }
      sendJson(response, 502, { error: 'The OGD mandi service could not be reached. Please retry shortly.' })
    }).catch(next)
  }
}

export function ogdMandiPlugin(apiKey: string | undefined): Plugin {
  const handler = handleMandiRequest(apiKey)
  return {
    name: 'ogd-mandi-proxy',
    configureServer(server) {
      server.middlewares.use('/api/mandi', handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/mandi', handler)
    },
  }
}
