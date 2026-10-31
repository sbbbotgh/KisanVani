import type { MicroclimateForecast } from '../types'
import { translate } from '../lib/localization'
import type { SupportedDialect } from '../types'
import { getLocalizedPlaceName } from '../data/cropsAndMandis'
import { CloudRain, Droplets, Thermometer, Wind } from 'lucide-react'
import { GLASS_SURFACE } from './ui'

export function WeatherCard({
  weather,
  district,
  isCurrentLocation = false,
  dialect,
}: {
  weather: MicroclimateForecast
  district: string
  isCurrentLocation?: boolean
  dialect: SupportedDialect
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(dialect, key)
  const riskLabel = weather.rainRiskLevel === 'HIGH'
    ? t('highRain')
    : weather.rainRiskLevel === 'MODERATE'
      ? t('moderateRain')
      : t('lowRain')

  return (
    <section className={`weather-card ${GLASS_SURFACE}`}>
      <div className="weather-card-heading">
        <div>
          <span className="card-kicker">{t('districtWeather')}</span>
          <h2>{isCurrentLocation ? t('currentLocationWeather') : `${getLocalizedPlaceName(district, dialect)} · ${t('area')}`}</h2>
        </div>
        <span className="rain-risk">
        <CloudRain aria-hidden="true" size={17} strokeWidth={1.5} /> {weather.threeDayMaxRainProb}% {t('rainRisk')}
        </span>
      </div>
      <div className="weather-metrics">
        <div><span><Thermometer aria-hidden="true" size={16} strokeWidth={1.5} />{t('temperature')}</span><strong>{weather.currentTemp}°<small>C</small></strong></div>
        <div><span><Droplets aria-hidden="true" size={16} strokeWidth={1.5} />{t('humidity')}</span><strong>{weather.currentHumidity}<small>%</small></strong></div>
        <div><span><Wind aria-hidden="true" size={16} strokeWidth={1.5} />{t('wind')}</span><strong>{weather.windSpeed}<small> km/h</small></strong></div>
      </div>
      <p className="weather-disclaimer">{riskLabel}. {t('cachedForecast')}</p>
    </section>
  )
}
