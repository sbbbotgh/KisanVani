import { BrandLogo } from './BrandLogo'
import { translate } from '../lib/localization'
import type { SupportedDialect } from '../types'
import { m } from 'framer-motion'
import { AudioLines, Languages, Moon, Monitor, Signal, Sparkles, Sun } from 'lucide-react'
import { GLASS_SURFACE } from './ui'

type ThemePreference = 'system' | 'light' | 'dark'

interface HeaderProps {
  is2GLiteMode: boolean
  setIs2GLiteMode: (value: boolean) => void
  selectedDialect: SupportedDialect
  onOpenLanguagePicker: () => void
  onOpenDemoModal: () => void
  recordedPayloadKb: number
  onExitApp: () => void
  themePreference: ThemePreference
  onCycleTheme: () => void
}

export function Header({
  is2GLiteMode,
  setIs2GLiteMode,
  selectedDialect,
  onOpenLanguagePicker,
  onOpenDemoModal,
  recordedPayloadKb,
  onExitApp,
  themePreference,
  onCycleTheme,
}: HeaderProps) {
  const themeKey = themePreference === 'system' ? 'themeSystem' : themePreference === 'light' ? 'themeLight' : 'themeDark'
  const themeLabel = translate(selectedDialect, themeKey)
  return (
    <header className={`app-header ${GLASS_SURFACE}`}>
      <div className="app-header-inner">
        <m.button type="button" className="brand-home" onClick={onExitApp} aria-label={translate(selectedDialect, 'backHome')} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 520, damping: 26 }}>
          <BrandLogo size={38} subtitle={translate(selectedDialect, 'brandSubtitle')} />
        </m.button>
        <div className="header-controls">
          <m.button type="button" className={`demo-launch ${GLASS_SURFACE}`} onClick={onOpenDemoModal} aria-label={translate(selectedDialect, 'demoQueries')} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 520, damping: 26 }}>
            <Sparkles aria-hidden="true" size={18} strokeWidth={1.5} /><span className="optional-label">{translate(selectedDialect, 'demoQueries')}</span>
          </m.button>
          <m.button
            type="button"
            className={`lite-toggle ${GLASS_SURFACE} ${is2GLiteMode ? 'enabled' : ''}`}
            onClick={() => setIs2GLiteMode(!is2GLiteMode)}
            aria-pressed={is2GLiteMode}
            title={translate(selectedDialect, 'lowBandwidth')}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
          >
            <Signal className="wifi-mark" aria-hidden="true" size={18} strokeWidth={1.5} />
            <span>2G Lite</span>
            <i />
          </m.button>
          <m.button
            type="button"
            className={`theme-toggle ${GLASS_SURFACE}`}
            onClick={onCycleTheme}
            aria-label={`${translate(selectedDialect, 'appearance')}: ${themeLabel}`}
            title={`${translate(selectedDialect, 'appearance')}: ${themeLabel}`}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
          >
            {themePreference === 'system'
              ? <Monitor aria-hidden="true" size={18} strokeWidth={1.5} />
              : themePreference === 'light'
                ? <Sun aria-hidden="true" size={18} strokeWidth={1.5} />
                : <Moon aria-hidden="true" size={18} strokeWidth={1.5} />}
            <span>{themeLabel}</span>
          </m.button>
          <m.button type="button" className={`language-chip ${GLASS_SURFACE}`} onClick={onOpenLanguagePicker} aria-label={translate(selectedDialect, 'chooseLanguage')} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 520, damping: 26 }}>
            <Languages aria-hidden="true" size={18} strokeWidth={1.5} /><span className="dialect-label">{selectedDialect}</span>
          </m.button>
        </div>
      </div>
      {is2GLiteMode && (
        <div className={`bandwidth-strip ${GLASS_SURFACE}`}>
          <span><AudioLines aria-hidden="true" size={16} strokeWidth={1.5} /> Opus · 16 kbps mono <span className="strip-separator">·</span> {translate(selectedDialect, 'maxEight')}</span>
          <strong>{recordedPayloadKb > 0 ? `${recordedPayloadKb} ${translate(selectedDialect, 'lastRecording')}` : '< 16 KB target'}</strong>
        </div>
      )}
    </header>
  )
}
