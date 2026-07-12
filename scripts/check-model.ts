// Sanity check for the twin farm model. Imports the real model (no reimplementation).
// Run with: npm run check:model

import { baselineState, defaultParams, simulate } from '../src/frontend/twin/model.ts'

// Critical bounds from the aquaponics config (used only as expected assertions).
const CRIT = {
  ph: { low: 6.0, high: 8.0 },
  water_temp: { low: 18, high: 32 },
  dissolved_oxygen: { low: 4, high: null },
  ammonia: { low: null, high: 1.0 },
  nitrite: { low: null, high: 1.0 },
  nitrate: { low: null, high: 300 },
} as const

const AMMONIA_WARN = 0.5
const AMMONIA_CRIT = 1.0

let failures = 0
function check(name: string, condition: boolean, detail: string) {
  if (!condition) failures += 1
  console.log(`[${condition ? 'PASS' : 'FAIL'}] ${name} — ${detail}`)
}

// Baseline 30 day run stays within every non critical range.
{
  const series = simulate(baselineState(), defaultParams(), 30)
  let worst = ''
  let ok = true
  for (const point of series) {
    for (const key of Object.keys(CRIT) as (keyof typeof CRIT)[]) {
      const value = point[key]
      const bound = CRIT[key]
      if (bound.low !== null && value < bound.low) {
        ok = false
        worst = `${key}=${value.toFixed(2)} below ${bound.low} on day ${point.day.toFixed(1)}`
      }
      if (bound.high !== null && value > bound.high) {
        ok = false
        worst = `${key}=${value.toFixed(2)} above ${bound.high} on day ${point.day.toFixed(1)}`
      }
    }
  }
  const last = series[series.length - 1]
  check(
    'baseline stays non critical for 30 days',
    ok,
    ok
      ? `end state ph=${last.ph.toFixed(2)} temp=${last.water_temp.toFixed(2)} do=${last.dissolved_oxygen.toFixed(2)} nh3=${last.ammonia.toFixed(3)} no2=${last.nitrite.toFixed(3)} no3=${last.nitrate.toFixed(1)}`
      : worst,
  )
}

// Overfeeding drives ammonia into warning (and report the critical day if reached).
{
  const params = { ...defaultParams(), feedRate: 1.8, fishLoad: 1.3 }
  const series = simulate(baselineState(), params, 30)
  let warnDay: number | null = null
  let critDay: number | null = null
  let peak = 0
  for (const point of series) {
    peak = Math.max(peak, point.ammonia)
    if (warnDay === null && point.ammonia >= AMMONIA_WARN) warnDay = point.day
    if (critDay === null && point.ammonia >= AMMONIA_CRIT) critDay = point.day
  }
  check(
    'overfeeding drives ammonia into warning within horizon',
    warnDay !== null,
    `warning day=${warnDay === null ? 'never' : warnDay.toFixed(1)}, critical day=${critDay === null ? 'never' : critDay.toFixed(1)}, peak=${peak.toFixed(3)}`,
  )
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll model checks passed')
