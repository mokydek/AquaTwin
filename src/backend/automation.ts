import { supabase } from '@/backend/client'
import { BackendError } from '@/backend/errors'
import type {
  AutomationRule,
  Database,
  DeviceType,
  RuleAction,
  TriggeredBy,
} from '@/backend/types'

type RuleInsert = Database['public']['Tables']['automation_rules']['Insert']
type RuleUpdate = Database['public']['Tables']['automation_rules']['Update']

export type AutomationEventRow = {
  id: number
  device_type: DeviceType
  action: RuleAction
  triggered_by: TriggeredBy
  rule_id: string | null
  rule_name: string | null
  created_at: string
}

export async function listRules(farmId: string): Promise<AutomationRule[]> {
  const { data, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('farm_id', farmId)
    .order('created_at', { ascending: true })
  if (error) throw new BackendError(error.message, error.code)
  return data
}

export async function createRule(row: RuleInsert): Promise<AutomationRule> {
  const { data, error } = await supabase.from('automation_rules').insert(row).select().single()
  if (error) throw new BackendError(error.message, error.code)
  return data
}

export async function updateRule(id: string, patch: RuleUpdate): Promise<AutomationRule> {
  const { data, error } = await supabase
    .from('automation_rules')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new BackendError(error.message, error.code)
  return data
}

export async function setRuleEnabled(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from('automation_rules').update({ enabled }).eq('id', id)
  if (error) throw new BackendError(error.message, error.code)
}

export async function deleteRule(id: string): Promise<void> {
  const { error } = await supabase.from('automation_rules').delete().eq('id', id)
  if (error) throw new BackendError(error.message, error.code)
}

// Two simple typed queries instead of a view: fetch the events, then resolve the
// rule names for the rule ids that appear.
export async function listAutomationEvents(
  farmId: string,
  limit = 100,
): Promise<AutomationEventRow[]> {
  const { data: events, error } = await supabase
    .from('automation_events')
    .select('id, device_type, action, triggered_by, rule_id, created_at')
    .eq('farm_id', farmId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new BackendError(error.message, error.code)

  const ruleIds = [...new Set(events.filter((event) => event.rule_id).map((event) => event.rule_id))]
  const names = new Map<string, string>()
  if (ruleIds.length > 0) {
    const { data: rules, error: ruleError } = await supabase
      .from('automation_rules')
      .select('id, name')
      .in('id', ruleIds as string[])
    if (ruleError) throw new BackendError(ruleError.message, ruleError.code)
    for (const rule of rules) names.set(rule.id, rule.name)
  }

  return events.map((event) => ({
    ...event,
    rule_name: event.rule_id ? (names.get(event.rule_id) ?? null) : null,
  }))
}

let channelSeq = 0

export type AutomationEventInsert = {
  id: number
  device_type: DeviceType
  action: RuleAction
  triggered_by: TriggeredBy
  rule_id: string | null
  created_at: string
}

export function subscribeToAutomationEvents(
  farmId: string,
  onInsert: (event: AutomationEventInsert) => void,
): () => void {
  channelSeq += 1
  const channel = supabase.channel(`automation-events-${channelSeq}`)
  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'automation_events', filter: `farm_id=eq.${farmId}` },
    (payload) => onInsert(payload.new as AutomationEventInsert),
  )
  channel.subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
