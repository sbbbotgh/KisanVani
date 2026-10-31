import { cropMatchesCommodity, getLocalizedCropName, getLocalizedPlaceName } from '../data/cropsAndMandis'
import { translate } from '../lib/localization'
import type { CropKey, LiveMandiRecord, NearbyMandiQuote, SupportedDialect } from '../types'
import { CalendarDays, MapPin, TrendingUp } from 'lucide-react'
import { GLASS_SURFACE } from './ui'

interface PriceCardProps {
  records: LiveMandiRecord[]
  status: 'loading' | 'ready' | 'unavailable' | 'unconfigured'
  selectedDistrict: string
  dialect: SupportedDialect
  cropId: CropKey
  nearbyQuotes: NearbyMandiQuote[]
  nearbyStatus: 'idle' | 'loading' | 'ready' | 'unavailable'
}

const rupees = (value: number) => `₹${value.toLocaleString('en-IN')}`

function dateValue(value: string): number {
  const [day, month, year] = value.split('/').map(Number)
  if (day && month && year) return Date.UTC(year, month - 1, day)
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function PriceCard({ records, status, selectedDistrict, dialect, cropId, nearbyQuotes, nearbyStatus }: PriceCardProps) {
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => translate(dialect, key, values)
  const cropRecords = records
    .filter((record) => record.district.toLowerCase() === selectedDistrict.toLowerCase()
      && cropMatchesCommodity(cropId, record.commodity))
    .sort((left, right) => dateValue(right.arrivalDate) - dateValue(left.arrivalDate))
  const latest = cropRecords[0]

  return (
    <section className={`price-card ${GLASS_SURFACE}`}>
      <div className="price-card-heading">
        <div>
          <span className="card-kicker"><TrendingUp aria-hidden="true" size={16} strokeWidth={1.5} />{t('liveMandiTitle')}</span>
          <h2>{getLocalizedPlaceName(selectedDistrict, dialect)} <span>· {getLocalizedCropName(cropId, dialect)}</span></h2>
          <p><CalendarDays aria-hidden="true" size={14} strokeWidth={1.5} /> OGD / Agmarknet · {latest?.variety ?? t('latestAvailable')}</p>
        </div>
        <span className={`weather-source ${status === 'ready' ? 'source-live' : 'source-sample'}`}>
          {status === 'ready' ? t('sourceLive') : status === 'loading' ? t('loadingMandi') : t('sourceUnavailable')}
        </span>
      </div>

      {status === 'loading' && <p className="mandi-status-copy">{t('loadingMandiDetails')}</p>}
      {status === 'unconfigured' && <p className="mandi-status-copy" role="status">{t('mandiNotConfigured')}</p>}
      {status === 'unavailable' && <p className="mandi-status-copy" role="status">{t('mandiUnavailable')}</p>}
      {status === 'ready' && !latest && <p className="mandi-status-copy">{t('noCropQuotes')}</p>}
      {status === 'ready' && !latest && nearbyStatus === 'loading' && (
        <p className="mandi-status-copy" role="status">{t('searchingNearbyMandis')}</p>
      )}
      {status === 'ready' && !latest && nearbyStatus === 'unavailable' && (
        <p className="mandi-status-copy" role="status">{t('nearbyMandiLookupFailed')}</p>
      )}
      {status === 'ready' && !latest && nearbyStatus === 'ready' && nearbyQuotes.length === 0 && (
        <p className="mandi-status-copy">{t('noNearbyMandiQuotes')}</p>
      )}
      {status === 'ready' && !latest && nearbyStatus === 'ready' && nearbyQuotes.length > 0 && (
        <div className="nearby-live-quotes">
          <h3>{t('nearbyMandiTitle')}</h3>
          <p>{t('nearbyMandiSortedByPrice')}</p>
          <ol>
            {nearbyQuotes.map((quote) => (
              <li key={`${quote.market}:${quote.district}`}>
                <span>
                  <strong>{getLocalizedPlaceName(quote.market, dialect)}</strong>
                  <small>{getLocalizedPlaceName(quote.district, dialect)} · {t('nearbyApproxDistance', { distance: quote.distanceKm })} · {quote.arrivalDate || t('dateUnavailable')}</small>
                </span>
                <b>{rupees(quote.modalPrice)}<small> / {t('perQuintal')}</small></b>
              </li>
            ))}
          </ol>
        </div>
      )}
      {latest && status === 'ready' && (
        <>
          <p className="live-price-market"><MapPin aria-hidden="true" size={15} strokeWidth={1.5} />{getLocalizedPlaceName(latest.market, dialect)} · {latest.arrivalDate || t('dateUnavailable')}</p>
          <div className="modal-price">
            <strong>{rupees(latest.modalPrice)}</strong><span>{t('perQuintal')}</span>
          </div>
          <div className="price-range">
            <div><span>{t('min')}</span><strong>{rupees(latest.minPrice)}</strong></div>
            <div><span>{t('modal')}</span><strong>{rupees(latest.modalPrice)}</strong></div>
            <div><span>{t('max')}</span><strong>{rupees(latest.maxPrice)}</strong></div>
          </div>
          {cropRecords.length > 1 && <p className="live-market-count">{t('additionalMarketQuotes').replace('{count}', String(cropRecords.length - 1))}</p>}
        </>
      )}
      {status === 'ready' && latest && <p className="price-disclaimer">{t('livePriceDisclaimer')}</p>}
    </section>
  )
}
