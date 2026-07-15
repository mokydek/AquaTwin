import { createRule } from '@/backend/automation'
import { createFarmWithDefaults, listFarms } from '@/backend/farms'
import { seedDefaultLayout } from '@/backend/layout'
import { createBatch } from '@/backend/livestock'
import { insertReadings } from '@/backend/readings'
import { listSensors } from '@/backend/sensors'
import type { Farm, NodeType } from '@/backend/types'
// engine.ts is a pure, dependency free simulation lib (no supabase, no React);
// reused here to seed history exactly like the in app simulator does.
import { generateHistory } from '@/frontend/simulator/engine'

export type DemoStage = 'farm' | 'history' | 'sensors' | 'done'
export type DemoProgress = { stage: DemoStage; progress: number }

// All user facing text is passed in already translated; this module never
// touches i18n.
export type DemoContent = {
  farmName: string
  nodeLabels: Record<NodeType, string>
  oxygenRuleName: string
  tempRuleName: string
}

// Idempotent bootstrap for the current (anonymous) user. If a farm already
// exists it is returned untouched, so a reload during or after setup can never
// create a second farm.
export async function setupDemoFarm(
  content: DemoContent,
  onProgress?: (progress: DemoProgress) => void,
): Promise<Farm> {
  const existing = await listFarms()
  if (existing.length > 0) {
    onProgress?.({ stage: 'done', progress: 1 })
    return existing[0]
  }

  onProgress?.({ stage: 'farm', progress: 0.1 })
  const farm = await createFarmWithDefaults(content.farmName)

  // Seed the default loop so the fish batch has a tank to live in. The twin
  // Layout backfill would otherwise do this lazily on first visit.
  const layout = await seedDefaultLayout(farm.id, content.nodeLabels)
  const fishTank = layout.nodes.find((node) => node.type === 'fish_tank') ?? null
  onProgress?.({ stage: 'farm', progress: 0.3 })

  // 24 hours of calm history so the charts and reports are not empty on arrival.
  onProgress?.({ stage: 'history', progress: 0.5 })
  const sensors = await listSensors(farm.id)
  const history = generateHistory(
    sensors.map((sensor) => ({ id: sensor.id, type: sensor.type })),
    Date.now(),
    24,
    5,
  )
  await insertReadings(history)
  onProgress?.({ stage: 'history', progress: 0.8 })

  // A starter tilapia batch (300 fish at 180 g) plus two protective rules.
  onProgress?.({ stage: 'sensors', progress: 0.9 })
  await createBatch({
    farm_id: farm.id,
    species: 'tilapia',
    initial_count: 300,
    avg_weight_g: 180,
    node_id: fishTank?.id ?? null,
  })
  await createRule({
    farm_id: farm.id,
    name: content.oxygenRuleName,
    sensor_type: 'dissolved_oxygen',
    condition: 'below',
    threshold: 5,
    device_type: 'aerator',
    action: 'turn_on',
    enabled: true,
  })
  await createRule({
    farm_id: farm.id,
    name: content.tempRuleName,
    sensor_type: 'water_temp',
    condition: 'below',
    threshold: 20,
    device_type: 'heater',
    action: 'turn_on',
    enabled: true,
  })

  onProgress?.({ stage: 'done', progress: 1 })
  return farm
}
