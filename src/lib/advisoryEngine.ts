import { BUILT_IN_MANDIS, CROPS, cropMatchesCommodity, findMandiRecord, getCropName, getLocalizedCropName, getLocalizedPlaceName } from '../data/cropsAndMandis'
import { translate } from './localization'
import { fetchMicroclimate } from './openMeteo'
import type {
  AdvisoryResult,
  CropKey,
  DecisionType,
  MandiRecord,
  MicroclimateForecast,
  NearbyMandiQuote,
  SupportedDialect,
} from '../types'

const TRANSPORT_COST_PER_KM_PER_QUINTAL = 0.5
const MINIMUM_TRANSPORT_PROFIT = 100

const cropTerms: Record<CropKey, string[]> = {
  wheat: ['wheat', 'gehun', 'gehu', 'kanak', 'गेहूं', 'गेहूँ', 'कणक'],
  rice: ['rice', 'paddy', 'dhan', 'chawal', 'arisi', 'நெல்', 'धान', 'ਚੋਣਾ', 'ਝੋਨਾ'],
  cotton: ['cotton', 'kapas', 'narma', 'परत्ती', 'कपास', 'ਨਰਮਾ', 'பருத்தி'],
  onion: ['onion', 'pyaaz', 'pyaz', 'kanda', 'प्याज', 'காயம்', 'வெங்காயம்', 'ਗੰਢਾ'],
  tomato: ['tomato', 'tamatar', 'टमाटर', 'தக்காளி'],
  potato: ['potato', 'aloo', 'alu', 'आलू', 'உருளைக்கிழங்கு'],
  soybean: ['soybean', 'soya', 'सोयाबीन', 'ਸੋਇਆਬੀਨ', 'சோயாபீன்'],
  mustard: ['mustard', 'sarson', 'सरसों', 'ਸਰ੍ਹੋਂ', 'கடுகு'],
}

function detectCrop(query: string, selectedCrop: CropKey): CropKey {
  const normalized = query.toLowerCase()
  return CROPS.find((crop) => cropTerms[crop.id].some((term) => normalized.includes(term)))?.id ?? selectedCrop
}

function detectDistrict(query: string, selectedDistrict: string): string {
  const normalized = query.toLowerCase()
  const districts = Object.keys(BUILT_IN_MANDIS.reduce<Record<string, true>>((all, record) => {
    all[record.district] = true
    return all
  }, {}))
  if (normalized.includes(selectedDistrict.toLowerCase())) return selectedDistrict
  return districts.find((name) => normalized.includes(name.toLowerCase())) ?? selectedDistrict
}

function detectDialect(query: string, selectedDialect: SupportedDialect): SupportedDialect {
  const normalized = query.toLowerCase()
  const hasWord = (term: string) => new RegExp(`(^|[^a-z])${term}([^a-z]|$)`).test(normalized)
  if (['anna', 'pannunga', 'pannungo', 'iruka', 'varuma'].some(hasWord)) {
    return 'Tanglish'
  }
  if (['bapu', 'kehnde', 'kanak', 'naalon', 'kivein', 'veere'].some(hasWord)) {
    return 'Punjlish'
  }
  if (/[\u0B80-\u0BFF]/u.test(query)) return 'Tamil'
  if (/[\u0A00-\u0A7F]/u.test(query)) return 'Punjabi'
  if (/[\u0900-\u097F]/u.test(query)) return selectedDialect === 'Marathi' ? 'Marathi' : 'Hindi'
  return selectedDialect
}

function selectMandi(crop: CropKey, district: string): MandiRecord {
  const districtMarket = BUILT_IN_MANDIS.find(
    (record) => record.district.toLowerCase() === district.toLowerCase()
      && cropMatchesCommodity(crop, record.commodity),
  )
  return districtMarket ?? findMandiRecord(crop, district)
}

