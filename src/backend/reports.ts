import { supabase } from '@/backend/client'
import { BackendError } from '@/backend/errors'
import type {
  AlertKind,
  AlertSeverity,
  DeviceType,
  FishEventType,
  ReadingSource,
  SensorType,
  TriggeredBy,
} from '@/backend/types'
import { computeBatchStats } from '@/shared/lib/biomass'

const DAY_MS = 24 * 60 * 60 * 1000

// Hard cap on any export window. The UI only offers 7 and 30 day ranges, but the
// backend clamps too, so a hand crafted call can never pull an unbounded range.
export const MAX_EXPORT_DAYS = 31

const READINGS_PAGE = 10000

// ============================================================
// Report aggregates (RPC backed, security invoker, RLS enforced)
// ============================================================

export type SensorStat = {
  sensorType: SensorType
  avg: number
  min: number
  max: number
  pctOk: number
  pctWarning: number
  pctCritical: number
  samples: number
  hardwareShare: number
}

export async function getReportStats(
  farmId: string,
  fromIso: string,
  toIso: string,
): Promise<SensorStat[]> {
  const { data, error } = await supabase.rpc('report_sensor_stats', {
    p_farm: farmId,
    p_from: fromIso,
    p_to: toIso,
  })
  if (error) throw new BackendError(error.message, error.code)
  return (data ?? []).map((row) => ({
    sensorType: row.sensor_type as SensorType,
    avg: row.avg_value,
    min: row.min_value,
    max: row.max_value,
    pctOk: row.pct_ok,
    pctWarning: row.pct_warning,
    pctCritical: row.pct_critical,
    samples: Number(row.samples),
    hardwareShare: row.hardware_share,
  }))
}

export type HourlyPoint = { sensorType: SensorType; t: number; value: number }

export async function getHourlySeries(
  farmId: string,
  fromIso: string,
  toIso: string,
): Promise<HourlyPoint[]> {
  const { data, error } = await supabase.rpc('report_hourly_series', {
    p_farm: farmId,
    p_from: fromIso,
    p_to: toIso,
  })
  if (error) throw new BackendError(error.message, error.code)
  return (data ?? []).map((row) => ({
    sensorType: row.sensor_type as SensorType,
    t: Date.parse(row.bucket),
    value: row.avg_value,
  }))
}

// ============================================================
// Incidents in range
// ============================================================

export type RangeAlert = {
  id: string
  sensorType: SensorType
  kind: AlertKind
  severity: AlertSeverity
  value: number | null
  createdAt: string
  resolvedAt: string | null
  durationMs: number | null
}

export async function getAlertsInRange(
  farmId: string,
  fromIso: string,
  toIso: string,
): Promise<RangeAlert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('id, sensor_type, kind, severity, value, created_at, resolved_at')
    .eq('farm_id', farmId)
    .gte('created_at', fromIso)
    .lt('created_at', toIso)
    .order('created_at', { ascending: false })
  if (error) throw new BackendError(error.message, error.code)
  return data.map((row) => ({
    id: row.id,
    sensorType: row.sensor_type,
    kind: row.kind,
    severity: row.severity,
    value: row.value,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    // Resolved incidents have a measured duration; still open ones stay null.
    durationMs: row.resolved_at
      ? Date.parse(row.resolved_at) - Date.parse(row.created_at)
      : null,
  }))
}

// ============================================================
// Automation summary
// ============================================================

export type AutomationSummary = {
  total: number
  byTrigger: Record<TriggeredBy, number>
  byDevice: { device: DeviceType; count: number }[]
}

export async function getAutomationSummary(
  farmId: string,
  fromIso: string,
  toIso: string,
): Promise<AutomationSummary> {
  const { data, error } = await supabase
    .from('automation_events')
    .select('device_type, triggered_by')
    .eq('farm_id', farmId)
    .gte('created_at', fromIso)
    .lt('created_at', toIso)
  if (error) throw new BackendError(error.message, error.code)

  const byTrigger: Record<TriggeredBy, number> = { rule: 0, manual: 0 }
  const deviceCounts = new Map<DeviceType, number>()
  for (const row of data) {
    byTrigger[row.triggered_by] += 1
    deviceCounts.set(row.device_type, (deviceCounts.get(row.device_type) ?? 0) + 1)
  }
  const byDevice = [...deviceCounts.entries()]
    .map(([device, count]) => ({ device, count }))
    .sort((a, b) => b.count - a.count)
  return { total: data.length, byTrigger, byDevice }
}

// ============================================================
// Livestock summary
// ============================================================

export type LivestockSummary = {
  currentCount: number
  biomassKg: number
  mortality: number
  harvest: number
  restock: number
}

