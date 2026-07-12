import { supabase } from '@/backend/client'
import { BackendError } from '@/backend/errors'
import type { Database, Farm } from '@/backend/types'
import { DEVICE_TYPE_LIST, SENSOR_TYPES, SENSOR_TYPE_LIST } from '@/shared/config/aquaponics'

type SensorInsert = Database['public']['Tables']['sensors']['Insert']
type DeviceInsert = Database['public']['Tables']['devices']['Insert']

export async function listFarms(): Promise<Farm[]> {
  const { data, error } = await supabase
    .from('farms')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new BackendError(error.message, error.code)
  return data
}

export async function getFarm(id: string): Promise<Farm> {
  const { data, error } = await supabase.from('farms').select('*').eq('id', id).single()
  if (error) throw new BackendError(error.message, error.code)
  return data
}

// Inserts the farm, then its six default sensors and six default devices.
// owner_id is filled in by the database default (auth.uid()).
export async function createFarmWithDefaults(name: string): Promise<Farm> {
  const { data: farm, error: farmError } = await supabase
    .from('farms')
    .insert({ name })
    .select()
    .single()
  if (farmError) throw new BackendError(farmError.message, farmError.code)

  const sensorRows: SensorInsert[] = SENSOR_TYPE_LIST.map((type) => {
    const { unit, thresholds } = SENSOR_TYPES[type]
    return {
      farm_id: farm.id,
      type,
      unit,
      warn_low: thresholds.warnLow,
      warn_high: thresholds.warnHigh,
      crit_low: thresholds.critLow,
      crit_high: thresholds.critHigh,
    }
  })
  const { error: sensorError } = await supabase.from('sensors').insert(sensorRows)
  if (sensorError) throw new BackendError(sensorError.message, sensorError.code)

  const deviceRows: DeviceInsert[] = DEVICE_TYPE_LIST.map((type) => ({
    farm_id: farm.id,
    type,
  }))
  const { error: deviceError } = await supabase.from('devices').insert(deviceRows)
  if (deviceError) throw new BackendError(deviceError.message, deviceError.code)

  return farm
}
