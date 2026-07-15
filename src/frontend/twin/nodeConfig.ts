import { Database, Filter, Fish, Sprout, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { NodeType } from '@/backend'
import type { SensorType } from '@/shared/config/aquaponics'

export const NODE_ICONS: Record<NodeType, LucideIcon> = {
  fish_tank: Fish,
  grow_bed: Sprout,
  biofilter: Filter,
  sump: Database,
  pump: Zap,
}

export const NODE_W = 100
export const NODE_H = 56
export const CANVAS_W = 460
export const CANVAS_H = 320
export const GRID = 20
export const MAX_NODES = 24

// Status fallback for nodes that have no sensor assigned (the pre layout mapping).
export const FALLBACK_SENSORS: Record<NodeType, SensorType[]> = {
  fish_tank: ['dissolved_oxygen', 'water_temp', 'ph'],
  biofilter: ['ammonia', 'nitrite'],
  grow_bed: ['nitrate', 'ph'],
  sump: [],
  pump: [],
}

export const FALLBACK_VALUE_SENSOR: Record<NodeType, SensorType | null> = {
  fish_tank: 'dissolved_oxygen',
  biofilter: 'ammonia',
  grow_bed: 'nitrate',
  sump: null,
  pump: null,
}

export function snap(value: number): number {
  return Math.round(value / GRID) * GRID
}

export function clampX(x: number): number {
  return Math.max(0, Math.min(CANVAS_W - NODE_W, x))
}

export function clampY(y: number): number {
  return Math.max(0, Math.min(CANVAS_H - NODE_H, y))
}
