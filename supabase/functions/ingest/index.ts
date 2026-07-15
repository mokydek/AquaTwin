// AquaTwin hardware ingestion edge function (Deno).
//
// Devices POST their readings here with an x-api-key header. The key is never
// stored in plaintext: we hash the incoming key with SHA-256 and match it against
// farm_api_keys.key_hash, which was written by the app the same way. Raw keys are
// never logged. Uses the service role key (injected) so it can bypass RLS after
// verifying ownership through the api key.
//
// Deploy with: supabase functions deploy ingest --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-api-key',
}

const SENSOR_TYPES = ['ph', 'water_temp', 'dissolved_oxygen', 'ammonia', 'nitrite', 'nitrate']

// Generous physical bounds, mirroring src/shared/config/aquaponics.ts.
const BOUNDS: Record<string, { min: number; max: number }> = {
  ph: { min: 0, max: 14 },
  water_temp: { min: -5, max: 50 },
  dissolved_oxygen: { min: 0, max: 30 },
  ammonia: { min: 0, max: 20 },
  nitrite: { min: 0, max: 20 },
  nitrate: { min: 0, max: 1000 },
}

const MAX_BATCH = 60

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) {
    return json({ error: 'missing_api_key' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const keyHash = await sha256Hex(apiKey)
  const { data: keyRow } = await supabase
    .from('farm_api_keys')
    .select('id, farm_id')
    .eq('key_hash', keyHash)
    .eq('revoked', false)
    .maybeSingle()

  if (!keyRow) {
    return json({ error: 'invalid_api_key' }, 401)
  }

  // Fire and forget: record usage without blocking the response.
  void supabase
    .from('farm_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id)

  let body: { readings?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const readings = body.readings
  if (!Array.isArray(readings)) {
    return json({ error: 'readings_required' }, 400)
  }
  if (readings.length > MAX_BATCH) {
    return json({ error: 'batch_too_large', max: MAX_BATCH }, 400)
  }

  const { data: sensors } = await supabase
    .from('sensors')
    .select('id, type')
    .eq('farm_id', keyRow.farm_id)
  const sensorIdByType = new Map<string, string>(
    (sensors ?? []).map((sensor: { id: string; type: string }) => [sensor.type, sensor.id]),
  )

  const accepted: { sensor_id: string; value: number; source: string; recorded_at?: string }[] = []
  const rejected: { index: number; reason: string }[] = []

  readings.forEach((entry: unknown, index: number) => {
    const item = entry as { sensor?: unknown; value?: unknown; recorded_at?: unknown }
    const type = item.sensor
    const value = item.value
    if (typeof type !== 'string' || !SENSOR_TYPES.includes(type)) {
      rejected.push({ index, reason: 'unknown_sensor' })
      return
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      rejected.push({ index, reason: 'invalid_value' })
      return
    }
    const bounds = BOUNDS[type]
    if (value < bounds.min || value > bounds.max) {
      rejected.push({ index, reason: 'out_of_bounds' })
      return
    }
    const sensorId = sensorIdByType.get(type)
    if (!sensorId) {
      rejected.push({ index, reason: 'sensor_not_on_farm' })
      return
    }
    const row: { sensor_id: string; value: number; source: string; recorded_at?: string } = {
      sensor_id: sensorId,
      value,
      source: 'hardware',
    }
    if (typeof item.recorded_at === 'string') row.recorded_at = item.recorded_at
    accepted.push(row)
  })

  let inserted = 0
  if (accepted.length > 0) {
    const { error } = await supabase.from('readings').insert(accepted)
    if (error) {
      return json({ error: 'insert_failed', detail: error.message }, 500)
    }
    inserted = accepted.length
  }

  const status = rejected.length > 0 && inserted === 0 ? 400 : 200
  return json({ inserted, rejected }, status)
})
