import { JUDGE_DEMOS } from '../data/judgeDemos'
import type { JudgeDemo } from '../types'
import { translate } from '../lib/localization'
import type { SupportedDialect } from '../types'
import { m } from 'framer-motion'
import { ArrowRight, ShieldCheck, X } from 'lucide-react'
import { GLASS_SURFACE } from './ui'

interface JudgeDemoModalProps {
  isOpen: boolean
  dialect: SupportedDialect
  onClose: () => void
  onSelectDemo: (demo: JudgeDemo) => void
}

export function JudgeDemoModal({ isOpen, dialect, onClose, onSelectDemo }: JudgeDemoModalProps) {
  if (!isOpen) return null
  const t = (key: Parameters<typeof translate>[1]) => translate(dialect, key)
  const decisionLabel = (decision: JudgeDemo['expectedDecision']) => decision === 'SELL TODAY'
    ? t('sellToday')
    : decision === 'HOLD FOR 2 DAYS'
      ? t('holdTwoDays')
      : decision === 'TRANSPORT TO NEARBY MANDI'
        ? t('transport')
        : t('checkLocal')

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <section
        className={`demo-dialog ${GLASS_SURFACE}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <div><span className="card-kicker">{t('tryScenario')}</span><h2 id="demo-title">{t('demoTitle')}</h2></div>
          <m.button type="button" onClick={onClose} className={`dialog-close ${GLASS_SURFACE}`} aria-label={t('close')} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 520, damping: 26 }}><X aria-hidden="true" size={20} strokeWidth={1.5} /></m.button>
        </div>
        <p className="dialog-intro">{t('demoHelp')}</p>
        <div className="demo-options">
          {JUDGE_DEMOS.map((demo) => (
            <m.button type="button" className={`demo-option ${GLASS_SURFACE}`} key={demo.id} onClick={() => onSelectDemo(demo)} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 520, damping: 26 }}>
              <span className="demo-option-top"><strong>{demo.label}</strong><i>{decisionLabel(demo.expectedDecision)}</i></span>
              <span className="demo-transcript">“{demo.displayTranscript}”</span>
              <span className="demo-run">{t('runDemo')} <ArrowRight aria-hidden="true" size={16} strokeWidth={1.5} /></span>
            </m.button>
          ))}
        </div>
        <div className="demo-privacy"><ShieldCheck aria-hidden="true" size={16} strokeWidth={1.5} /> {t('demoPrivacy')}</div>
      </section>
    </div>
  )
}
