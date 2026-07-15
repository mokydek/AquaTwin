import { SENSOR_TYPE_LIST } from '@/shared/config/aquaponics'
import type { SensorType, Thresholds } from '@/shared/config/aquaponics'
import { computeStatus } from '@/shared/lib/status'
import type { Status } from '@/shared/lib/status'
import { defaultParams, simulate } from '@/frontend/twin/model'
import type { ModelParams, SeriesPoint, WaterState } from '@/frontend/twin/model'

export type Scenario = {
  waterTempDelta: number
  fishLoad: number
  feedRate: number
  aerationLevel: number
  filtrationLevel: number
  plantMass: number
  horizonDays: 7 | 14 | 30
}

export function defaultScenario(): Scenario {
  return {
    waterTempDelta: 0,
    fishLoad: 1,
    feedRate: 1,
    aerationLevel: 0.7,
    filtrationLevel: 0.8,
    plantMass: 1,
    horizonDays: 14,
  }
}

export type Verdict = 'stable' | 'at_risk' | 'critical'

export type SensorAnalysis = {
  type: SensorType
  verdict: Verdict
  warningDay: number | null
  criticalDay: number | null
  extreme: number
}

export type ScenarioResult = {
  series: SeriesPoint[]
  analysis: SensorAnalysis[]
  overall: Verdict
}

function statusRank(status: Status): number {
  return status === 'critical' ? 2 : status === 'warning' ? 1 : 0
}

function verdictFromStatus(warningDay: number | null, criticalDay: number | null): Verdict {
  if (criticalDay !== null) return 'critical'
  if (warningDay !== null) return 'at_risk'
  return 'stable'
}

function worstVerdict(verdicts: Verdict[]): Verdict {
  if (verdicts.includes('critical')) return 'critical'
  if (verdicts.includes('at_risk')) return 'at_risk'
  return 'stable'
}

function analyzeSensor(
  type: SensorType,
  series: SeriesPoint[],
  thresholds: Thresholds,
): SensorAnalysis {
  let warningDay: number | null = null
  let criticalDay: number | null = null
  let extreme = series.length > 0 ? series[0][type] : 0
  let extremeRank = -1

  for (const point of series) {
    const value = point[type]
    const status = computeStatus(value, thresholds)
    const rank = statusRank(status)
    if (status !== 'ok' && warningDay === null) warningDay = Math.max(1, Math.ceil(point.day))
    if (status === 'critical' && criticalDay === null) criticalDay = Math.max(1, Math.ceil(point.day))
    if (rank > extremeRank) {
      extremeRank = rank
      extreme = value
    }
  }

  return {
    type,
    verdict: verdictFromStatus(warningDay, criticalDay),
    warningDay,
    criticalDay,
    extreme,
  }
}

// Builds params from the scenario, projects the twin forward, and analyzes the
// series against the config thresholds. Pure: nothing is written anywhere.
export function runScenario(
  currentState: WaterState,
  scenario: Scenario,
  getThresholds: (type: SensorType) => Thresholds,
  volumeFactor = 1,
  baseLoadFactor = 1,
): ScenarioResult {
  const base = defaultParams()
  const params: ModelParams = {
    // The scenario multiplier applies on top of the farm's real stock load.
    fishLoad: base.fishLoad * scenario.fishLoad * baseLoadFactor,
    feedRate: base.feedRate * scenario.feedRate,
    plantMass: base.plantMass * scenario.plantMass,
    aerationLevel: scenario.aerationLevel,
    filtrationLevel: scenario.filtrationLevel,
    waterTempSetpoint: base.waterTempSetpoint + scenario.waterTempDelta,
  }

  const series = simulate(currentState, params, scenario.horizonDays, 1, volumeFactor)
  const analysis = SENSOR_TYPE_LIST.map((type) => analyzeSensor(type, series, getThresholds(type)))
  const overall = worstVerdict(analysis.map((item) => item.verdict))
  return { series, analysis, overall }
}
