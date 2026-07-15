// Pure livestock math. No React, no Supabase.

import type { FishBatch, FishEvent } from '@/backend'
import type { Species } from '@/shared/config/species'
import { SPECIES } from '@/shared/config/species'
import type { Status } from '@/shared/lib/status'

export type BatchStats = {
  currentCount: number
  currentAvgWeightG: number
  biomassKg: number
  totalMortality: number
  survivalRate: number
}

export function computeBatchStats(batch: FishBatch, events: FishEvent[]): BatchStats {
  let mortality = 0
  let harvest = 0
  let restock = 0
  let latestWeight: number | null = null
  let latestWeightTime = ''

  for (const event of events) {
    if (event.type === 'mortality') mortality += event.count ?? 0
    else if (event.type === 'harvest') harvest += event.count ?? 0
    else if (event.type === 'restock') restock += event.count ?? 0
    else if (event.type === 'weighing' && event.avg_weight_g !== null) {
      if (latestWeight === null || event.created_at > latestWeightTime) {
        latestWeight = event.avg_weight_g
        latestWeightTime = event.created_at
      }
    }
  }

  const currentCount = Math.max(0, batch.initial_count - mortality - harvest + restock)
  const currentAvgWeightG = latestWeight ?? batch.avg_weight_g
  const biomassKg = (currentCount * currentAvgWeightG) / 1000
  const stocked = batch.initial_count + restock
  const survivalRate =
    stocked > 0 ? Math.max(0, Math.min(100, ((stocked - mortality) / stocked) * 100)) : 0

  return { currentCount, currentAvgWeightG, biomassKg, totalMortality: mortality, survivalRate }
}

export function computeDensity(biomassKg: number, tankVolumeL: number | null): number | null {
  if (tankVolumeL === null || tankVolumeL <= 0) return null
  return biomassKg / (tankVolumeL / 1000)
}

export function densityStatus(density: number, speciesMax: number): Status {
  if (density > speciesMax) return 'critical'
  if (density >= speciesMax * 0.8) return 'warning'
  return 'ok'
}

export type FeedSuggestion = { gramsPerDay: number; reduced: boolean }

// Feeding fish held outside their optimal temperature range stresses them and
// pollutes the water, so the daily suggestion is halved and flagged.
export function computeFeedSuggestion(
  biomassKg: number,
  species: Species,
  currentWaterTemp: number | null,
): FeedSuggestion {
  const config = SPECIES[species]
  let grams = biomassKg * 1000 * (config.feedPercent / 100)
  let reduced = false
  if (
    currentWaterTemp !== null &&
    (currentWaterTemp < config.tempMin || currentWaterTemp > config.tempMax)
  ) {
    grams = grams / 2
    reduced = true
  }
  return { gramsPerDay: grams, reduced }
}

export function totalBiomassKg(batches: FishBatch[], events: FishEvent[]): number {
  let total = 0
  for (const batch of batches) {
    total += computeBatchStats(
      batch,
      events.filter((event) => event.batch_id === batch.id),
    ).biomassKg
  }
  return total
}

// A whole farm load factor: 20 kg per cubic metre maps to 1, clamped to a sane
// range. Falls back to 1 when there is no stock or no tank volume.
export function computeLoadFactor(biomassKg: number, totalTankVolumeL: number): number {
  if (biomassKg <= 0 || totalTankVolumeL <= 0) return 1
  const density = biomassKg / (totalTankVolumeL / 1000)
  return Math.max(0.25, Math.min(3, density / 20))
}
