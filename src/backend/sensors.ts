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
