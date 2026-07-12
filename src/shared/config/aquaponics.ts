// AquaTwin domain config: the single source of truth for sensor and device
// types, their units, display precision, and default alert thresholds.
// Display names live in i18n under sensors.* and devices.*.

export const SENSOR_TYPE_LIST = [
  'ph',
  'water_temp',
  'dissolved_oxygen',
  'ammonia',
  'nitrite',
  'nitrate',
] as const

export type SensorType = (typeof SENSOR_TYPE_LIST)[number]

export const DEVICE_TYPE_LIST = [
  'main_pump',
  'backup_pump',
  'aerator',
  'feeder',
  'grow_light',
  'heater',
] as const

export type DeviceType = (typeof DEVICE_TYPE_LIST)[number]

// Any bound may be null when a metric has no meaningful limit on that side.
export type Thresholds = {
  warnLow: number | null
  warnHigh: number | null
  critLow: number | null
  critHigh: number | null
}

export type SensorConfig = {
  unit: string
  decimals: number
  thresholds: Thresholds
}

export type SensorDirection = 'high' | 'low'

// Sensor + direction combinations that have specific aquaponics advice. Anything
// else falls back to a generic recommendation.
const RECOMMENDATION_CASES = new Set<string>([
  'ammonia_high',
  'dissolved_oxygen_low',
  'ph_low',
  'ph_high',
  'water_temp_low',
  'water_temp_high',
  'nitrite_high',
  'nitrate_high',
])

export function recommendationKey(type: SensorType, direction: SensorDirection): string {
  const key = `${type}_${direction}`
  return RECOMMENDATION_CASES.has(key)
    ? `alerts.recommendations.${key}`
    : 'alerts.recommendations.generic'
}

export const SENSOR_TYPES: Record<SensorType, SensorConfig> = {
  ph: {
    unit: 'pH',
    decimals: 2,
    thresholds: { warnLow: 6.4, warnHigh: 7.6, critLow: 6.0, critHigh: 8.0 },
  },
  water_temp: {
    unit: '°C',
    decimals: 1,
    thresholds: { warnLow: 22, warnHigh: 28, critLow: 18, critHigh: 32 },
  },
  dissolved_oxygen: {
    unit: 'mg/L',
    decimals: 1,
    thresholds: { warnLow: 6, warnHigh: null, critLow: 4, critHigh: null },
  },
  ammonia: {
    unit: 'mg/L',
    decimals: 2,
    thresholds: { warnLow: null, warnHigh: 0.5, critLow: null, critHigh: 1.0 },
  },
  nitrite: {
    unit: 'mg/L',
    decimals: 2,
    thresholds: { warnLow: null, warnHigh: 0.5, critLow: null, critHigh: 1.0 },
  },
  nitrate: {
    unit: 'mg/L',
    decimals: 0,
    thresholds: { warnLow: null, warnHigh: 150, critLow: null, critHigh: 300 },
  },
}
