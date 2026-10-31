import type { CropInfo, CropKey, DistrictCoordinates, MandiQuote, MandiRecord, MspReference, SupportedDialect } from '../types.js'

export const CROPS: CropInfo[] = [
  { id: 'wheat', nameEn: 'Wheat', nameHi: 'गेहूँ (कनक)', namePa: 'ਕਣਕ', nameTa: 'கோதுமை', nameMr: 'गहू', colorBg: '#FDF6E2' },
  { id: 'rice', nameEn: 'Paddy / Rice', nameHi: 'धान (चावल)', namePa: 'ਝੋਨਾ', nameTa: 'நெல்', nameMr: 'भात', colorBg: '#EBF4F6' },
  { id: 'cotton', nameEn: 'Cotton', nameHi: 'कपास', namePa: 'ਨਰਮਾ', nameTa: 'பருத்தி', nameMr: 'कापूस', colorBg: '#F5F5F7' },
  { id: 'onion', nameEn: 'Onion', nameHi: 'प्याज (कांदा)', namePa: 'ਗੰਢਾ', nameTa: 'வெங்காயம்', nameMr: 'कांदा', colorBg: '#FDF0ED' },
  { id: 'tomato', nameEn: 'Tomato', nameHi: 'टमाटर', namePa: 'ਟਮਾਟਰ', nameTa: 'தக்காளி', nameMr: 'टोमॅटो', colorBg: '#FEECEC' },
  { id: 'potato', nameEn: 'Potato', nameHi: 'आलू', namePa: 'ਆਲੂ', nameTa: 'உருளைக்கிழங்கு', nameMr: 'बटाटा', colorBg: '#FBF2E3' },
  { id: 'soybean', nameEn: 'Soybean', nameHi: 'सोयाबीन', namePa: 'ਸੋਇਆਬੀਨ', nameTa: 'சோயாபீன்', nameMr: 'सोयाबीन', colorBg: '#EDF5EB' },
  { id: 'mustard', nameEn: 'Mustard', nameHi: 'सरसों', namePa: 'ਸਰ੍ਹੋਂ', nameTa: 'கடுகு', nameMr: 'मोहरी', colorBg: '#FEF9E7' },
]

export function getLocalizedCropName(cropId: string, dialect: SupportedDialect): string {
  const crop = CROPS.find((item) => item.id === cropId)
  if (!crop) return cropId
  if (dialect === 'English') return crop.nameEn
  if (dialect === 'Punjlish' || dialect === 'Punjabi') return crop.namePa
  if (dialect === 'Tanglish' || dialect === 'Tamil') return crop.nameTa
  if (dialect === 'Marathi') return crop.nameMr
  return crop.nameHi
}

