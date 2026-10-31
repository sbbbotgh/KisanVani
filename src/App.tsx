import { useCallback, useEffect, useRef, useState } from 'react'
import { m } from 'framer-motion'
import { ArrowRight, Check, CloudRain, LoaderCircle, MapPin, TrendingUp, X } from 'lucide-react'
import './App.css'
import { BrandLogo } from './components/BrandLogo'
import { CropIcon } from './components/CropIcons'
import { DecisionSheet } from './components/DecisionSheet'
import { Header } from './components/Header'
import { JudgeDemoModal } from './components/JudgeDemoModal'
import { LandingPage } from './components/LandingPage'
import { MandiComparison } from './components/MandiComparison'
import { PriceCard } from './components/PriceCard'
import { VoiceOrb } from './components/VoiceOrb'
import { WeatherCard } from './components/WeatherCard'
import { CROPS, cropMatchesCommodity, DISTRICT_COORDINATES, DISTRICT_OPTIONS, getLocalizedCropName, getLocalizedPlaceName } from './data/cropsAndMandis'
import { LowBandwidthAudioRecorder } from './lib/audioRecorder'
import { processFarmerQuery } from './lib/advisoryEngine'
import { requestGeminiAdvice } from './lib/geminiAdvice'
import { fetchLiveMandiRecords, MandiApiError, toAdvisoryMandiRecords } from './lib/mandiApi'
import { fetchMicroclimateAtCoordinates, searchIndianLocations } from './lib/openMeteo'
import { findNearbyMandiQuotes } from './lib/nearbyMandis'
import { stopSpeaking, transcribeRecordedAudio, VoiceApiError } from './lib/speechSynth'
import { getUiLocale, translate } from './lib/localization'
import type { AdvisoryResult, CropKey, JudgeDemo, LiveMandiRecord, MandiLocation, MicroclimateForecast, NearbyMandiQuote, SupportedDialect } from './types'
import { GLASS_SURFACE, PAGE_PALETTE } from './components/ui'

type AppView = 'landing' | 'app'
type ThemePreference = 'system' | 'light' | 'dark'

interface VoiceSession {
  stopping: boolean
}

type MandiDataStatus = 'loading' | 'ready' | 'unavailable' | 'unconfigured'

const dialects: SupportedDialect[] = ['English', 'Hinglish', 'Punjlish', 'Tanglish', 'Hindi', 'Punjabi', 'Tamil', 'Marathi']
const NO_MANDI_RECORDS: LiveMandiRecord[] = []
const dialectLabels: Record<SupportedDialect, string> = {
  English: 'English',
  Hinglish: 'Hinglish · हिन्दी',
  Punjlish: 'Punjlish · ਪੰਜਾਬੀ',
  Tanglish: 'Tanglish · தமிழ்',
  Hindi: 'हिन्दी · Hindi',
  Punjabi: 'ਪੰਜਾਬੀ · Punjabi',
  Tamil: 'தமிழ் · Tamil',
  Marathi: 'मराठी · Marathi',
}
const DEFAULT_LOCATION: MandiLocation = { ...DISTRICT_COORDINATES.Ludhiana, state: 'Punjab' }

async function addGeminiAnswer(
  result: AdvisoryResult,
  question: string,
  crop: CropKey,
  district: string,
  state: string,
  weather: MicroclimateForecast,
  mandiRecords: LiveMandiRecord[],
  nearbyMandiQuotes: NearbyMandiQuote[],
): Promise<AdvisoryResult> {
  try {
    const answer = await requestGeminiAdvice({
      question,
      dialect: result.detectedDialect,
      crop,
      district,
      state,
      weather,
      mandiRecords: [
        ...mandiRecords.filter((record) => record.district.toLowerCase() === district.toLowerCase()),
        ...mandiRecords.filter((record) => record.district.toLowerCase() !== district.toLowerCase()),
      ].slice(0, 8),
      nearbyMandiQuotes,
    })
    return {
      ...result,
      decisionBadge: answer.decisionBadge,
      decisionReason: answer.decisionReason,
      spokenAdvisoryResponse: answer.spokenAdvisoryResponse,
      answerSource: 'gemini',
    }
  } catch (error) {
    console.warn('Gemini advice unavailable; showing the on-device advisory', error)
    return { ...result, answerSource: 'local' }
  }
}

