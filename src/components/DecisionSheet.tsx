import { useCallback, useEffect, useRef, useState } from 'react'
import { playSpeechAudio, stopSpeaking, synthesizeAdvisoryAudio, VoiceApiError } from '../lib/speechSynth'
import { getUiLocale, translate } from '../lib/localization'
import { getLocalizedCropName, getLocalizedPlaceName } from '../data/cropsAndMandis'
import type { AdvisoryResult } from '../types'
import { m } from 'framer-motion'
import { ArrowUpRight, Check, Pause, Play, RotateCcw, X } from 'lucide-react'
import { GLASS_SURFACE } from './ui'

interface DecisionSheetProps {
  result: AdvisoryResult
  autoSpeak: boolean
  onClose: () => void
}

const badgeClass: Record<AdvisoryResult['decisionBadge'], string> = {
  'SELL TODAY': 'decision-sell',
  'HOLD FOR 2 DAYS': 'decision-hold',
  'TRANSPORT TO NEARBY MANDI': 'decision-transport',
  'CHECK PRICE TREND': 'decision-check',
  'CHECK LOCAL RATE': 'decision-check',
}

function getSpeechErrorKey(error: unknown): 'statusVoiceNotConfigured' | 'statusSpeechOutputFailed' {
  return error instanceof VoiceApiError && error.status === 503
    ? 'statusVoiceNotConfigured'
    : 'statusSpeechOutputFailed'
}