const placeNames: Record<string, Record<'hi' | 'pa' | 'ta' | 'mr', string>> = {
  Ludhiana: { hi: 'लुधियाना', pa: 'ਲੁਧਿਆਣਾ', ta: 'லூதியானா', mr: 'लुधियाना' },
  Khanna: { hi: 'खन्ना', pa: 'ਖੰਨਾ', ta: 'கன்னா', mr: 'खन्ना' },
  Jagraon: { hi: 'जगराओं', pa: 'ਜਗਰਾਉਂ', ta: 'ஜாக்ரான்', mr: 'जगराव' },
  Jalandhar: { hi: 'जालंधर', pa: 'ਜਲੰਧਰ', ta: 'ஜலந்தர்', mr: 'जालंधर' },
  Sirhind: { hi: 'सरहिंद', pa: 'ਸਰਹਿੰਦ', ta: 'சர்ஹிந்த்', mr: 'सरहिंद' },
  Karnal: { hi: 'करनाल', pa: 'ਕਰਨਾਲ', ta: 'கர்னால்', mr: 'करनाल' },
  Taraori: { hi: 'तरावड़ी', pa: 'ਤਰਾਵੜੀ', ta: 'தராவரி', mr: 'तरावडी' },
  Kurukshetra: { hi: 'कुरुक्षेत्र', pa: 'ਕੁਰੂਕਸ਼ੇਤਰ', ta: 'குருக்ஷேத்திரம்', mr: 'कुरुक्षेत्र' },
  Panipat: { hi: 'पानीपत', pa: 'ਪਾਣੀਪਤ', ta: 'பானிபட்', mr: 'पानिपत' },
  Nashik: { hi: 'नाशिक', pa: 'ਨਾਸ਼ਿਕ', ta: 'நாசிக்', mr: 'नाशिक' },
  Lasalgaon: { hi: 'लासलगाँव', pa: 'ਲਾਸਲਗਾਓਂ', ta: 'லாசல்காவ்', mr: 'लासलगाव' },
  Pimpalgaon: { hi: 'पिंपलगाँव', pa: 'ਪਿੰਪਲਗਾਓਂ', ta: 'பிம்பல்காவ்', mr: 'पिंपळगाव' },
  Indore: { hi: 'इंदौर', pa: 'ਇੰਦੌਰ', ta: 'இந்தூர்', mr: 'इंदूर' },
  Ujjain: { hi: 'उज्जैन', pa: 'ਉੱਜੈਨ', ta: 'உஜ்ஜைன்', mr: 'उज्जैन' },
  Dewas: { hi: 'देवास', pa: 'ਦੇਵਾਸ', ta: 'தேவாஸ்', mr: 'देवास' },
  Thanjavur: { hi: 'तंजावुर', pa: 'ਤੰਜਾਵੁਰ', ta: 'தஞ்சாவூர்', mr: 'तंजावर' },
  Kumbakonam: { hi: 'कुंभकोणम', pa: 'ਕੁੰਭਕੋਣਮ', ta: 'கும்பகோணம்', mr: 'कुंभकोणम' },
  Tiruchirappalli: { hi: 'तिरुचिरापल्ली', pa: 'ਤਿਰੁਚਿਰਾਪੱਲੀ', ta: 'திருச்சிராப்பள்ளி', mr: 'तिरुचिरापल्ली' },
  Coimbatore: { hi: 'कोयंबटूर', pa: 'ਕੋਇੰਬਤੂਰ', ta: 'கோயம்புத்தூர்', mr: 'कोईम्बतूर' },
  Tirupur: { hi: 'तिरुपुर', pa: 'ਤਿਰੁਪੁਰ', ta: 'திருப்பூர்', mr: 'तिरुपूर' },
  Pollachi: { hi: 'पोल्लाची', pa: 'ਪੋਲਾਚੀ', ta: 'பொள்ளாச்சி', mr: 'पोल्लाची' },
  Guntur: { hi: 'गुंटूर', pa: 'ਗੁੰਟੂਰ', ta: 'கుంటூர்', mr: 'गुंटूर' },
  Punjab: { hi: 'पंजाब', pa: 'ਪੰਜਾਬ', ta: 'பஞ்சாப்', mr: 'पंजाब' },
  Haryana: { hi: 'हरियाणा', pa: 'ਹਰਿਆਣਾ', ta: 'ஹரியானா', mr: 'हरियाणा' },
  Maharashtra: { hi: 'महाराष्ट्र', pa: 'ਮਹਾਰਾਸ਼ਟਰ', ta: 'மகாராஷ்டிரா', mr: 'महाराष्ट्र' },
  'Madhya Pradesh': { hi: 'मध्य प्रदेश', pa: 'ਮੱਧ ਪ੍ਰਦੇਸ਼', ta: 'மத்தியப் பிரதேசம்', mr: 'मध्य प्रदेश' },
  'Tamil Nadu': { hi: 'तमिलनाडु', pa: 'ਤਮਿਲਨਾਡੂ', ta: 'தமிழ்நாடு', mr: 'तामिळनाडू' },
  'Andhra Pradesh': { hi: 'आंध्र प्रदेश', pa: 'ਆਂਧਰਾ ਪ੍ਰਦੇਸ਼', ta: 'ஆந்திரப் பிரதேசம்', mr: 'आंध्र प्रदेश' },
}

export function getLocalizedPlaceName(name: string, dialect: SupportedDialect): string {
  if (dialect === 'English') return name
  const language = dialect === 'Punjlish' || dialect === 'Punjabi'
    ? 'pa'
    : dialect === 'Tanglish' || dialect === 'Tamil'
      ? 'ta'
      : dialect === 'Marathi'
        ? 'mr'
        : 'hi'
  return placeNames[name]?.[language] ?? name
}

