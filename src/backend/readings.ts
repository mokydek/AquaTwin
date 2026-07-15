import { supabase } from '@/backend/client'
import { BackendError } from '@/backend/errors'
import type { ReadingSource } from '@/backend/types'

export type { ReadingSource }

export type ReadingRow = {
  sensor_id: string
  value: number
  recorded_at: string
  // Present on reads; omitted on inserts (the column defaults to 'simulation').
  source?: ReadingSource
}

const INSERT_CHUNK = 500

export async function insertReadings(rows: ReadingRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK)
    const { error } = await supabase.from('readings').insert(chunk)
    if (error) throw new BackendError(error.message, error.code)
  }
}

export async function getReadings(
  sensorIds: string[],
  fromIso: string,
): Promise<Record<string, ReadingRow[]>> {
  const grouped: Record<string, ReadingRow[]> = {}
  for (const id of sensorIds) grouped[id] = []
  if (sensorIds.length === 0) return grouped

  const { data, error } = await supabase
    .from('readings')
    .select('sensor_id, value, recorded_at, source')
    .in('sensor_id', sensorIds)
    .gte('recorded_at', fromIso)
    .order('recorded_at', { ascending: true })
  if (error) throw new BackendError(error.message, error.code)

  for (const row of data) {
    const bucket = grouped[row.sensor_id]
    if (bucket) bucket.push(row)
  }
  return grouped
}

let channelSeq = 0

export function subscribeToReadings(
  farmSensorIds: string[],
  onInsert: (reading: ReadingRow) => void,
): () => void {
  const allowed = new Set(farmSensorIds)
  channelSeq += 1
  const channel = supabase.channel(`readings-${channelSeq}`)
  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'readings' },
    (payload) => {
      const row = payload.new as {
        sensor_id?: string
        value?: number
        recorded_at?: string
        source?: ReadingSource
      }
      if (
        typeof row.sensor_id === 'string' &&
        typeof row.value === 'number' &&
        typeof row.recorded_at === 'string' &&
        allowed.has(row.sensor_id)
      ) {
        onInsert({
          sensor_id: row.sensor_id,
          value: row.value,
          recorded_at: row.recorded_at,
          source: row.source === 'hardware' ? 'hardware' : 'simulation',
        })
      }
    },
  )
  channel.subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