function buildSpokenResponse(
  dialect: SupportedDialect,
  district: string,
  cropId: CropKey,
  mandi: MandiRecord,
  weather: MicroclimateForecast,
  decision: DecisionType,
  bestNearby: AdvisoryResult['bestNearbyMandi'],
  nearbyMandiQuotes: NearbyMandiQuote[],
): string {
  const rain = weather.threeDayMaxRainProb
  const districtName = getLocalizedPlaceName(district, dialect)
  const marketName = getLocalizedPlaceName(mandi.market, dialect)
  const nearbyName = bestNearby ? getLocalizedPlaceName(bestNearby.name, dialect) : ''
  if (decision === 'CHECK LOCAL RATE') {
    const bestPriceNearby = nearbyMandiQuotes[0]
    if (bestPriceNearby) {
      const nearestMarket = getLocalizedPlaceName(bestPriceNearby.market, dialect)
      const reportedDate = bestPriceNearby.arrivalDate || translate(dialect, 'dateUnavailable')
      if (dialect === 'English') {
        return `No live ${getLocalizedCropName(cropId, dialect)} quote is available in ${districtName}. Among nearby available mandis, ${nearestMarket} has the highest reported price at ₹${bestPriceNearby.modalPrice} per quintal, about ${bestPriceNearby.distanceKm} km away (report date: ${reportedDate}). Check transport costs and confirm today's rate before travelling. Rain chance over the next three days is ${rain}%.`
      }
      if (dialect === 'Punjlish' || dialect === 'Punjabi') {
        return `${districtName} ਵਿੱਚ ਇਸ ਫ਼ਸਲ ਦਾ ਲਾਈਵ ਭਾਅ ਨਹੀਂ ਮਿਲਿਆ। ਨੇੜਲੀਆਂ ਮੰਡੀਆਂ ਵਿੱਚ ${nearestMarket} ਦਾ ਭਾਅ ਸਭ ਤੋਂ ਵੱਧ ਹੈ: ₹${bestPriceNearby.modalPrice} ਪ੍ਰਤੀ ਕੁਇੰਟਲ, ਲਗਭਗ ${bestPriceNearby.distanceKm} ਕਿਮੀ ਦੂਰ (${reportedDate})। ਜਾਣ ਤੋਂ ਪਹਿਲਾਂ ਅੱਜ ਦਾ ਭਾਅ ਅਤੇ ਢੋਆਈ ਖਰਚ ਪੁੱਛੋ। ਮੀਂਹ ਦੀ ਸੰਭਾਵਨਾ ${rain}% ਹੈ।`
      }
      if (dialect === 'Tanglish' || dialect === 'Tamil') {
        return `${districtName}-இல் இந்தப் பயிருக்கு நேரடி விலை இல்லை. அருகிலுள்ள சந்தைகளில் ${nearestMarket}-இல் அதிக விலை ₹${bestPriceNearby.modalPrice} ஒரு குவிண்டாலுக்கு; சுமார் ${bestPriceNearby.distanceKm} கி.மீ. (${reportedDate}). செல்லும் முன் இன்றைய விலையையும் போக்குவரத்துச் செலவையும் உறுதிசெய்யுங்கள். மழை வாய்ப்பு ${rain}%.`
      }
      if (dialect === 'Hindi') {
        return `${districtName} में इस फ़सल का लाइव भाव नहीं मिला। पास की उपलब्ध मंडियों में ${nearestMarket} का भाव सबसे अधिक है: ₹${bestPriceNearby.modalPrice} प्रति क्विंटल, लगभग ${bestPriceNearby.distanceKm} किमी दूर (${reportedDate})। जाने से पहले आज का भाव और ढुलाई खर्च पूछें। बारिश की संभावना ${rain}% है।`
      }
      if (dialect === 'Marathi') {
        return `${districtName} मध्ये या पिकाचा थेट भाव उपलब्ध नाही. जवळच्या उपलब्ध बाजारांमध्ये ${nearestMarket} येथे सर्वाधिक भाव ₹${bestPriceNearby.modalPrice} प्रति क्विंटल आहे; अंतर अंदाजे ${bestPriceNearby.distanceKm} किमी (${reportedDate}). जाण्यापूर्वी आजचा भाव आणि वाहतूक खर्च तपासा. पावसाची शक्यता ${rain}% आहे.`
      }
      return `${districtName} में इस फ़सल का लाइव भाव नहीं मिला। पास की उपलब्ध मंडियों में ${nearestMarket} का भाव सबसे अधिक है: ₹${bestPriceNearby.modalPrice} प्रति क्विंटल, लगभग ${bestPriceNearby.distanceKm} किमी दूर (${reportedDate})। जाने से पहले आज का भाव और ढुलाई खर्च पूछें। बारिश की संभावना ${rain}% है।`
    }
    if (dialect === 'English') {
      return `No recent live mandi price is available for ${districtName}. Please check today's rate at your local mandi before selling. The chance of rain over the next three days is ${rain}%.`
    }
    if (dialect === 'Punjlish' || dialect === 'Punjabi') {
      return `ਵੀਰੇ, ${districtName} ਲਈ ਨਵਾਂ ਲਾਈਵ ਮੰਡੀ ਭਾਅ ਨਹੀਂ ਮਿਲਿਆ। ਵੇਚਣ ਤੋਂ ਪਹਿਲਾਂ ਆਪਣੀ ਮੰਡੀ ਦਾ ਅੱਜ ਦਾ ਭਾਅ ਪੁੱਛੋ। ਅਗਲੇ ਤਿੰਨ ਦਿਨਾਂ ਵਿੱਚ ਮੀਂਹ ਦੀ ਸੰਭਾਵਨਾ ${rain}% ਹੈ।`
    }
    if (dialect === 'Tanglish' || dialect === 'Tamil') {
      return `${districtName} மாவட்டத்திற்கு புதிய நேரடி சந்தை விலை கிடைக்கவில்லை. விற்பதற்கு முன் உங்கள் உள்ளூர் சந்தையில் இன்றைய விலையைக் கேளுங்கள். அடுத்த மூன்று நாட்களில் மழை வாய்ப்பு ${rain}%.`
    }
    if (dialect === 'Hindi') {
      return `${districtName} का नया लाइव मंडी भाव उपलब्ध नहीं है। बेचने से पहले अपनी स्थानीय मंडी का आज का भाव पूछें। अगले तीन दिनों में बारिश की संभावना ${rain}% है।`
    }
    if (dialect === 'Marathi') {
      return `${districtName} साठी नवीन थेट बाजारभाव उपलब्ध नाही. विक्रीपूर्वी स्थानिक बाजारातील आजचा भाव तपासा. पुढील तीन दिवसांत पावसाची शक्यता ${rain}% आहे.`
    }
    return `${districtName} के लिए नया लाइव मंडी भाव नहीं मिला। बेचने से पहले अपनी स्थानीय मंडी का आज का भाव पूछें। अगले तीन दिनों में बारिश की संभावना ${rain}% है।`
  }

  if (decision === 'CHECK PRICE TREND') {
    if (dialect === 'English') {
      return `Today's live price is ₹${mandi.modalPrice} per quintal, but recent prices are not available to show a trend. Please check the latest trend at the mandi before deciding when to sell.`
    }
    if (dialect === 'Punjlish' || dialect === 'Punjabi') {
      return `ਅੱਜ ਦਾ ਲਾਈਵ ਭਾਅ ₹${mandi.modalPrice} ਪ੍ਰਤੀ ਕੁਇੰਟਲ ਹੈ, ਪਰ ਪਿਛਲੇ ਦਿਨਾਂ ਦੇ ਭਾਅ ਨਹੀਂ ਮਿਲੇ। ਵੇਚਣ ਦਾ ਫ਼ੈਸਲਾ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਮੰਡੀ ਵਿੱਚ ਭਾਅ ਦਾ ਰੁਝਾਨ ਪੁੱਛੋ।`
    }
    if (dialect === 'Tanglish' || dialect === 'Tamil') {
      return `இன்றைய நேரடி விலை ₹${mandi.modalPrice} ஒரு குவிண்டாலுக்கு. ஆனால் முந்தைய விலைத் தகவல் இல்லை. விற்பதற்கு முன் சந்தையில் விலைப் போக்கைக் கேளுங்கள்.`
    }
    if (dialect === 'Hindi') {
      return `आज का लाइव भाव ₹${mandi.modalPrice} प्रति क्विंटल है, लेकिन पिछले दिनों का भाव उपलब्ध नहीं है। बेचने का फैसला करने से पहले मंडी में भाव का रुझान पूछें।`
    }
    if (dialect === 'Marathi') {
      return `आजचा थेट भाव ₹${mandi.modalPrice} प्रति क्विंटल आहे; मागील भाव उपलब्ध नाहीत. विक्रीचा निर्णय घेण्यापूर्वी बाजारातील भावाचा कल तपासा.`
    }
    return `आज का लाइव भाव ₹${mandi.modalPrice} प्रति क्विंटल है, लेकिन पिछले दिनों के भाव उपलब्ध नहीं हैं। बेचने से पहले मंडी में भाव का रुझान पूछें।`
  }

  if (dialect === 'English') {
    if (decision === 'TRANSPORT TO NEARBY MANDI' && bestNearby) {
      return `${nearbyName} mandi is offering ₹${bestNearby.modalPrice} per quintal. After estimated transport costs, you could get about ₹${bestNearby.extraProfitPerQuintal} more per quintal.`
    }
    if (decision === 'HOLD FOR 2 DAYS') {
      return `The mandi price is ₹${mandi.modalPrice} per quintal and the chance of rain over the next three days is ${rain}%. Wait two days and check the price again before deciding.`
    }
    return `There is a ${rain}% chance of rain over the next three days. Protect your crop from moisture. You may consider selling at ${marketName} mandi today at ₹${mandi.modalPrice} per quintal.`
  }

  if (dialect === 'Punjlish' || dialect === 'Punjabi') {
    if (decision === 'TRANSPORT TO NEARBY MANDI' && bestNearby) {
      return `ਵੀਰੇ, ${nearbyName} ਮੰਡੀ ਵਿੱਚ ₹${bestNearby.modalPrice} ਦਾ ਭਾਅ ਹੈ। ਢੋਆਈ ਕੱਢ ਕੇ ਵੀ ਲਗਭਗ ₹${bestNearby.extraProfitPerQuintal} ਪ੍ਰਤੀ ਕੁਇੰਟਲ ਫ਼ਾਇਦਾ ਹੈ।`
    }
    if (decision === 'HOLD FOR 2 DAYS') {
      return `ਮੰਡੀ ਦਾ ਭਾਅ ₹${mandi.modalPrice} ਹੈ ਅਤੇ ਅਗਲੇ ਤਿੰਨ ਦਿਨਾਂ ਵਿੱਚ ਮੀਂਹ ਦੀ ਸੰਭਾਵਨਾ ${rain}% ਹੈ। ਦੋ ਦਿਨ ਰੁਕ ਕੇ ਭਾਅ ਫਿਰ ਪੁੱਛੋ।`
    }
    return `ਅਗਲੇ ਤਿੰਨ ਦਿਨਾਂ ਵਿੱਚ ਮੀਂਹ ਦੀ ਸੰਭਾਵਨਾ ${rain}% ਹੈ। ਫ਼ਸਲ ਨੂੰ ਨੁਕਸਾਨ ਤੋਂ ਬਚਾਉਣ ਲਈ ${marketName} ਮੰਡੀ ਵਿੱਚ ਅੱਜ ₹${mandi.modalPrice} ਪ੍ਰਤੀ ਕੁਇੰਟਲ ਵੇਚਣ ਬਾਰੇ ਸੋਚੋ।`
  }
  if (dialect === 'Tanglish' || dialect === 'Tamil') {
    if (decision === 'TRANSPORT TO NEARBY MANDI' && bestNearby) {
      return `அண்ணா, ${nearbyName} சந்தையில் ₹${bestNearby.modalPrice} விலை உள்ளது. போக்குவரத்துச் செலவைக் கழித்தும் ஒரு குவிண்டாலுக்கு ₹${bestNearby.extraProfitPerQuintal} கூடுதலாகக் கிடைக்கும்.`
    }
    if (decision === 'HOLD FOR 2 DAYS') {
      return `சந்தை விலை ₹${mandi.modalPrice}. அடுத்த மூன்று நாட்களில் மழை வாய்ப்பு ${rain}%. இரண்டு நாட்கள் காத்திருந்து விலையை மீண்டும் கேளுங்கள்.`
    }
    return `அடுத்த மூன்று நாட்களில் மழை வாய்ப்பு ${rain}%. ஈரத்திலிருந்து விளைச்சலைப் பாதுகாக்க ${marketName} சந்தையில் இன்று ஒரு குவிண்டாலுக்கு ₹${mandi.modalPrice} விலையில் விற்கலாம்.`
  }
  if (dialect === 'Hindi') {
    if (decision === 'HOLD FOR 2 DAYS') return `मंडी में भाव ₹${mandi.modalPrice} प्रति क्विंटल है और बारिश की संभावना ${rain}% है। दो दिन रुककर भाव फिर जाँचें।`
    if (decision === 'TRANSPORT TO NEARBY MANDI' && bestNearby) return `${nearbyName} मंडी में ₹${bestNearby.modalPrice} का भाव है। भाड़ा निकालकर भी लगभग ₹${bestNearby.extraProfitPerQuintal} प्रति क्विंटल का फायदा है।`
    return `अगले तीन दिनों में बारिश की संभावना ${rain}% है। फसल को नमी से बचाने के लिए ${marketName} मंडी में आज ₹${mandi.modalPrice} प्रति क्विंटल पर बेचने पर विचार करें।`
  }
  if (dialect === 'Marathi') {
    if (decision === 'HOLD FOR 2 DAYS') return `बाजारभाव ₹${mandi.modalPrice} प्रति क्विंटल आहे आणि पावसाची शक्यता ${rain}% आहे. दोन दिवस थांबून भाव पुन्हा तपासा.`
    if (decision === 'TRANSPORT TO NEARBY MANDI' && bestNearby) return `${nearbyName} बाजारात ₹${bestNearby.modalPrice} भाव आहे. वाहतूक खर्च वजा करूनही अंदाजे ₹${bestNearby.extraProfitPerQuintal} प्रति क्विंटल फायदा होईल.`
    return `पुढील तीन दिवसांत पावसाची शक्यता ${rain}% आहे. पिकाचे नुकसान टाळण्यासाठी आज ${marketName} बाजारात ₹${mandi.modalPrice} प्रति क्विंटलने विक्रीचा विचार करा.`
  }
  if (decision === 'TRANSPORT TO NEARBY MANDI' && bestNearby) {
    return `भैया, ${nearbyName} मंडी में ₹${bestNearby.modalPrice} का भाव है। ढुलाई निकालकर भी लगभग ₹${bestNearby.extraProfitPerQuintal} प्रति क्विंटल ज़्यादा मिलेंगे।`
  }
  if (decision === 'HOLD FOR 2 DAYS') {
    return `मंडी में भाव ₹${mandi.modalPrice} प्रति क्विंटल है और अगले तीन दिनों में बारिश की संभावना ${rain}% है। दो दिन रुककर भाव फिर पूछें।`
  }
  return `अगले तीन दिनों में बारिश की संभावना ${rain}% है। फ़सल को नमी से बचाने के लिए ${marketName} मंडी में आज ₹${mandi.modalPrice} प्रति क्विंटल बेचने पर विचार करें।`
}