export const DISTRICT_COORDINATES: Record<string, DistrictCoordinates> = {
  Ludhiana: { district: 'Ludhiana', lat: 30.901, lon: 75.8573 },
  Khanna: { district: 'Khanna', lat: 30.7067, lon: 76.2198 },
  Karnal: { district: 'Karnal', lat: 29.6857, lon: 76.9905 },
  Nashik: { district: 'Nashik', lat: 19.9975, lon: 73.7898 },
  Indore: { district: 'Indore', lat: 22.7196, lon: 75.8577 },
  Thanjavur: { district: 'Thanjavur', lat: 10.787, lon: 79.1378 },
  Coimbatore: { district: 'Coimbatore', lat: 11.0168, lon: 76.9558 },
  Guntur: { district: 'Guntur', lat: 16.3067, lon: 80.4365 },
}

export const BUILT_IN_MANDIS: MandiRecord[] = [
  {
    state: 'Punjab', district: 'Ludhiana', market: 'Ludhiana', commodity: 'Wheat', variety: 'HD-3086',
    modalPrice: 2450, minPrice: 2400, maxPrice: 2480, yesterdayPrice: 2420,
    nearbyMandis: [
      { name: 'Khanna', distanceKm: 42, modalPrice: 2560 },
      { name: 'Jagraon', distanceKm: 38, modalPrice: 2440 },
    ],
  },
  {
    state: 'Punjab', district: 'Khanna', market: 'Khanna', commodity: 'Wheat', variety: 'PBW-725',
    modalPrice: 2560, minPrice: 2500, maxPrice: 2610, yesterdayPrice: 2510,
    nearbyMandis: [
      { name: 'Ludhiana', distanceKm: 42, modalPrice: 2450 },
      { name: 'Sirhind', distanceKm: 28, modalPrice: 2520 },
    ],
  },
  {
    state: 'Punjab', district: 'Ludhiana', market: 'Ludhiana', commodity: 'Potato', variety: 'Pukhraj',
    modalPrice: 1350, minPrice: 1250, maxPrice: 1420, yesterdayPrice: 1400,
    nearbyMandis: [
      { name: 'Jalandhar', distanceKm: 60, modalPrice: 1520 },
      { name: 'Khanna', distanceKm: 42, modalPrice: 1320 },
    ],
  },
  {
    state: 'Haryana', district: 'Karnal', market: 'Karnal', commodity: 'Paddy / Rice', variety: 'Basmati 1121',
    modalPrice: 3850, minPrice: 3750, maxPrice: 3950, yesterdayPrice: 3800,
    nearbyMandis: [
      { name: 'Taraori', distanceKm: 16, modalPrice: 3980 },
      { name: 'Kurukshetra', distanceKm: 34, modalPrice: 3820 },
    ],
  },
  {
    state: 'Haryana', district: 'Karnal', market: 'Karnal', commodity: 'Mustard', variety: 'Black',
    modalPrice: 5350, minPrice: 5200, maxPrice: 5450, yesterdayPrice: 5380,
    nearbyMandis: [{ name: 'Panipat', distanceKm: 36, modalPrice: 5420 }],
  },
  {
    state: 'Maharashtra', district: 'Nashik', market: 'Nashik', commodity: 'Onion', variety: 'Red Onion',
    modalPrice: 1850, minPrice: 1650, maxPrice: 2050, yesterdayPrice: 1720,
    nearbyMandis: [
      { name: 'Lasalgaon', distanceKm: 58, modalPrice: 2020 },
      { name: 'Pimpalgaon', distanceKm: 32, modalPrice: 1940 },
    ],
  },
  {
    state: 'Maharashtra', district: 'Nashik', market: 'Nashik', commodity: 'Tomato', variety: 'Hybrid',
    modalPrice: 1200, minPrice: 950, maxPrice: 1350, yesterdayPrice: 1450,
    nearbyMandis: [{ name: 'Narayangaon', distanceKm: 110, modalPrice: 1380 }],
  },
  {
    state: 'Tamil Nadu', district: 'Thanjavur', market: 'Thanjavur', commodity: 'Paddy / Rice', variety: 'CR 1009',
    modalPrice: 2280, minPrice: 2190, maxPrice: 2350, yesterdayPrice: 2250,
    nearbyMandis: [
      { name: 'Kumbakonam', distanceKm: 40, modalPrice: 2390 },
      { name: 'Tiruchirappalli', distanceKm: 55, modalPrice: 2310 },
    ],
  },
  {
    state: 'Tamil Nadu', district: 'Coimbatore', market: 'Coimbatore', commodity: 'Cotton', variety: 'MCU-5',
    modalPrice: 7100, minPrice: 6850, maxPrice: 7300, yesterdayPrice: 7000,
    nearbyMandis: [
      { name: 'Tirupur', distanceKm: 50, modalPrice: 7350 },
      { name: 'Pollachi', distanceKm: 42, modalPrice: 7050 },
    ],
  },
  {
    state: 'Madhya Pradesh', district: 'Indore', market: 'Indore', commodity: 'Soybean', variety: 'Yellow',
    modalPrice: 4720, minPrice: 4600, maxPrice: 4850, yesterdayPrice: 4680,
    nearbyMandis: [
      { name: 'Ujjain', distanceKm: 54, modalPrice: 4890 },
      { name: 'Dewas', distanceKm: 35, modalPrice: 4740 },
    ],
  },
]

