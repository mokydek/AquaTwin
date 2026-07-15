/*
 * Aquaponics farm model. This is an EDUCATIONAL APPROXIMATION, not a validated
 * scientific model. It encodes plausible first order couplings between the six
 * water parameters and is stepped with simple Euler integration. Constants are
 * tuned so a baseline run stays stable near the setpoints; they are illustrative.
 * The model is deterministic: no Math.random.
 */

export type WaterState = {
  ph: number
  water_temp: number
  dissolved_oxygen: number
  ammonia: number
  nitrite: number
  nitrate: number
}

export type ModelParams = {
  fishLoad: number
  feedRate: number
  plantMass: number
  aerationLevel: number
  filtrationLevel: number
  waterTempSetpoint: number
}

export type SeriesPoint = { day: number } & WaterState

export function defaultParams(): ModelParams {
  return {
    fishLoad: 1,
    feedRate: 1,
    plantMass: 1,
    aerationLevel: 0.7,
    filtrationLevel: 0.8,
    waterTempSetpoint: 24.5,
  }
}

export function baselineState(): WaterState {
  return { ph: 7.0, water_temp: 24.5, dissolved_oxygen: 7.5, ammonia: 0.2, nitrite: 0.15, nitrate: 80 }
}

// Tuned rate constants (per hour where relevant). The nitrogen cycle rates are
// slow so the projection evolves over days, and the biofilter has enough
// headroom that a moderate overload settles at a high value instead of diverging.
const AMMONIA_PRODUCTION = 0.012
const NITRIF_VMAX = 0.056
const AMMONIA_HALF = 0.5
const NITRITE_RATE = 0.107
const OXYGEN_HALF = 0.5
const PLANT_UPTAKE = 0.018
const NITRATE_HALF = 40
const REAERATION = 0.75
const BASE_AERATION = 0.2
const RESP_FISH = 0.63
const RESP_NITRIF = 1.0
const DO_SAT_BASE = 14.6
const DO_SAT_SLOPE = 0.25
const PH_BUFFER = 0.05
const PH_ACID = 0.015
const PH_STRESS = 0.03
const TEMP_RELAX = 0.15

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// Nitrification efficiency vs temperature: full between 20 and 30 C, ramping to
// zero at 10 C and 35 C where the bacterial colony collapses.
function temperatureFactor(temp: number): number {
  if (temp <= 10 || temp >= 35) return 0
  if (temp < 20) return (temp - 10) / 10
  if (temp > 30) return (35 - temp) / 5
  return 1
}

function oxygenSaturation(temp: number): number {
  return DO_SAT_BASE - DO_SAT_SLOPE * temp
}

// volumeFactor > 1 means a larger system with more thermal and chemical inertia,
// so every per step change is divided by it and the whole system drifts slower.
export function step(
  state: WaterState,
  params: ModelParams,
  dtHours: number,
  volumeFactor = 1,
): WaterState {
  const inertia = volumeFactor <= 0 ? 1 : volumeFactor
  const temp = state.water_temp
  const tempFactor = temperatureFactor(temp)
  const oxygenFactor = state.dissolved_oxygen / (state.dissolved_oxygen + OXYGEN_HALF)
  const efficiency = params.filtrationLevel * tempFactor * oxygenFactor

  // Ammonia: produced by feeding and fish, oxidized by the biofilter (saturating).
  const ammoniaProduction = AMMONIA_PRODUCTION * params.feedRate * params.fishLoad
  const ammoniaOxidation =
    NITRIF_VMAX * efficiency * (state.ammonia / (state.ammonia + AMMONIA_HALF))
  const dAmmonia = ammoniaProduction - ammoniaOxidation

  // Nitrite: produced by ammonia oxidation, consumed by the second stage.
  const nitriteOxidation = NITRITE_RATE * efficiency * state.nitrite
  const dNitrite = ammoniaOxidation - nitriteOxidation

  // Nitrate: produced by nitrite oxidation, taken up by the plants (saturating).
  const plantUptake =
    PLANT_UPTAKE * params.plantMass * (state.nitrate / (state.nitrate + NITRATE_HALF))
  const dNitrate = nitriteOxidation - plantUptake

  // Dissolved oxygen: reaeration toward a temperature dependent saturation, drawn
  // down by fish respiration and the oxygen demand of nitrification.
  const saturation = oxygenSaturation(temp)
  const reaeration = REAERATION * (BASE_AERATION + params.aerationLevel) * (saturation - state.dissolved_oxygen)
  const oxygenDemand = RESP_FISH * params.fishLoad + RESP_NITRIF * (ammoniaOxidation + nitriteOxidation)
  const dOxygen = reaeration - oxygenDemand

  // pH: drifts down with nitrification acidity, buffered toward neutral, with an
  // extra downward swing when ammonia builds up (biological stress).
  const acid = PH_ACID * (ammoniaOxidation + nitriteOxidation)
  const stress = PH_STRESS * Math.max(0, state.ammonia - 0.3)
  const dPh = PH_BUFFER * (7.0 - state.ph) - acid - stress

  // Temperature relaxes toward the setpoint with inertia.
  const dTemp = TEMP_RELAX * (params.waterTempSetpoint - temp)

  const dt = dtHours / inertia
  return {
    ph: clamp(state.ph + dPh * dt, 0, 14),
    water_temp: clamp(temp + dTemp * dt, 0, 45),
    dissolved_oxygen: clamp(state.dissolved_oxygen + dOxygen * dt, 0, 20),
    ammonia: Math.max(0, state.ammonia + dAmmonia * dt),
    nitrite: Math.max(0, state.nitrite + dNitrite * dt),
    nitrate: Math.max(0, state.nitrate + dNitrate * dt),
  }
}

// Runs the model forward and returns a downsampled series (about 120 points).
export function simulate(
  initial: WaterState,
  params: ModelParams,
  days: number,
  stepHours = 1,
  volumeFactor = 1,
): SeriesPoint[] {
  const totalSteps = Math.max(1, Math.round((days * 24) / stepHours))
  const sampleEvery = Math.max(1, Math.floor(totalSteps / 120))

  let state: WaterState = { ...initial }
  const series: SeriesPoint[] = [{ day: 0, ...state }]
  for (let i = 1; i <= totalSteps; i += 1) {
    state = step(state, params, stepHours, volumeFactor)
    if (i % sampleEvery === 0 || i === totalSteps) {
      series.push({ day: (i * stepHours) / 24, ...state })
    }
  }
  return series
}
