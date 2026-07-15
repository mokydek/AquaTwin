import { supabase } from '@/backend/client'
import { BackendError } from '@/backend/errors'
import type { Database, FishBatch, FishEvent, FishEventType } from '@/backend/types'

type BatchInsert = Database['public']['Tables']['fish_batches']['Insert']

export async function listBatches(farmId: string): Promise<FishBatch[]> {
  const { data, error } = await supabase
    .from('fish_batches')
    .select('*')
    .eq('farm_id', farmId)
    .order('created_at', { ascending: false })
  if (error) throw new BackendError(error.message, error.code)
  return data
}

export async function createBatch(row: BatchInsert): Promise<FishBatch> {
  const { data, error } = await supabase.from('fish_batches').insert(row).select().single()
  if (error) throw new BackendError(error.message, error.code)
  return data
}

export async function deleteBatch(id: string): Promise<void> {
  const { error } = await supabase.from('fish_batches').delete().eq('id', id)
  if (error) throw new BackendError(error.message, error.code)
}

export async function logEvent(
  batchId: string,
  farmId: string,
  type: FishEventType,
  fields: { count?: number | null; avgWeightG?: number | null; note?: string | null },
): Promise<FishEvent> {
  const { data, error } = await supabase
    .from('fish_events')
    .insert({
      batch_id: batchId,
      farm_id: farmId,
      type,
      count: fields.count ?? null,
      avg_weight_g: fields.avgWeightG ?? null,
      note: fields.note ?? null,
    })
    .select()
    .single()
  if (error) throw new BackendError(error.message, error.code)
  return data
}

export async function listEvents(farmId: string, limit = 50): Promise<FishEvent[]> {
  const { data, error } = await supabase
    .from('fish_events')
    .select('*')
    .eq('farm_id', farmId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new BackendError(error.message, error.code)
  return data
}