export const DISTRICT_OPTIONS = [
  { district: 'Ludhiana', state: 'Punjab' },
  { district: 'Khanna', state: 'Punjab' },
  { district: 'Karnal', state: 'Haryana' },
  { district: 'Nashik', state: 'Maharashtra' },
  { district: 'Indore', state: 'Madhya Pradesh' },
  { district: 'Thanjavur', state: 'Tamil Nadu' },
  { district: 'Coimbatore', state: 'Tamil Nadu' },
  { district: 'Guntur', state: 'Andhra Pradesh' },
]

export const SUPPORTED_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
]

export function getCropName(cropId: string): string {
  return CROPS.find((crop) => crop.id === cropId)?.nameEn ?? cropId
}

export function cropMatchesCommodity(cropId: string, commodity: string): boolean {
  const crop = getCropName(cropId).toLowerCase()
  const normalizedCommodity = commodity.toLowerCase()
  return cropId === 'rice'
    ? normalizedCommodity.includes('rice') || normalizedCommodity.includes('paddy')
    : normalizedCommodity.includes(crop)
}

export function findMandiRecord(cropId: string, district: string): MandiRecord {
  return BUILT_IN_MANDIS.find(
    (record) => record.district.toLowerCase() === district.toLowerCase()
      && cropMatchesCommodity(cropId, record.commodity),
  ) ?? BUILT_IN_MANDIS.find((record) => cropMatchesCommodity(cropId, record.commodity))
    ?? BUILT_IN_MANDIS[0]
}

export function getMandiQuotes(cropId: string, district: string): MandiQuote[] {
  const record = BUILT_IN_MANDIS.find(
    (item) => item.district.toLowerCase() === district.toLowerCase()
      && cropMatchesCommodity(cropId, item.commodity),
  )
  if (!record) return []

  const quotes: MandiQuote[] = [
    {
      market: record.market,
      modalPrice: record.modalPrice,
      distanceKm: 0,
      isOrigin: true,
      variety: record.variety,
    },
    ...record.nearbyMandis.map((nearby) => ({
      market: nearby.name,
      modalPrice: nearby.modalPrice,
      distanceKm: nearby.distanceKm,
      isOrigin: false,
      variety: record.variety,
    })),
  ]

  return quotes.filter((quote, index) => quotes.findIndex((item) => item.market === quote.market) === index)
}

const demoMspReferences: Partial<Record<CropKey, MspReference>> = {
  wheat: { price: 2425, marketingYear: '2025–26', grade: 'FAQ wheat' },
  rice: { price: 2369, marketingYear: '2025–26', grade: 'Common paddy; not Basmati' },
  cotton: { price: 7710, marketingYear: '2025–26', grade: 'Medium staple' },
  soybean: { price: 5328, marketingYear: '2025–26', grade: 'Yellow soybean' },
  mustard: { price: 5950, marketingYear: '2025–26', grade: 'Rapeseed / mustard' },
}

export function getDemoMspReference(cropId: CropKey, variety: string): MspReference | undefined {
  if (cropId === 'rice' && /basmati/i.test(variety)) return undefined
  return demoMspReferences[cropId]
}
