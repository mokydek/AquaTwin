// Sanity check for the trend math. Imports the real functions (no reimplementation).
// Run with: npm run check:trend  (uses tsx to load the TypeScript source)

import {
  formatEtaMinutes,
  linearRegression,
  predictThresholdEta,
  type ThresholdBounds,
  type TrendPoint,
} from '../src/shared/lib/trend.ts'

const MINUTE = 60000

function series(values: number[], stepMinutes = 1): TrendPoint[] {
  return values.map((value, index) => ({ t: index * stepMinutes * MINUTE, value }))
}

function approx(actual: number, expected: number, tolerance = 1e-6): boolean {
  return Math.abs(actual - expected) <= tolerance
}

let failures = 0
function check(name: string, condition: boolean, detail: string) {
  const status = condition ? 'PASS' : 'FAIL'
  if (!condition) failures += 1
  console.log(`[${status}] ${name} — ${detail}`)
}

// Case 1: perfect rising line, value = 2 * minutes over 8 points.
{
  const { slopePerMinute, r2 } = linearRegression(series([0, 2, 4, 6, 8, 10, 12, 14]))
  check(
    'rising line slope',
    approx(slopePerMinute, 2) && approx(r2, 1),
    `slope=${slopePerMinute} (expected 2), r2=${r2} (expected 1)`,
  )
}

// Case 2: flat line, value constant. No trend.
{
  const { slopePerMinute, r2 } = linearRegression(series([5, 5, 5, 5, 5, 5, 5, 5]))
  check(
    'flat line slope',
    approx(slopePerMinute, 0) && approx(r2, 0),
    `slope=${slopePerMinute} (expected 0), r2=${r2} (expected 0)`,
  )
}

// Case 3: perfect falling line, value = 10 - 0.5 * minutes.
{
  const { slopePerMinute, r2 } = linearRegression(series([10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5]))
  check(
    'falling line slope',
    approx(slopePerMinute, -0.5) && approx(r2, 1),
    `slope=${slopePerMinute} (expected -0.5), r2=${r2} (expected 1)`,
  )
}

// ETA: ammonia at 0.3 rising 0.1 per minute toward critHigh 1.0 → 7 minutes.
{
  const thresholds: ThresholdBounds = { warnLow: null, warnHigh: 0.5, critLow: null, critHigh: 1.0 }
  const eta = predictThresholdEta(0.3, 0.1, thresholds)
  check(
    'eta nearest bound',
    eta !== null && eta.severity === 'warning' && approx(eta.etaMinutes, 2),
    `nearest=${eta ? `${eta.severity}@${eta.bound} in ${eta.etaMinutes}m` : 'null'} (expected warning@0.5 in 2m)`,
  )
}

// ETA masked to critical only → reaches 1.0 in 7 minutes.
{
  const critOnly: ThresholdBounds = { warnLow: null, warnHigh: null, critLow: null, critHigh: 1.0 }
  const eta = predictThresholdEta(0.3, 0.1, critOnly)
  check(
    'eta critical bound',
    eta !== null && eta.severity === 'critical' && approx(eta.etaMinutes, 7),
    `crit=${eta ? `in ${eta.etaMinutes}m` : 'null'} (expected critical in 7m)`,
  )
}

// ETA: slope moving away from all bounds → null.
{
  const thresholds: ThresholdBounds = { warnLow: 6.4, warnHigh: 7.6, critLow: 6.0, critHigh: 8.0 }
  const eta = predictThresholdEta(7.0, 0, thresholds)
  check('eta zero slope', eta === null, `result=${eta === null ? 'null' : 'value'} (expected null)`)
}

// formatEtaMinutes: 220 minutes → 3 h 40 m.
{
  const parts = formatEtaMinutes(220)
  check(
    'format eta',
    parts.hours === 3 && parts.minutes === 40,
    `${parts.hours}h ${parts.minutes}m (expected 3h 40m)`,
  )
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll trend checks passed')