function getSampleDemoWeather(demoId: string): MicroclimateForecast {
  const rain = demoId === 'demo-hinglish' ? [78, 64, 42] : [12, 18, 9]
  const maxRain = Math.max(...rain)
  return {
    currentTemp: 29,
    currentHumidity: demoId === 'demo-hinglish' ? 77 : 54,
    windSpeed: 10,
    threeDayMaxRainProb: maxRain,
    rainRiskLevel: maxRain >= 60 ? 'HIGH' : maxRain >= 35 ? 'MODERATE' : 'LOW',
    rawDailyRain: rain,
    source: 'demo',
  }
}

function App() {
  const hasDemoHash = typeof window !== 'undefined' && window.location.hash === '#demo'
  const [view, setView] = useState<AppView>(hasDemoHash ? 'app' : 'landing')
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    try {
      const saved = localStorage.getItem('kisanvani_theme')
      return saved === 'light' || saved === 'dark' ? saved : 'system'
    } catch {
      return 'system'
    }
  })
  const [is2GLiteMode, setIs2GLiteMode] = useState(true)
  const [selectedDialect, setSelectedDialect] = useState<SupportedDialect>('Hinglish')
  const [selectedLocation, setSelectedLocation] = useState<MandiLocation>(DEFAULT_LOCATION)
  const [locationQuery, setLocationQuery] = useState(DEFAULT_LOCATION.district)
  const [locationResults, setLocationResults] = useState<MandiLocation[]>([])
  const [locationSearchFailed, setLocationSearchFailed] = useState(false)
  const [isLocationSearchOpen, setIsLocationSearchOpen] = useState(false)
  const [isLocationSearching, setIsLocationSearching] = useState(false)
  const [currentLocationCoordinates, setCurrentLocationCoordinates] = useState<{ lat: number; lon: number } | null>(null)
  const [isFindingCurrentLocation, setIsFindingCurrentLocation] = useState(false)
  const [selectedCropId, setSelectedCropId] = useState<CropKey>('wheat')
  const [isRecording, setIsRecording] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [recordedPayloadKb, setRecordedPayloadKb] = useState(0)
  const [weather, setWeather] = useState<MicroclimateForecast | null>(null)
  const [weatherKey, setWeatherKey] = useState('')
  const [mandiRecords, setMandiRecords] = useState<LiveMandiRecord[]>([])
  const [mandiDataStatus, setMandiDataStatus] = useState<MandiDataStatus>('loading')
  const [mandiDataKey, setMandiDataKey] = useState('')
  const [nearbyMandiQuotes, setNearbyMandiQuotes] = useState<NearbyMandiQuote[]>([])
  const [nearbySearchStatus, setNearbySearchStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle')
  const [advisoryResult, setAdvisoryResult] = useState<AdvisoryResult | null>(null)
  const [advisoryAutoSpeak, setAdvisoryAutoSpeak] = useState(false)
  const [showDemoModal, setShowDemoModal] = useState(hasDemoHash)
  const [showLanguagePicker, setShowLanguagePicker] = useState(false)
  const [textQuery, setTextQuery] = useState('')
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const selectedDistrict = selectedLocation.district
  const selectedState = selectedLocation.state
  const selectedMandiKey = selectedState ? `${selectedState}:${selectedCropId}` : ''
  const currentMandiRecords = mandiDataKey === selectedMandiKey ? mandiRecords : NO_MANDI_RECORDS
  const currentMandiDataStatus: MandiDataStatus = mandiDataKey === selectedMandiKey ? mandiDataStatus : 'loading'
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(selectedDialect, key, values)
  const weatherCoordinates = currentLocationCoordinates ?? { lat: selectedLocation.lat, lon: selectedLocation.lon }
  const currentWeatherKey = `${weatherCoordinates.lat.toFixed(3)},${weatherCoordinates.lon.toFixed(3)}`
  const currentWeather = weatherKey === currentWeatherKey ? weather : null
  const getActiveWeather = useCallback(async () => {
    if (weather && weatherKey === currentWeatherKey) return weather
    return fetchMicroclimateAtCoordinates(
      weatherCoordinates.lat,
      weatherCoordinates.lon,
      `kisanvani_weather_${currentWeatherKey}`,
    )
  }, [currentWeatherKey, weather, weatherCoordinates.lat, weatherCoordinates.lon, weatherKey])

  const [recorder] = useState(() => new LowBandwidthAudioRecorder())
  const voiceSessionRef = useRef<VoiceSession | null>(null)
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFinishingRef = useRef(false)
  const typedQueryRef = useRef('')
  const nearbyRequestRef = useRef<{ key: string; promise: Promise<NearbyMandiQuote[]> } | null>(null)

  const getNearbyQuotes = useCallback((): Promise<NearbyMandiQuote[]> => {
    const hasLocalQuote = currentMandiRecords.some((record) =>
      record.district.toLowerCase() === selectedDistrict.toLowerCase()
      && cropMatchesCommodity(selectedCropId, record.commodity))
    if (currentMandiDataStatus !== 'ready' || hasLocalQuote) return Promise.resolve([])

    const origin = {
      ...selectedLocation,
      lat: currentLocationCoordinates?.lat ?? selectedLocation.lat,
      lon: currentLocationCoordinates?.lon ?? selectedLocation.lon,
    }
    const requestKey = `${selectedState}:${selectedDistrict}:${selectedCropId}:${currentMandiRecords.length}:${origin.lat.toFixed(3)},${origin.lon.toFixed(3)}`
    if (nearbyRequestRef.current?.key === requestKey) return nearbyRequestRef.current.promise
    setNearbySearchStatus('loading')
    const promise = findNearbyMandiQuotes(currentMandiRecords, selectedCropId, origin)
      .then((quotes) => {
        if (nearbyRequestRef.current?.key === requestKey) {
          setNearbyMandiQuotes(quotes)
          setNearbySearchStatus('ready')
        }
        return quotes
      })
      .catch((error: unknown) => {
        console.warn('Nearby live mandi lookup failed', error)
        if (nearbyRequestRef.current?.key === requestKey) {
          setNearbyMandiQuotes([])
          setNearbySearchStatus('unavailable')
        }
        return []
      })
    nearbyRequestRef.current = { key: requestKey, promise }
    return promise
  }, [currentLocationCoordinates, currentMandiDataStatus, currentMandiRecords, selectedCropId, selectedDistrict, selectedLocation, selectedState])

  useEffect(() => {
    const timer = setTimeout(() => void getNearbyQuotes(), 0)
    return () => clearTimeout(timer)
  }, [getNearbyQuotes])

  useEffect(() => {
    document.documentElement.lang = getUiLocale(selectedDialect)
  }, [selectedDialect])

  useEffect(() => {
    const root = document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      root.dataset.theme = themePreference === 'system'
        ? mediaQuery.matches ? 'dark' : 'light'
        : themePreference
      root.dataset.themePreference = themePreference
      root.classList.toggle('dark', root.dataset.theme === 'dark')
    }
    applyTheme()
    mediaQuery.addEventListener('change', applyTheme)
    try {
      localStorage.setItem('kisanvani_theme', themePreference)
    } catch {
      // The selected theme remains active for this session if storage is unavailable.
    }
    return () => mediaQuery.removeEventListener('change', applyTheme)
  }, [themePreference])

  useEffect(() => {
    let active = true
    void fetchMicroclimateAtCoordinates(
      weatherCoordinates.lat,
      weatherCoordinates.lon,
      `kisanvani_weather_${currentWeatherKey}`,
    ).then((forecast) => {
      if (active) {
        setWeather(forecast)
        setWeatherKey(currentWeatherKey)
      }
    })
    return () => { active = false }
  }, [currentWeatherKey, weatherCoordinates.lat, weatherCoordinates.lon])

  useEffect(() => {
    if (!isLocationSearchOpen || locationQuery.trim().length < 2 || locationQuery.trim() === selectedLocation.district) {
      return
    }

    let active = true
    const timer = setTimeout(() => {
      setIsLocationSearching(true)
      setLocationSearchFailed(false)
      void searchIndianLocations(locationQuery.trim()).then((results) => {
        if (active) {
          setLocationResults(results)
          setLocationSearchFailed(false)
        }
      }).catch((error: unknown) => {
        console.error('Indian location search failed', error)
        if (active) {
          setLocationResults([])
          setLocationSearchFailed(true)
        }
      }).finally(() => {
        if (active) setIsLocationSearching(false)
      })
    }, 350)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [isLocationSearchOpen, locationQuery, selectedLocation.district])

  useEffect(() => {
    let active = true
    if (!selectedState) return () => { active = false }

    const requestKey = `${selectedState}:${selectedCropId}`
    void fetchLiveMandiRecords(selectedState, selectedCropId).then((response) => {
      if (active) {
        setMandiRecords(response.records)
        setMandiDataStatus('ready')
        setMandiDataKey(requestKey)
      }
    }).catch((error: unknown) => {
      if (!active) return
      setMandiDataStatus(error instanceof MandiApiError && error.status === 503 ? 'unconfigured' : 'unavailable')
      setMandiDataKey(requestKey)
    })
    return () => { active = false }
  }, [selectedCropId, selectedState])

  const handleUseCurrentLocation = () => {
    if (currentLocationCoordinates) {
      setCurrentLocationCoordinates(null)
      return
    }
    if (!navigator.geolocation) {
      setStatusMessage(t('statusLocationUnavailable'))
      return
    }
    setIsFindingCurrentLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocationCoordinates({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
        setIsFindingCurrentLocation(false)
        setStatusMessage('')
      },
      (error) => {
        console.warn('Current location could not be obtained', error.message)
        setIsFindingCurrentLocation(false)
        setStatusMessage(t('statusLocationUnavailable'))
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  const selectMandiLocation = (location: MandiLocation) => {
    setSelectedLocation(location)
    setLocationQuery(location.district)
    setLocationResults([])
    setLocationSearchFailed(false)
    setIsLocationSearching(false)
    setIsLocationSearchOpen(false)
    setStatusMessage('')
  }

  useEffect(() => () => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
    recorder.cancelRecording()
    stopSpeaking()
  }, [recorder])

  const finishVoiceSession = useCallback(async (session: VoiceSession) => {
    if (session.stopping || isFinishingRef.current) return
    session.stopping = true
    isFinishingRef.current = true
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
    stopTimerRef.current = null
    setIsRecording(false)
    setIsLoading(true)
    setStatusMessage('')

    try {
      const audioResult = await recorder.stopRecording()
      setRecordedPayloadKb(audioResult.sizeKb)
      const typedQuery = typedQueryRef.current.trim()
      const query = typedQuery || await transcribeRecordedAudio(audioResult.blob, selectedDialect)
      if (!query) {
        setStatusMessage(translate(selectedDialect, 'statusNoTranscript'))
        return
      }

      setVoiceTranscript(query)
      const [activeWeather, nearbyQuotes] = await Promise.all([getActiveWeather(), getNearbyQuotes()])
      const localResult = await processFarmerQuery(
        { textQuery: query },
        selectedDistrict,
        selectedCropId,
        selectedDialect,
        activeWeather,
        toAdvisoryMandiRecords(currentMandiRecords),
        nearbyQuotes,
      )
      const result = await addGeminiAnswer(
        localResult,
        query,
        selectedCropId,
        selectedDistrict,
        selectedState,
        activeWeather,
        currentMandiRecords,
        nearbyQuotes,
      )
      if (result.answerSource === 'local') setStatusMessage(translate(selectedDialect, 'statusGeminiFallback'))
      setAdvisoryAutoSpeak(true)
      setAdvisoryResult(result)
    } catch (error) {
      console.error('Voice note processing failed', error)
      setStatusMessage(translate(
        selectedDialect,
        error instanceof VoiceApiError && error.status === 503 ? 'statusVoiceNotConfigured' : 'statusTranscriptionFailed',
      ))
    } finally {
      setIsLoading(false)
      if (voiceSessionRef.current === session) voiceSessionRef.current = null
      isFinishingRef.current = false
    }
  }, [getActiveWeather, getNearbyQuotes, recorder, selectedCropId, selectedDialect, selectedDistrict, selectedState, currentMandiRecords])

  const handleStartVoice = async () => {
    if (isLoading || isRecording) return
    setStatusMessage('')
    setVoiceTranscript('')
    setTextQuery('')
    typedQueryRef.current = ''
    try {
      await recorder.startRecording(is2GLiteMode)
      const session: VoiceSession = { stopping: false }
      voiceSessionRef.current = session
      setIsRecording(true)

      stopTimerRef.current = setTimeout(
        () => void finishVoiceSession(session),
        is2GLiteMode ? 8000 : 30000,
      )
    } catch (error) {
      console.error('Voice recording could not start', error)
      setStatusMessage(t('statusRecordingUnavailable'))
      setIsRecording(false)
    }
  }

  const handleStopVoice = () => {
    const session = voiceSessionRef.current
    if (session) void finishVoiceSession(session)
  }

  const runTextQuery = async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed || isLoading) return
    setStatusMessage('')
    setIsLoading(true)
    setVoiceTranscript(trimmed)
    try {
      const [activeWeather, nearbyQuotes] = await Promise.all([getActiveWeather(), getNearbyQuotes()])
      const localResult = await processFarmerQuery(
        { textQuery: trimmed },
        selectedDistrict,
        selectedCropId,
        selectedDialect,
        activeWeather,
        toAdvisoryMandiRecords(currentMandiRecords),
        nearbyQuotes,
      )
      const result = await addGeminiAnswer(
        localResult,
        trimmed,
        selectedCropId,
        selectedDistrict,
        selectedState,
        activeWeather,
        currentMandiRecords,
        nearbyQuotes,
      )
      if (result.answerSource === 'local') setStatusMessage(translate(selectedDialect, 'statusGeminiFallback'))
      setAdvisoryAutoSpeak(false)
      setAdvisoryResult(result)
    } catch (error) {
      console.error('Text advisory could not be prepared', error)
      setStatusMessage(t('statusCouldNotPrepare'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectDemo = async (demo: JudgeDemo) => {
    setShowDemoModal(false)
    const demoLocation = DISTRICT_OPTIONS.find((option) => option.district === demo.district)
    const coordinates = DISTRICT_COORDINATES[demo.district]
    if (demoLocation && coordinates) {
      selectMandiLocation({ ...coordinates, state: demoLocation.state })
    }
    setSelectedCropId(demo.crop)
    setSelectedDialect(demo.dialect)
    setVoiceTranscript(demo.displayTranscript)
    setStatusMessage('')
    setIsLoading(true)
    try {
      const result = await processFarmerQuery(
        { textQuery: demo.displayTranscript },
        demo.district,
        demo.crop,
        demo.dialect,
        getSampleDemoWeather(demo.id),
      )
      setAdvisoryAutoSpeak(false)
      setAdvisoryResult(result)
    } catch (error) {
      console.error('Demo scenario could not be run', error)
      setStatusMessage(t('statusDemoFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  if (view === 'landing') {
    return <LandingPage
      dialect={selectedDialect}
      onSelectDialect={setSelectedDialect}
      onLaunchApp={() => setView('app')}
    />
  }

  return (
    <div className={`app-view paper-texture ${PAGE_PALETTE}`}>
      <Header
        is2GLiteMode={is2GLiteMode}
        setIs2GLiteMode={setIs2GLiteMode}
        selectedDialect={selectedDialect}
        onOpenLanguagePicker={() => setShowLanguagePicker(true)}
        onOpenDemoModal={() => setShowDemoModal(true)}
        recordedPayloadKb={recordedPayloadKb}
        onExitApp={() => setView('landing')}
        themePreference={themePreference}
        onCycleTheme={() => setThemePreference((current) => current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system')}
      />

      <main className="dashboard">
        <div className="dashboard-welcome">
          <div>
            <span className="card-kicker">{t('dashboardKicker')}</span>
            <h1>{t('dashboardTitle')}</h1>
            <p>{t('dashboardIntro')}</p>
          </div>
          <div className="location-controls">
            <label className={`district-picker ${GLASS_SURFACE}`}>
              <MapPin aria-hidden="true" size={18} strokeWidth={1.5} />
              <input
                value={locationQuery}
                onFocus={() => setIsLocationSearchOpen(true)}
                onChange={(event) => {
                  setLocationQuery(event.target.value)
                  setLocationResults([])
                  setLocationSearchFailed(false)
                  setIsLocationSearching(false)
                  setIsLocationSearchOpen(true)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setLocationQuery(selectedDistrict)
                    setIsLocationSearchOpen(false)
                  } else if (event.key === 'Enter' && locationResults[0]) {
                    event.preventDefault()
                    selectMandiLocation(locationResults[0])
                  }
                }}
                aria-label={t('selectDistrict')}
                aria-autocomplete="list"
                aria-controls="location-search-results"
                aria-expanded={isLocationSearchOpen}
                placeholder={t('searchLocation')}
              />
            </label>
            <m.button
              type="button"
              className={`current-location-button ${GLASS_SURFACE}`}
              onClick={handleUseCurrentLocation}
              disabled={isFindingCurrentLocation}
              aria-pressed={Boolean(currentLocationCoordinates)}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 520, damping: 26 }}
            >
              {isFindingCurrentLocation ? t('locationSearching') : currentLocationCoordinates ? t('mandiLocationWeather') : t('useCurrentLocation')}
            </m.button>
            {isLocationSearchOpen && locationQuery.trim().length >= 2 && (
              <div className="location-results" id="location-search-results" role="listbox" aria-label={t('selectDistrict')}>
                {isLocationSearching && <p>{t('locationSearching')}</p>}
                {!isLocationSearching && locationResults.length === 0 && <p>{locationSearchFailed ? t('locationSearchFailed') : t('noLocationsFound')}</p>}
                {locationResults.map((location) => (
                  <m.button
                    type="button"
                    role="option"
                    aria-selected={location.district === selectedDistrict && location.state === selectedState}
                    key={`${location.state}:${location.district}`}
                    onClick={() => selectMandiLocation(location)}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                  >
                    {getLocalizedPlaceName(location.district, selectedDialect)} · {getLocalizedPlaceName(location.state, selectedDialect)}
                  </m.button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="connection-status">
          <span className={currentWeather?.source === 'live' ? 'connection-live' : 'connection-offline'} />
          {!currentWeather ? t('checkingWeather') : currentWeather.source === 'live' ? t('liveWeather') : currentWeather.source === 'cache' ? t('savedWeather') : t('sampleWeather')}
          <span className="status-divider">·</span>
          {currentMandiDataStatus === 'ready' ? t('liveMandiStatus') : currentMandiDataStatus === 'loading' ? t('loadingMandi') : t('mandiUnavailableStatus')}
        </div>

        <section className={`crop-picker ${GLASS_SURFACE}`} aria-labelledby="crop-picker-title">
          <div className="section-title-row"><h2 id="crop-picker-title">{t('chooseCrop')}</h2><small>{t('cropHint')}</small></div>
          <div className="crop-grid">
            {CROPS.map((crop) => (
              <m.button
                type="button"
                key={crop.id}
                className={`crop-option ${selectedCropId === crop.id ? 'selected' : ''}`}
                onClick={() => setSelectedCropId(crop.id)}
                aria-pressed={selectedCropId === crop.id}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 520, damping: 26 }}
              >
                <CropIcon cropId={crop.id} size={22} />
                <span>{getLocalizedCropName(crop.id, selectedDialect)}</span>
              </m.button>
            ))}
          </div>
        </section>

        <section className={`voice-panel ${GLASS_SURFACE}`} aria-label={t('voiceFirst')}>
          <div className="voice-panel-copy">
            <span className="card-kicker">{t('voiceFirst')} · {selectedDialect.toUpperCase()}</span>
            <h2>{t('voiceHeading')}</h2>
            <p>{t('voiceDescription')}</p>
            <div className="sample-questions">
              <span>{t('try')}</span>
              <m.button type="button" onClick={() => setTextQuery(t('samplePriceQuery'))} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 520, damping: 26 }}>
                <TrendingUp aria-hidden="true" size={15} strokeWidth={1.5} />{t('samplePrice')}
              </m.button>
              <m.button type="button" onClick={() => setTextQuery(t('sampleRainQuery'))} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 520, damping: 26 }}>
                <CloudRain aria-hidden="true" size={15} strokeWidth={1.5} />{t('sampleRain')}
              </m.button>
            </div>
          </div>
          <VoiceOrb
            isRecording={isRecording}
            isLoading={isLoading}
            onStartRecording={() => void handleStartVoice()}
            onStopRecording={handleStopVoice}
            is2GLiteMode={is2GLiteMode}
            dialect={selectedDialect}
          />
        </section>

        {(isRecording || voiceTranscript) && (
          <div className={`transcript-card ${isRecording ? 'active' : ''}`} aria-live="polite">
            <span>{isRecording ? t('listening') : t('typeQuestion')}</span>
            <p>{voiceTranscript || t('listeningPrompt')}</p>
          </div>
        )}

        <form className={`text-query-form ${GLASS_SURFACE}`} onSubmit={(event) => {
          event.preventDefault()
          const session = voiceSessionRef.current
          if (session) void finishVoiceSession(session)
          else void runTextQuery(textQuery)
        }}>
          <label htmlFor="question-input">{t('typeQuestion')}</label>
          <div className="question-input-row">
            <input id="question-input" lang={getUiLocale(selectedDialect)} value={textQuery} onChange={(event) => { setTextQuery(event.target.value); typedQueryRef.current = event.target.value }} placeholder={t('queryPlaceholder')} />
            <m.button type="submit" disabled={!textQuery.trim() || isLoading} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 520, damping: 26 }}>{t('getAdvice')} <ArrowRight aria-hidden="true" size={18} strokeWidth={1.5} /></m.button>
          </div>
        </form>

        {statusMessage && <div className="status-message" role="status">{statusMessage}</div>}

        <div className="farm-info-grid">
          {currentWeather
            ? <WeatherCard weather={currentWeather} district={selectedDistrict} isCurrentLocation={Boolean(currentLocationCoordinates)} dialect={selectedDialect} />
            : <section className={`weather-card weather-loading ${GLASS_SURFACE}`}><LoaderCircle aria-hidden="true" className="loader-icon" size={24} strokeWidth={1.5} /><p>{t('checkingWeather')}</p></section>}
          <PriceCard
            records={currentMandiRecords}
            status={currentMandiDataStatus}
            selectedDistrict={selectedDistrict}
            dialect={selectedDialect}
            cropId={selectedCropId}
            nearbyQuotes={nearbyMandiQuotes}
            nearbyStatus={nearbySearchStatus}
          />
        </div>

        <MandiComparison cropId={selectedCropId} records={currentMandiRecords} dialect={selectedDialect} status={currentMandiDataStatus} />

        <div className="dashboard-footer">
          <BrandLogo size={28} subtitle={t('brandSubtitle')} />
          <p>{t('dashboardFooter')}</p>
        </div>
      </main>

      <JudgeDemoModal isOpen={showDemoModal} dialect={selectedDialect} onClose={() => setShowDemoModal(false)} onSelectDemo={(demo) => void handleSelectDemo(demo)} />

      {showLanguagePicker && (
        <div className="dialog-backdrop" onClick={() => setShowLanguagePicker(false)}>
          <section className={`language-dialog ${GLASS_SURFACE}`} role="dialog" aria-modal="true" aria-labelledby="language-title" onClick={(event) => event.stopPropagation()}>
            <div className="dialog-heading">
              <div><span className="card-kicker">{t('chooseLanguage')}</span><h2 id="language-title">{t('selectLanguage')}</h2></div>
              <m.button type="button" onClick={() => setShowLanguagePicker(false)} className={`dialog-close ${GLASS_SURFACE}`} aria-label={t('close')} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 520, damping: 26 }}><X aria-hidden="true" size={20} strokeWidth={1.5} /></m.button>
            </div>
            <p>{t('languageHelp')}</p>
            <div className="language-options">{dialects.map((dialect) => (
              <m.button type="button" key={dialect} className={`language-option ${GLASS_SURFACE} ${selectedDialect === dialect ? 'selected' : ''}`} onClick={() => { setSelectedDialect(dialect); setShowLanguagePicker(false) }} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 520, damping: 26 }}>
              <span>{dialectLabels[dialect]}</span>{selectedDialect === dialect ? <Check aria-label={t('selected')} size={18} strokeWidth={1.5} /> : <span className="language-option-choose">{t('choose')}</span>}
              </m.button>
            ))}</div>
          </section>
        </div>
      )}

      {advisoryResult && <DecisionSheet result={advisoryResult} autoSpeak={advisoryAutoSpeak} onClose={() => setAdvisoryResult(null)} />}
    </div>
  )
}

export default App