export async function getLivestockSummary(
  farmId: string,
  fromIso: string,
  toIso: string,
): Promise<LivestockSummary> {
  // Current totals need the full event history per batch; the period counts use
  // only the events that fall inside the range.
  const [batchesResult, eventsResult] = await Promise.all([
    supabase.from('fish_batches').select('*').eq('farm_id', farmId),
    supabase.from('fish_events').select('*').eq('farm_id', farmId),
  ])
  if (batchesResult.error) {
    throw new BackendError(batchesResult.error.message, batchesResult.error.code)
  }
  if (eventsResult.error) {
    throw new BackendError(eventsResult.error.message, eventsResult.error.code)
  }
  const batches = batchesResult.data
  const events = eventsResult.data

  let currentCount = 0
  let biomassKg = 0
  for (const batch of batches) {
    const stats = computeBatchStats(
      batch,
      events.filter((event) => event.batch_id === batch.id),
    )
    currentCount += stats.currentCount
    biomassKg += stats.biomassKg
  }

  const from = Date.parse(fromIso)
  const to = Date.parse(toIso)
  let mortality = 0
  let harvest = 0
  let restock = 0
  for (const event of events) {
    const at = Date.parse(event.created_at)
    if (at < from || at >= to) continue
    if (event.type === 'mortality') mortality += event.count ?? 0
    else if (event.type === 'harvest') harvest += event.count ?? 0
    else if (event.type === 'restock') restock += event.count ?? 0
  }
  return { currentCount, biomassKg, mortality, harvest, restock }
}

// ============================================================
// CSV export fetchers (row shapes ready for shared/lib/csv toCsv)
// ============================================================

// Clamp the requested window to the last MAX_EXPORT_DAYS ending at `to`.
function clampFrom(fromIso: string, toIso: string): string {
  const to = Date.parse(toIso)
  const from = Date.parse(fromIso)
  const earliest = to - MAX_EXPORT_DAYS * DAY_MS
  return new Date(Math.max(from, earliest)).toISOString()
}

export type ReadingExportRow = {
  timestamp: string
  sensor: SensorType
  value: number
  unit: string
  source: ReadingSource
}

export async function exportReadingsCsv(
  farmId: string,
  fromIso: string,
  toIso: string,
): Promise<ReadingExportRow[]> {
  const from = clampFrom(fromIso, toIso)

  // Resolve sensor id to its type and unit once, so every row is self describing.
  const { data: sensors, error: sensorError } = await supabase
    .from('sensors')
    .select('id, type, unit')
    .eq('farm_id', farmId)
  if (sensorError) throw new BackendError(sensorError.message, sensorError.code)
  const meta = new Map(sensors.map((sensor) => [sensor.id, { type: sensor.type, unit: sensor.unit }]))
  const ids = sensors.map((sensor) => sensor.id)
  if (ids.length === 0) return []

  const rows: ReadingExportRow[] = []
  for (let offset = 0; ; offset += READINGS_PAGE) {
    const { data, error } = await supabase
      .from('readings')
      .select('sensor_id, value, recorded_at, source')
      .in('sensor_id', ids)
      .gte('recorded_at', from)
      .lt('recorded_at', toIso)
      .order('recorded_at', { ascending: true })
      .range(offset, offset + READINGS_PAGE - 1)
    if (error) throw new BackendError(error.message, error.code)
    for (const row of data) {
      const info = meta.get(row.sensor_id)
      if (!info) continue
      rows.push({
        timestamp: row.recorded_at,
        sensor: info.type,
        value: row.value,
        unit: info.unit,
        source: row.source,
      })
    }
    if (data.length < READINGS_PAGE) break
  }
  return rows
}

export type AlertExportRow = {
  created_at: string
  resolved_at: string
  sensor: SensorType
  kind: AlertKind
  severity: AlertSeverity
  value: number | ''
  threshold: number | ''
  eta_minutes: number | ''
  acknowledged: string
}

export async function exportAlertsCsv(
  farmId: string,
  fromIso: string,
  toIso: string,
): Promise<AlertExportRow[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('created_at, resolved_at, sensor_type, kind, severity, value, threshold, eta_minutes, acknowledged')
    .eq('farm_id', farmId)
    .gte('created_at', clampFrom(fromIso, toIso))
    .lt('created_at', toIso)
    .order('created_at', { ascending: true })
  if (error) throw new BackendError(error.message, error.code)
  return data.map((row) => ({
    created_at: row.created_at,
    resolved_at: row.resolved_at ?? '',
    sensor: row.sensor_type,
    kind: row.kind,
    severity: row.severity,
    value: row.value ?? '',
    threshold: row.threshold ?? '',
    eta_minutes: row.eta_minutes ?? '',
    acknowledged: String(row.acknowledged),
  }))
}

export type FishEventExportRow = {
  created_at: string
  batch_id: string
  type: FishEventType
  count: number | ''
  avg_weight_g: number | ''
  note: string
}

export async function exportFishEventsCsv(
  farmId: string,
  fromIso: string,
  toIso: string,
): Promise<FishEventExportRow[]> {
  const { data, error } = await supabase
    .from('fish_events')
    .select('created_at, batch_id, type, count, avg_weight_g, note')
    .eq('farm_id', farmId)
    .gte('created_at', clampFrom(fromIso, toIso))
    .lt('created_at', toIso)
    .order('created_at', { ascending: true })
  if (error) throw new BackendError(error.message, error.code)
  return data.map((row) => ({
    created_at: row.created_at,
    batch_id: row.batch_id,
    type: row.type,
    count: row.count ?? '',
    avg_weight_g: row.avg_weight_g ?? '',
    note: row.note ?? '',
  }))
}