export function DecisionSheet({ result, autoSpeak, onClose }: DecisionSheetProps) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSpeechLoading, setIsSpeechLoading] = useState(true)
  const [speechStatus, setSpeechStatus] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioBlobRef = useRef<Blob | null>(null)
  const speechRequestRef = useRef(0)
  const t = (key: Parameters<typeof translate>[1]) => translate(result.detectedDialect, key)

  const startPlayback = useCallback(async (blob: Blob) => {
    const audio = await playSpeechAudio(blob)
    audioRef.current = audio
    audio.onended = () => {
      audioRef.current = null
      setIsSpeaking(false)
    }
    audio.onerror = () => {
      audioRef.current = null
      setIsSpeaking(false)
      setSpeechStatus(translate(result.detectedDialect, 'statusSpeechOutputFailed'))
    }
    setIsSpeaking(true)
    setSpeechStatus('')
  }, [result.detectedDialect])

  useEffect(() => {
    let active = true
    const requestId = ++speechRequestRef.current
    void synthesizeAdvisoryAudio(result.spokenAdvisoryResponse, result.detectedDialect).then((blob) => {
      if (!active || speechRequestRef.current !== requestId) return
      audioBlobRef.current = blob
      setIsSpeechLoading(false)
      setSpeechStatus('')
      if (autoSpeak) {
        void startPlayback(blob).catch((error: unknown) => {
          console.error('Automatic spoken advisory playback was blocked', error)
          if (active && speechRequestRef.current === requestId) {
            setIsSpeaking(false)
            setSpeechStatus(translate(result.detectedDialect, 'statusAutoPlayBlocked'))
          }
        })
      }
    }).catch((error: unknown) => {
      console.error('Spoken advisory audio could not be prepared', error)
      if (!active || speechRequestRef.current !== requestId) return
      setIsSpeechLoading(false)
      setSpeechStatus(translate(result.detectedDialect, getSpeechErrorKey(error)))
    })
    return () => {
      active = false
      speechRequestRef.current += 1
      stopSpeaking()
    }
  }, [autoSpeak, result.detectedDialect, result.spokenAdvisoryResponse, startPlayback])

  const playSpeech = useCallback(() => {
    const blob = audioBlobRef.current
    if (!blob) {
      setSpeechStatus(translate(result.detectedDialect, 'statusSpeechOutputFailed'))
      return
    }
    void startPlayback(blob).catch((error: unknown) => {
      console.error('Spoken advisory audio could not play', error)
      setIsSpeaking(false)
      setSpeechStatus(translate(result.detectedDialect, 'statusSpeechOutputFailed'))
    })
  }, [result.detectedDialect, startPlayback])

  const decisionLabel = result.decisionBadge === 'SELL TODAY'
    ? t('sellToday')
    : result.decisionBadge === 'HOLD FOR 2 DAYS'
      ? t('holdTwoDays')
      : result.decisionBadge === 'TRANSPORT TO NEARBY MANDI'
        ? t('transport')
        : result.decisionBadge === 'CHECK PRICE TREND'
          ? t('reviewPriceTrend')
          : t('checkLocal')

  const toggleSpeech = () => {
    if (isSpeaking) {
      audioRef.current?.pause()
      setIsSpeaking(false)
    } else if (audioRef.current?.paused && !audioRef.current.ended) {
      void audioRef.current.play().then(() => setIsSpeaking(true)).catch((error: unknown) => {
        console.error('Spoken advisory audio could not resume', error)
        setSpeechStatus(translate(result.detectedDialect, 'statusSpeechOutputFailed'))
      })
    } else {
      playSpeech()
    }
  }

  const closeSheet = () => {
    stopSpeaking()
    speechRequestRef.current += 1
    onClose()
  }

  return (
    <div className="sheet-backdrop" onClick={closeSheet}>
      <section
        className={`decision-sheet ${GLASS_SURFACE}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-topline">
          <div className="result-origin">
            <span className="card-kicker">{result.detectedDialect} · {t('advisory')}</span>
            <span className="simulated-tag">{result.answerSource === 'gemini' ? 'Gemini AI' : t('demoEngine')}</span>
          </div>
          <m.button type="button" className={`sheet-close ${GLASS_SURFACE}`} onClick={closeSheet} aria-label={t('close')} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 520, damping: 26 }}><X aria-hidden="true" size={20} strokeWidth={1.5} /></m.button>
        </div>

        <div className={`decision-banner ${badgeClass[result.decisionBadge]}`}>
          <span className="decision-label">{t('nextStep')}</span>
          <h2 id="decision-title">{decisionLabel}</h2>
          <p>{result.decisionReason || (result.decisionBadge === 'SELL TODAY'
            ? t('sellReason')
            : result.decisionBadge === 'HOLD FOR 2 DAYS'
              ? t('holdReason')
              : result.decisionBadge === 'TRANSPORT TO NEARBY MANDI'
                ? t('transportReason')
                : result.decisionBadge === 'CHECK PRICE TREND'
                  ? t('reviewTrendReason')
                : t('localRate'))}</p>
        </div>

        <div className="spoken-advice">
          <div className="spoken-heading">
            <span><i /> {t('speakAdvice')} <small>· {result.detectedDialect}</small></span>
            <div className="speech-controls">
              <m.button type="button" onClick={toggleSpeech} disabled={isSpeechLoading} aria-label={isSpeaking ? t('pauseAdvice') : t('playAdvice')} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 520, damping: 26 }}>{isSpeaking ? <Pause aria-hidden="true" size={18} strokeWidth={1.5} /> : <Play aria-hidden="true" size={18} strokeWidth={1.5} />}</m.button>
              <m.button type="button" onClick={playSpeech} disabled={isSpeechLoading} aria-label={t('replayAdvice')} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 520, damping: 26 }}><RotateCcw aria-hidden="true" size={18} strokeWidth={1.5} /></m.button>
            </div>
          </div>
          <p lang={getUiLocale(result.detectedDialect)}>
            “{result.spokenAdvisoryResponse}”
          </p>
          {isSpeechLoading && <small className="speech-status" role="status">{t('speechPreparing')}</small>}
          {speechStatus && <small className="speech-status" role="status">{speechStatus}</small>}
        </div>

        <div className="result-facts">
          <div className="result-fact">
            <span>{result.hasLocalMarketQuote ? t('mandiPrice') : t('referenceQuote')}</span>
            {result.hasLocalMarketQuote ? (
              <>
                <strong className="text-6xl font-black tracking-tighter">₹{result.currentModalPrice.toLocaleString('en-IN')}<small> / {t('perQuintal')}</small></strong>
                <p>{getLocalizedPlaceName(result.mandiDetected, result.detectedDialect)} · {getLocalizedCropName(result.cropId, result.detectedDialect)}</p>
                <small>Range ₹{result.minPrice.toLocaleString('en-IN')} – ₹{result.maxPrice.toLocaleString('en-IN')}</small>
              </>
            ) : (
              <>
                <strong>{t('noLivePrice')}</strong>
                <p>{getLocalizedCropName(result.cropId, result.detectedDialect)}</p>
                <small>{t('referenceOnly')}</small>
              </>
            )}
          </div>
          <div className="result-fact weather-fact">
            <span>{t('microclimate')} · {result.weatherSource === 'demo' ? 'DEMO' : result.weatherSource.toUpperCase()}</span>
            <strong>{result.microclimateAlert.startsWith('Heavy rain') ? t('rainAlert') : t('fieldOutlook')}</strong>
            <p>{result.microclimateAlert}</p>
          </div>
        </div>

        {result.bestNearbyMandi && result.bestNearbyMandi.extraProfitPerQuintal > 0 && (
          <div className="transport-option">
            <ArrowUpRight aria-hidden="true" size={20} strokeWidth={1.5} />
            <div><strong>{getLocalizedPlaceName(result.bestNearbyMandi.name, result.detectedDialect)} {t('marketSuffix')}</strong><small>{result.bestNearbyMandi.distanceKm} km · {t('transportEstimate')}</small></div>
            <b>+₹{result.bestNearbyMandi.extraProfitPerQuintal}<small> / {t('perQuintal')}</small></b>
          </div>
        )}
        <p className="result-caveat">{t('decisionCaveat')}</p>
        <m.button type="button" className="sheet-done" onClick={closeSheet} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 520, damping: 26 }}>{t('gotIt')} <Check aria-hidden="true" size={18} strokeWidth={1.5} /></m.button>
      </section>
    </div>
  )
}
