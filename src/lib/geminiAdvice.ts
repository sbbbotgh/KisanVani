import type { CropKey, LiveMandiRecord, MicroclimateForecast, NearbyMandiQuote, SupportedDialect } from '../types'

type DecisionBadge = 'SELL TODAY'
  | 'HOLD FOR 2 DAYS'
  | 'TRANSPORT TO NEARBY MANDI'
  | 'CHECK PRICE TREND'
  | 'CHECK LOCAL RATE'

interface GeminiAdviceRequest {
  question: string
  dialect: SupportedDialect
  crop: CropKey
  district: string
  state: string
  weather: MicroclimateForecast
  mandiRecords: LiveMandiRecord[]
  nearbyMandiQuotes: NearbyMandiQuote[]
}

export interface GeminiAdviceResponse {
  decisionBadge: DecisionBadge
  decisionReason: string
  spokenAdvisoryResponse: string
}

export class GeminiApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'GeminiApiError'
    this.status = status
  }
}

export async function requestGeminiAdvice(input: GeminiAdviceRequest): Promise<GeminiAdviceResponse> {
  const response = await fetch('/api/advice', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...input,
      mandiRecords: input.mandiRecords.slice(0, 8),
      nearbyMandiQuotes: input.nearbyMandiQuotes.slice(0, 5),
    }),
  })
  const body = await response.json() as {
    decisionBadge?: unknown
    decisionReason?: unknown
    spokenAdvisoryResponse?: unknown
    error?: unknown
  }
  if (!response.ok) {
    throw new GeminiApiError(
      typeof body.error === 'string' ? body.error : 'Gemini advice is unavailable.',
      response.status,
    )
  }
  const validDecisions: DecisionBadge[] = [
    'SELL TODAY',
    'HOLD FOR 2 DAYS',
    'TRANSPORT TO NEARBY MANDI',
    'CHECK PRICE TREND',
    'CHECK LOCAL RATE',
  ]
  if (typeof body.decisionBadge !== 'string'
    || !validDecisions.includes(body.decisionBadge as DecisionBadge)
    || typeof body.decisionReason !== 'string'
    || typeof body.spokenAdvisoryResponse !== 'string'
    || !body.spokenAdvisoryResponse.trim()) {
    throw new GeminiApiError('Gemini returned an invalid structured answer.', 502)
  }
  return {
    decisionBadge: body.decisionBadge as DecisionBadge,
    decisionReason: body.decisionReason.trim(),
    spokenAdvisoryResponse: body.spokenAdvisoryResponse.trim(),
  }
}
