import { translate } from '../lib/localization'
import type { SupportedDialect } from '../types'
import { m } from 'framer-motion'
import { Mic } from 'lucide-react'

interface VoiceOrbProps {
  isRecording: boolean
  isLoading: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  is2GLiteMode: boolean
  dialect: SupportedDialect
}

export function VoiceOrb({
  isRecording,
  isLoading,
  onStartRecording,
  onStopRecording,
  is2GLiteMode,
  dialect,
}: VoiceOrbProps) {
  const t = (key: Parameters<typeof translate>[1]) => translate(dialect, key)
  const label = isLoading
    ? t('preparing')
    : isRecording
      ? t('listening')
      : t('askByVoice')

  return (
    <div className={`voice-widget ${isRecording ? 'recording' : ''}`}>
      <div className="voice-orb-wrap">
        {isRecording && <span className="voice-wave voice-wave-one" />}
        {isRecording && <span className="voice-wave voice-wave-two" />}
        <m.button
          type="button"
          className={`voice-orb ${isRecording ? 'listening' : ''} ${isLoading ? 'loading' : ''}`}
          onClick={isRecording ? onStopRecording : onStartRecording}
          disabled={isLoading}
          aria-label={isRecording ? t('finishAndGetAdvice') : t('askByVoice')}
          whileTap={{ scale: 0.95 }}
          animate={isRecording ? { scale: [1, 1.035, 1] } : { scale: 1 }}
          transition={isRecording
            ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
            : { type: 'spring', stiffness: 520, damping: 26 }}
        >
          <Mic className="voice-mic-icon" aria-hidden="true" size={30} strokeWidth={1.5} />
          {isLoading && <span className="loader-ring voice-loading-ring" aria-hidden="true" />}
        </m.button>
      </div>
      <div className="voice-copy">
        <strong>{label}</strong>
        <span>{isRecording ? t('finishAndGetAdvice') : is2GLiteMode ? t('voiceHelpLite') : t('voiceHelp')}</span>
        <span className="voice-privacy">{t('voicePrivacy')}</span>
      </div>
    </div>
  )
}
