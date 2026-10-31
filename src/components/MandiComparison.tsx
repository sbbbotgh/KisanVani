import { useMemo, useState } from 'react'
import { cropMatchesCommodity, getDemoMspReference, getLocalizedPlaceName } from '../data/cropsAndMandis'
import { translate } from '../lib/localization'
import type { CropKey, LiveMandiRecord, SupportedDialect } from '../types'
import { Calculator, ShieldCheck } from 'lucide-react'
import { GLASS_SURFACE } from './ui'

interface MandiComparisonProps {
  cropId: CropKey
  records: LiveMandiRecord[]
  dialect: SupportedDialect
  status: 'loading' | 'ready' | 'unavailable' | 'unconfigured'
}

function arrivalDateValue(value: string): number {
  const [day, month, year] = value.split('/').map(Number)
  if (day && month && year) return Date.UTC(year, month - 1, day)
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function MandiComparison({ cropId, records, dialect, status }: MandiComparisonProps) {
  const t = (key: Parameters<typeof translate>[1]) => translate(dialect, key)
  const quotes = useMemo(() => {
    const latestByMarket = new Map<string, LiveMandiRecord>()
    for (const record of records.filter((item) => cropMatchesCommodity(cropId, item.commodity))) {
      const key = `${record.market.toLowerCase()}:${record.variety.toLowerCase()}`
      const previous = latestByMarket.get(key)
      if (!previous || arrivalDateValue(record.arrivalDate) > arrivalDateValue(previous.arrivalDate)) {
        latestByMarket.set(key, record)
      }
    }
    return [...latestByMarket.values()]
  }, [cropId, records])
  const msp = quotes.length ? getDemoMspReference(cropId, quotes[0].variety) : undefined
  const [quantityTons, setQuantityTons] = useState(100)
  const [laborRate, setLaborRate] = useState(0)
  const [laborHours, setLaborHours] = useState(0)
  const [costOverrides, setCostOverrides] = useState<Record<string, { freight: number; hours: number }>>({})

  const quantityQuintals = Math.max(0, quantityTons) * 10
  const laborTotal = Math.max(0, laborRate) * Math.max(0, laborHours)
  const comparisons = quotes.map((quote) => {
    const key = `${quote.market}:${quote.variety}`
    const freightPerQuintal = Math.max(0, costOverrides[key]?.freight ?? 0)
    const freightTotal = freightPerQuintal * quantityQuintals
    const grossEarnings = quote.modalPrice * quantityQuintals
    return {
      ...quote,
      freightPerQuintal,
      totalCosts: freightTotal + laborTotal,
      netEarnings: grossEarnings - freightTotal - laborTotal,
      travelHours: Math.max(0, costOverrides[key]?.hours ?? 0),
    }
  }).sort((left, right) => right.netEarnings - left.netEarnings)

  const bestNetEarnings = comparisons[0]?.netEarnings
  const belowMspMarkets = msp ? comparisons.filter((comparison) => comparison.modalPrice < msp.price) : []
  const formatMoney = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`

  return (
    <section className={`mandi-comparison ${GLASS_SURFACE}`} aria-labelledby="mandi-comparison-title">
      <div className="comparison-heading">
        <div>
          <span className="card-kicker"><Calculator aria-hidden="true" size={16} strokeWidth={1.5} />{t('liveMandiTitle')}</span>
          <h2 id="mandi-comparison-title">{t('compareMandis')}</h2>
          <p>{t('comparisonIntro')}</p>
        </div>
        <span className="comparison-demo-tag">{status === 'ready' ? t('sourceLive') : t('sourceUnavailable')}</span>
      </div>

      <div className="comparison-inputs">
        <label>
          <span>{t('quantityTons')}</span>
          <input type="number" min="0" step="0.1" value={quantityTons} onChange={(event) => setQuantityTons(Number(event.target.value))} />
        </label>
        <label>
          <span>{t('laborRate')}</span>
          <input type="number" min="0" step="1" value={laborRate} onChange={(event) => setLaborRate(Number(event.target.value))} />
        </label>
        <label>
          <span>{t('laborHours')}</span>
          <input type="number" min="0" step="0.5" value={laborHours} onChange={(event) => setLaborHours(Number(event.target.value))} />
        </label>
      </div>

      {belowMspMarkets.length > 0 && msp && (
        <div className="msp-alert" role="status">
          <strong><ShieldCheck aria-hidden="true" size={17} strokeWidth={1.5} />{t('belowMspReminder')}</strong>
          <span>{t('belowMspMessage').replace('{price}', formatMoney(msp.price))} · {msp.marketingYear} · {msp.grade}</span>
        </div>
      )}

      {status === 'loading' && <p className="comparison-no-quotes">{t('loadingMandiDetails')}</p>}
      {status === 'unconfigured' && <p className="comparison-no-quotes">{t('mandiNotConfigured')}</p>}
      {status === 'unavailable' && <p className="comparison-no-quotes">{t('mandiUnavailable')}</p>}
      {status === 'ready' && comparisons.length > 0 ? (
        <div className="comparison-table-scroll" role="region" aria-label={t('compareMandis')} tabIndex={0}>
          <table className="comparison-table">
            <thead>
              <tr>
                <th scope="col">{t('market')}</th>
                <th scope="col">{t('pricePerQuintal')}</th>
                <th scope="col">{t('freightPer100Kg')}</th>
                <th scope="col">{t('travelTime')}</th>
                <th scope="col">{t('totalCosts')}</th>
                <th scope="col">{t('netEarnings')}</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((comparison) => {
                const key = `${comparison.market}:${comparison.variety}`
                return (
                  <tr key={key} className={comparison.netEarnings === bestNetEarnings ? 'best-net-row' : undefined}>
                    <th scope="row">
                      {getLocalizedPlaceName(comparison.market, dialect)}
                      <small>{getLocalizedPlaceName(comparison.district, dialect)} · {comparison.arrivalDate || t('dateUnavailable')}</small>
                      {comparison.netEarnings === bestNetEarnings && <small>{t('bestNet')}</small>}
                      {msp && comparison.modalPrice < msp.price && <small className="msp-row-warning">{t('belowMspShort')}</small>}
                    </th>
                    <td>{formatMoney(comparison.modalPrice)}</td>
                    <td>
                      <label className="freight-input">
                        <span className="visually-hidden">{t('freightFor')} {getLocalizedPlaceName(comparison.market, dialect)}</span>
                        <span>₹</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={costOverrides[key]?.freight ?? 0}
                          onChange={(event) => setCostOverrides((current) => ({
                            ...current,
                            [key]: { freight: Number(event.target.value), hours: current[key]?.hours ?? 0 },
                          }))}
                        />
                      </label>
                    </td>
                    <td>
                      <label className="freight-input time-input">
                        <span className="visually-hidden">{t('travelTimeFor')} {getLocalizedPlaceName(comparison.market, dialect)}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={costOverrides[key]?.hours ?? 0}
                          onChange={(event) => setCostOverrides((current) => ({
                            ...current,
                            [key]: { freight: current[key]?.freight ?? 0, hours: Number(event.target.value) },
                          }))}
                        />
                        <span>{t('hours')}</span>
                      </label>
                    </td>
                    <td>{formatMoney(comparison.totalCosts)}</td>
                    <td className="net-earnings">{formatMoney(comparison.netEarnings)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : status === 'ready' ? (
        <p className="comparison-no-quotes">{t('noComparisonQuotes')}</p>
      ) : null}
      {status === 'ready' && (
        <p className="comparison-disclaimer">
          {t('comparisonDisclaimer')}
          {msp
            ? ` ${t('mspDemoDisclaimer').replace('{price}', formatMoney(msp.price)).replace('{year}', msp.marketingYear)}`
            : ` ${t('noMspReference')}`}
        </p>
      )}
    </section>
  )
}
