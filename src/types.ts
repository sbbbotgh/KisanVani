export type CropKey =
  | 'wheat'
  | 'rice'
  | 'cotton'
  | 'onion'
  | 'tomato'
  | 'potato'
  | 'soybean'
  | 'mustard'

export type DecisionType =
  | 'SELL TODAY'
  | 'HOLD FOR 2 DAYS'
  | 'TRANSPORT TO NEARBY MANDI'
  | 'CHECK PRICE TREND'
  | 'CHECK LOCAL RATE'

export type SupportedDialect =
  | 'English'
  | 'Hinglish'
  | 'Punjlish'
  | 'Tanglish'
  | 'Hindi'
  | 'Punjabi'
  | 'Tamil'
  | 'Marathi'

export interface CropInfo {
  id: CropKey
  nameEn: string
  nameHi: string
  namePa: string
  nameTa: string
  nameMr: string
  colorBg: string
}

export interface NearbyMandi {
  name: string
  distanceKm: number
  modalPrice: number
}

export interface MandiRecord {
  state: string
  district: string
  market: string
  commodity: string
  variety: string
  modalPrice: number
  minPrice: number
  maxPrice: number
  yesterdayPrice: number
  nearbyMandis: NearbyMandi[]
}

export interface MandiQuote {
  market: string
  modalPrice: number
  distanceKm: number
  isOrigin: boolean
  variety: string
}

export interface MspReference {
  price: number
  marketingYear: string
  grade: string
}

export interface LiveMandiRecord {
  state: string
  district: string
  market: string
  commodity: string
  variety: string
  grade: string
  arrivalDate: string
  minPrice: number
  maxPrice: number
  modalPrice: number
}

export interface NearbyMandiQuote {
  market: string
  district: string
  modalPrice: number
  minPrice: number
  maxPrice: number
  arrivalDate: string
  distanceKm: number
}

export interface DistrictCoordinates {
  district: string
  lat: number
  lon: number
}

export interface MandiLocation extends DistrictCoordinates {
  state: string
}

export interface MicroclimateForecast {
  currentTemp: number
  currentHumidity: number
  windSpeed: number
  threeDayMaxRainProb: number
  rainRiskLevel: 'LOW' | 'MODERATE' | 'HIGH'
  rawDailyRain: number[]
  source: 'live' | 'cache' | 'sample' | 'demo'
}

export interface AdvisoryResult {
  farmerSpeechTranscript: string
  detectedDialect: SupportedDialect
  cropId: CropKey
  cropDetected: string
  mandiDetected: string
  currentModalPrice: number
  minPrice: number
  maxPrice: number
  hasLocalMarketQuote: boolean
  nearbyMandiQuotes?: NearbyMandiQuote[]
  bestNearbyMandi?: {
    name: string
    modalPrice: number
    extraProfitPerQuintal: number
    distanceKm: number
  }
  decisionReason?: string
  microclimateAlert: string
  decisionBadge: DecisionType
  spokenAdvisoryResponse: string
  isSimulated: boolean
  answerSource: 'gemini' | 'local'
  weatherSource: MicroclimateForecast['source']
  cachedAt?: number
}

export interface JudgeDemo {
  id: string
  dialect: 'Hinglish' | 'Punjlish' | 'Tanglish'
  label: string
  displayTranscript: string
  crop: CropKey
  district: string
  expectedDecision: DecisionType
}
