import type { TFunction } from 'i18next'

import type { Alert } from '@/backend'
import type { SensorDirection } from '@/shared/config/aquaponics'
import { SENSOR_TYPES } from '@/shared/config/aquaponics'
import { formatEtaMinutes } from '@/shared/lib/trend'

export function etaText(minutes: number, t: TFunction): string {
  const { hours, minutes: mins } = formatEtaMinutes(minutes)
  return hours > 0
    ? t('alerts.etaHoursMinutes', { hours, minutes: mins })
    : t('alerts.etaMinutes', { minutes: mins })
}

// Which side of the range a value sits on. Sensors with only one bounded side
// resolve deterministically; two sided sensors compare against the warn midpoint.
export function alertDirection(alert: Alert): SensorDirection {
  const { thresholds } = SENSOR_TYPES[alert.sensor_type]
  const hasHigh = thresholds.warnHigh !== null || thresholds.critHigh !== null
  const hasLow = thresholds.warnLow !== null || thresholds.critLow !== null
  if (hasHigh && !hasLow) return 'high'
  if (hasLow && !hasHigh) return 'low'
  const low = thresholds.warnLow ?? thresholds.critLow ?? 0
  const high = thresholds.warnHigh ?? thresholds.critHigh ?? 0
  const midpoint = (low + high) / 2
  return (alert.value ?? midpoint) >= midpoint ? 'high' : 'low'
}

export function alertToastText(alert: Alert, t: TFunction): string {
  const sensor = t(`sensors.${alert.sensor_type}`)
  if (alert.kind === 'prediction') {
    const eta = alert.eta_minutes !== null ? etaText(alert.eta_minutes, t) : ''
    return t('alerts.toast.prediction', { sensor, eta })
  }
  const config = SENSOR_TYPES[alert.sensor_type]
  const value = alert.value !== null ? alert.value.toFixed(config.decimals) : ''
  return t('alerts.toast.threshold', {
    sensor,
    status: t(`app.status.${alert.severity}`),
    value,
    unit: config.unit,
  })
}
