import type { SensorType } from '@/shared/config/aquaponics'

export type SimReading = {
  sensor_id: string
  value: number
  recorded_at: string
}

type SensorModel = {
  setpoint: number
  // mean reversion strength and noise for the calm regime
  k: number
  sigma: number
  // physical clamps
  min: number
  max: number
  // steady per tick drift while an anomaly is active (signed)
  anomalyDrift: number
}

// Tuned so calm values drift gently and an anomaly crosses warning in roughly
// one to two minutes at the 3 second tick, then keeps heading toward critical.
export const SENSOR_MODELS: Record<SensorType, SensorModel> = {
  ph: { setpoint: 7.0, k: 0.1, sigma: 0.02, min: 5.5, max: 8.5, anomalyDrift: 0.014 },
  water_temp: { setpoint: 24.5, k: 0.1, sigma: 0.08, min: 10, max: 40, anomalyDrift: 0.07 },
  dissolved_oxygen: { setpoint: 7.5, k: 0.1, sigma: 0.06, min: 0, max: 14, anomalyDrift: -0.05 },
  ammonia: { setpoint: 0.2, k: 0.12, sigma: 0.008, min: 0, max: 4, anomalyDrift: 0.012 },
  nitrite: { setpoint: 0.15, k: 0.12, sigma: 0.008, min: 0, max: 4, anomalyDrift: 0.012 },
  nitrate: { setpoint: 80, k: 0.1, sigma: 1.5, min: 0, max: 500, anomalyDrift: 2.5 },
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function gaussian(sigma: number): number {
  const u1 = Math.random() || 1e-9
  const u2 = Math.random()
  return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

// One step of the model. Calm mode mean reverts to the setpoint; anomaly mode
// applies a steady directional drift so the value walks past the thresholds.
// loadFactor scales the fish load: a heavier stock raises the ammonia setpoint
// (more waste) and lowers the dissolved oxygen setpoint (more respiration).
export function nextValue(
  type: SensorType,
  current: number,
  anomaly: boolean,
  loadFactor = 1,
): number {
  const model = SENSOR_MODELS[type]
  let setpoint = model.setpoint
  if (type === 'ammonia') setpoint = model.setpoint * loadFactor
  else if (type === 'dissolved_oxygen') setpoint = model.setpoint - (loadFactor - 1) * 1.2
  const next = anomaly
    ? current + model.anomalyDrift + gaussian(model.sigma * 0.4)
    : current + model.k * (setpoint - current) + gaussian(model.sigma)
  return round(clamp(next, model.min, model.max))
}

export function setpointFor(type: SensorType): number {
  return SENSOR_MODELS[type].setpoint
}

// Iterates the calm model forward from `hours` ago to `now`, producing rows
// ready for insertReadings. `now` is passed in so the function stays testable.
export function generateHistory(
  sensors: { id: string; type: SensorType }[],
  now: number,
  hours = 24,
  stepMinutes = 5,
  loadFactor = 1,
): SimReading[] {
  const stepMs = stepMinutes * 60_000
  const start = now - hours * 60 * 60_000
  const state = new Map<string, number>()
  for (const sensor of sensors) state.set(sensor.id, SENSOR_MODELS[sensor.type].setpoint)

  const rows: SimReading[] = []
  for (let ts = start; ts <= now; ts += stepMs) {
    const recorded_at = new Date(ts).toISOString()
    for (const sensor of sensors) {
      const current = state.get(sensor.id) ?? SENSOR_MODELS[sensor.type].setpoint
      const value = nextValue(sensor.type, current, false, loadFactor)
      state.set(sensor.id, value)
      rows.push({ sensor_id: sensor.id, value, recorded_at })
    }
  }
  return rows
}
