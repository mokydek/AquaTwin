import { supabase } from '@/backend/client'
import { BackendError } from '@/backend/errors'
import type { Alert, AlertKind, Database, SensorType } from '@/backend/types'

type AlertInsert = Database['public']['Tables']['alerts']['Insert']

export type AlertChange = { type: 'INSERT' | 'UPDATE'; alert: Alert }

export async function createAlert(row: AlertInsert): Promise<Alert> {
  const { data, error } = await supabase.from('alerts').insert(row).select().single()
  if (error) throw new BackendError(error.message, error.code)
  return data
}

export async function listActiveAlerts(farmId: string): Promise<Alert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('farm_id', farmId)
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new BackendError(error.message, error.code)
  return data
}

export async function listResolvedAlerts(farmId: string, limit = 100): Promise<Alert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('farm_id', farmId)
    .not('resolved_at', 'is', null)
    .order('resolved_at', { ascending: false })
    .limit(limit)
  if (error) throw new BackendError(error.message, error.code)
  return data
}

export async function acknowledgeAlert(id: string): Promise<void> {
  const { error } = await supabase.from('alerts').update({ acknowledged: true }).eq('id', id)
  if (error) throw new BackendError(error.message, error.code)
}

export async function updateAlertEta(id: string, etaMinutes: number, value: number): Promise<void> {
  const { error } = await supabase
    .from('alerts')
    .update({ eta_minutes: etaMinutes, value })
    .eq('id', id)
  if (error) throw new BackendError(error.message, error.code)
}

export async function resolveAlerts(
  farmId: string,
  sensorType: SensorType,
  kind: AlertKind | 'all',
): Promise<void> {
  let query = supabase
    .from('alerts')
    .update({ resolved_at: new Date().toISOString() })
    .eq('farm_id', farmId)
    .eq('sensor_type', sensorType)
    .is('resolved_at', null)
  if (kind !== 'all') query = query.eq('kind', kind)
  const { error } = await query
  if (error) throw new BackendError(error.message, error.code)
}

let channelSeq = 0

export function subscribeToAlerts(
  farmId: string,
  onChange: (change: AlertChange) => void,
): () => void {
  channelSeq += 1
  const channel = supabase.channel(`alerts-${channelSeq}`)
  const filter = `farm_id=eq.${farmId}`
  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'alerts', filter },
    (payload) => onChange({ type: 'INSERT', alert: payload.new as Alert }),
  )
  channel.on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'alerts', filter },
    (payload) => onChange({ type: 'UPDATE', alert: payload.new as Alert }),
  )
  channel.subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
