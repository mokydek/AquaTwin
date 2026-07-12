import { supabase } from '@/backend/client'
import { BackendError } from '@/backend/errors'
import type { Device, DeviceType, TriggeredBy } from '@/backend/types'

export type SetDeviceResult = { ok: true } | { ok: false }

export async function listDevices(farmId: string): Promise<Device[]> {
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .eq('farm_id', farmId)
    .order('type')
  if (error) throw new BackendError(error.message, error.code)
  return data
}

// Flips a device on or off and records the action in automation_events. The
// manual path defaults triggeredBy to "manual"; the rule engine passes "rule"
// and the rule id so both paths log consistently. Returns a discriminated
// result; expected failures are values, not throws.
export async function setDeviceState(
  deviceId: string,
  farmId: string,
  deviceType: DeviceType,
  isOn: boolean,
  triggeredBy: TriggeredBy = 'manual',
  ruleId: string | null = null,
): Promise<SetDeviceResult> {
  try {
    const { error: updateError } = await supabase
      .from('devices')
      .update({ is_on: isOn, updated_at: new Date().toISOString() })
      .eq('id', deviceId)
    if (updateError) return { ok: false }

    const { error: eventError } = await supabase.from('automation_events').insert({
      farm_id: farmId,
      device_type: deviceType,
      action: isOn ? 'turn_on' : 'turn_off',
      triggered_by: triggeredBy,
      rule_id: ruleId,
    })
    if (eventError) return { ok: false }

    return { ok: true }
  } catch {
    return { ok: false }
  }
}

let channelSeq = 0

export function subscribeToDevices(
  farmId: string,
  onChange: (device: Device) => void,
): () => void {
  channelSeq += 1
  const channel = supabase.channel(`devices-${channelSeq}`)
  channel.on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'devices', filter: `farm_id=eq.${farmId}` },
    (payload) => onChange(payload.new as Device),
  )
  channel.subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
