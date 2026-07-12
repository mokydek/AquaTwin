// Pure trend math. No React, no Supabase, no project imports so it stays
// trivially testable from a plain script.

export type TrendPoint = { t: number; value: number }

export type Regression = { slopePerMinute: number; r2: number }

export type ThresholdBounds = {
  warnLow: number | null
  warnHigh: number | null
  critLow: number | null
  critHigh: number | null
}

export type EtaSeverity = 'warning' | 'critical'

export type ThresholdEta = {
  severity: EtaSeverity
  bound: number
  etaMinutes: number
}

const MAX_ETA_MINUTES = 240

// Least squares fit of value against time measured in minutes.
export function linearRegression(points: TrendPoint[]): Regression {
  const n = points.length
  if (n < 2) return { slopePerMinute: 0, r2: 0 }

  const t0 = points[0].t
  const xs = new Array<number>(n)
  let sumX = 0
  let sumY = 0
  for (let i = 0; i < n; i += 1) {
    const x = (points[i].t - t0) / 60000
    xs[i] = x
    sumX += x
    sumY += points[i].value
  }
  const meanX = sumX / n
  const meanY = sumY / n

  let sxx = 0
  let sxy = 0
  let syy = 0
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX
    const dy = points[i].value - meanY
    sxx += dx * dx
    sxy += dx * dy
    syy += dy * dy
  }
  if (sxx === 0) return { slopePerMinute: 0, r2: 0 }

  const slopePerMinute = sxy / sxx
  const r2 = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy)
  return { slopePerMinute, r2 }
}

// Given the current value and a slope, find the nearest bound the value is
// heading toward and how many minutes until it reaches it. Caps at 240 minutes.
export function predictThresholdEta(
  current: number,
  slopePerMinute: number,
  thresholds: ThresholdBounds,
): ThresholdEta | null {
  if (!Number.isFinite(slopePerMinute) || slopePerMinute === 0) return null

  const candidates: { severity: EtaSeverity; bound: number }[] = []
  if (slopePerMinute > 0) {
    if (thresholds.warnHigh !== null && current < thresholds.warnHigh) {
      candidates.push({ severity: 'warning', bound: thresholds.warnHigh })
    }
    if (thresholds.critHigh !== null && current < thresholds.critHigh) {
      candidates.push({ severity: 'critical', bound: thresholds.critHigh })
    }
  } else {
    if (thresholds.warnLow !== null && current > thresholds.warnLow) {
      candidates.push({ severity: 'warning', bound: thresholds.warnLow })
    }
    if (thresholds.critLow !== null && current > thresholds.critLow) {
      candidates.push({ severity: 'critical', bound: thresholds.critLow })
    }
  }

  let best: ThresholdEta | null = null
  for (const candidate of candidates) {
    const etaMinutes = (candidate.bound - current) / slopePerMinute
    if (etaMinutes <= 0) continue
    if (best === null || etaMinutes < best.etaMinutes) {
      best = { severity: candidate.severity, bound: candidate.bound, etaMinutes }
    }
  }
  if (best === null || best.etaMinutes > MAX_ETA_MINUTES) return null
  return best
}

export function formatEtaMinutes(totalMinutes: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.round(totalMinutes))
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}
