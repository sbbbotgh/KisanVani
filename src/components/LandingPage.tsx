import { BrandLogo } from './BrandLogo'
import { translate } from '../lib/localization'
import type { SupportedDialect } from '../types'
import { m } from 'framer-motion'
import { ArrowRight, CloudRain, Mic, MessageCircle, Signal, ShieldCheck } from 'lucide-react'
import { GLASS_SURFACE, PAGE_PALETTE } from './ui'

const dialects: SupportedDialect[] = ['English', 'Hinglish', 'Punjlish', 'Tanglish', 'Hindi', 'Punjabi', 'Tamil', 'Marathi']
const dialectLabels: Record<SupportedDialect, string> = {
  English: 'English',
  Hinglish: 'Hinglish · हिन्दी',
  Punjlish: 'Punjlish · ਪੰਜਾਬੀ',
  Tanglish: 'Tanglish · தமிழ்',
  Hindi: 'हिन्दी',
  Punjabi: 'ਪੰਜਾਬੀ',
  Tamil: 'தமிழ்',
  Marathi: 'मराठी',
}

export function LandingPage({
  onLaunchApp,
  dialect,
  onSelectDialect,
}: {
  onLaunchApp: () => void
  dialect: SupportedDialect
  onSelectDialect: (dialect: SupportedDialect) => void
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(dialect, key)

  return (
    <div className={`landing-page paper-texture ${PAGE_PALETTE}`}>
      <header className="landing-header">
        <BrandLogo subtitle={t('brandSubtitle')} />
        <div className="landing-header-actions">
          <label className="landing-language-picker">
            <span className="sr-only">{t('chooseLanguage')}</span>
            <select value={dialect} onChange={(event) => onSelectDialect(event.target.value as SupportedDialect)} aria-label={t('chooseLanguage')}>
              {dialects.map((option) => <option key={option} value={option}>{dialectLabels[option]}</option>)}
            </select>
          </label>
          <m.button type="button" className={`landing-open-button ${GLASS_SURFACE}`} onClick={onLaunchApp} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 520, damping: 26 }}>
            {t('openApp')} <ArrowRight aria-hidden="true" size={18} strokeWidth={1.5} />
          </m.button>
        </div>
      </header>

      <main className="landing-main">
        <div className={`sdg-note ${GLASS_SURFACE}`}><ShieldCheck aria-hidden="true" size={18} strokeWidth={1.5} /> {t('sdg')}</div>
        <p className="landing-kicker">{t('landingKicker')}</p>
        <h1>{t('landingTitle')}</h1>
        <p className="landing-lede">{t('landingDescription')}</p>
        <div className="landing-actions">
          <m.button type="button" className="landing-cta" onClick={onLaunchApp} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 520, damping: 26 }}>
            <Mic aria-hidden="true" size={22} strokeWidth={1.5} />
            {t('launchVoice')}
          </m.button>
          <p>{t('noAccount')}</p>
        </div>

        <section className="workflow-grid" aria-label={t('workflowLabel')}>
          <article className={`workflow-card ${GLASS_SURFACE}`}>
            <span className="workflow-number">01</span><span className="workflow-icon"><MessageCircle aria-hidden="true" size={22} strokeWidth={1.5} /></span>
            <h2>{t('workflowVoice')}</h2>
            <p>{t('workflowVoiceText')}</p>
          </article>
          <article className={`workflow-card ${GLASS_SURFACE}`}>
            <span className="workflow-number">02</span><span className="workflow-icon"><CloudRain aria-hidden="true" size={22} strokeWidth={1.5} /></span>
            <h2>{t('workflowMarket')}</h2>
            <p>{t('workflowMarketText')}</p>
          </article>
          <article className={`workflow-card ${GLASS_SURFACE}`}>
            <span className="workflow-number">03</span><span className="workflow-icon"><ArrowRight aria-hidden="true" size={22} strokeWidth={1.5} /></span>
            <h2>{t('workflowNext')}</h2>
            <p>{t('workflowNextText')}</p>
          </article>
        </section>

        <section className={`lite-proof ${GLASS_SURFACE}`}>
          <div className="lite-proof-copy">
            <span className="landing-kicker">{t('lowData')}</span>
            <h2>{t('lowDataTitle')}</h2>
            <p>{t('lowDataText')}</p>
          </div>
          <div className="lite-proof-stat"><strong>16<span>kbps</span></strong><small><Signal aria-hidden="true" size={15} strokeWidth={1.5} />{t('monoVoice')}</small><i>{t('maxEight')}</i></div>
        </section>
      </main>

      <footer className="landing-footer">
        <BrandLogo size={30} subtitle={t('brandSubtitle')} />
        <span>KisanVani · {t('landingFooter')}</span>
        <span>{t('verifyPrices')}</span>
      </footer>
    </div>
  )
}