export async function processFarmerQuery(
  rawInput: { textQuery?: string; audioBase64?: string },
  selectedDistrict: string,
  selectedCrop: CropKey,
  selectedDialect: SupportedDialect,
  weatherOverride?: MicroclimateForecast,
  liveMandiRecords?: MandiRecord[],
  nearbyMandiQuotes: NearbyMandiQuote[] = [],
): Promise<AdvisoryResult> {
  const query = rawInput.textQuery?.trim() ?? ''
  const detectedDialect = detectDialect(query, selectedDialect)
  const cropId = detectCrop(query, selectedCrop)
  const district = detectDistrict(query, selectedDistrict)
  const liveMandi = liveMandiRecords?.find(
    (record) => record.district.toLowerCase() === district.toLowerCase()
      && cropMatchesCommodity(cropId, record.commodity),
  )
  const mandi = liveMandi ?? selectMandi(cropId, district)
  const hasLocalMarketQuote = liveMandiRecords === undefined
    ? mandi.district.toLowerCase() === district.toLowerCase()
    : liveMandi !== undefined
  const weather = weatherOverride ?? await fetchMicroclimate(district)

  const nearbyOptions = (hasLocalMarketQuote ? mandi.nearbyMandis : [])
    .map((nearby) => ({
      ...nearby,
      extraProfitPerQuintal: Math.round(
        nearby.modalPrice - mandi.modalPrice - nearby.distanceKm * TRANSPORT_COST_PER_KM_PER_QUINTAL,
      ),
    }))
    .filter((nearby) => nearby.extraProfitPerQuintal > 0)
    .sort((a, b) => b.extraProfitPerQuintal - a.extraProfitPerQuintal)
  const best = nearbyOptions[0]
  const bestNearbyMandi = best
    ? {
        name: best.name,
        modalPrice: best.modalPrice,
        extraProfitPerQuintal: best.extraProfitPerQuintal,
        distanceKm: best.distanceKm,
      }
    : undefined

  const rainRiskLabel = weather.rainRiskLevel === 'HIGH'
    ? translate(detectedDialect, 'high')
    : weather.rainRiskLevel === 'MODERATE'
      ? translate(detectedDialect, 'moderate')
      : translate(detectedDialect, 'low')
  let decisionBadge: DecisionType = liveMandiRecords === undefined ? 'SELL TODAY' : 'CHECK PRICE TREND'
  let microclimateAlert = translate(detectedDialect, 'alertRisk', {
    risk: rainRiskLabel,
    rain: weather.threeDayMaxRainProb,
  })
  const explicitMarketComparison = /better|naalon|compare|transport|le ja|behtar/.test(query.toLowerCase())
  if (!hasLocalMarketQuote) {
    decisionBadge = 'CHECK LOCAL RATE'
    microclimateAlert = translate(detectedDialect, 'alertMissingQuote', {
      district: getLocalizedPlaceName(district, detectedDialect),
      crop: getLocalizedCropName(cropId, detectedDialect),
      market: getLocalizedPlaceName(mandi.market, detectedDialect),
      risk: rainRiskLabel,
      rain: weather.threeDayMaxRainProb,
    })
  } else if (weather.threeDayMaxRainProb >= 60) {
    decisionBadge = 'SELL TODAY'
    microclimateAlert = translate(detectedDialect, 'alertHeavyRain', {
      rain: weather.threeDayMaxRainProb,
      district: getLocalizedPlaceName(district, detectedDialect),
    })
  } else if (
    best
    && (best.extraProfitPerQuintal >= MINIMUM_TRANSPORT_PROFIT
      || (explicitMarketComparison && best.extraProfitPerQuintal > 0))
  ) {
    decisionBadge = 'TRANSPORT TO NEARBY MANDI'
    microclimateAlert = translate(detectedDialect, 'alertTransport', { district: getLocalizedPlaceName(district, detectedDialect) })
  } else if (liveMandiRecords === undefined && mandi.modalPrice >= mandi.yesterdayPrice && weather.threeDayMaxRainProb < 40) {
    decisionBadge = 'HOLD FOR 2 DAYS'
    microclimateAlert = translate(detectedDialect, 'alertHold', {
      rain: weather.threeDayMaxRainProb,
      humidity: weather.currentHumidity,
    })
  } else {
    microclimateAlert = translate(detectedDialect, 'alertStable', { risk: rainRiskLabel })
  }

  return {
    farmerSpeechTranscript: query || `${getCropName(cropId)} price and weather check`,
    detectedDialect,
    cropId,
    cropDetected: mandi.commodity,
    mandiDetected: mandi.market,
    currentModalPrice: mandi.modalPrice,
    minPrice: mandi.minPrice,
    maxPrice: mandi.maxPrice,
    hasLocalMarketQuote,
    bestNearbyMandi,
    microclimateAlert,
    decisionBadge,
    spokenAdvisoryResponse: buildSpokenResponse(
      detectedDialect,
      district,
      cropId,
      mandi,
      weather,
      decisionBadge,
      bestNearbyMandi,
      nearbyMandiQuotes,
    ),
    nearbyMandiQuotes: nearbyMandiQuotes.length ? nearbyMandiQuotes : undefined,
    isSimulated: true,
    answerSource: 'local',
    weatherSource: weather.source,
    cachedAt: Date.now(),
  }
}
