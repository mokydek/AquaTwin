import { supabase } from '@/backend/client'
import { BackendError } from '@/backend/errors'
import type { Sensor } from '@/backend/types'

export async function listSensors(farmId: string): Promise<Sensor[]> {
  const { data, error } = await supabase
    .from('sensors')
    .select('*')
    .eq('farm_id', farmId)
    .order('type')
  if (error) throw new BackendError(error.message, error.code)
  return data
}

export type ThresholdPatch = {
  warn_low: number | null
  warn_high: number | null
  crit_low: number | null
  crit_high: number | null
}

export type ThresholdResult = { ok: true; sensor: Sensor } | { ok: false; code: 'invalid' | 'unknown' }

// Validates that lows sit at or below highs and criticals sit outside warnings.
export function validThresholds(patch: ThresholdPatch): boolean {
  const { warn_low, warn_high, crit_low, crit_high } = patch
  if (warn_low !== null && warn_high !== null && warn_low > warn_high) return false
  if (crit_low !== null && crit_high !== null && crit_low > crit_high) return false
  if (crit_low !== null && warn_low !== null && crit_low > warn_low) return false
  if (crit_high !== null && warn_high !== null && crit_high < warn_high) return false
  return true
}

export async function updateSensorThresholds(
  sensorId: string,
  patch: ThresholdPatch,
): Promise<ThresholdResult> {
  if (!validThresholds(patch)) return { ok: false, code: 'invalid' }
  const { data, error } = await supabase
    .from('sensors')
    .update(patch)
    .eq('id', sensorId)
    .select()
    .single()
  if (error) return { ok: false, code: 'unknown' }
  return { ok: true, sensor: data }
}
