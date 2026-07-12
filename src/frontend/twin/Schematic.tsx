import { useId } from 'react'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { Device } from '@/backend'
import { useLiveReadings } from '@/frontend/data/LiveReadingsProvider'
import type { SensorType } from '@/shared/config/aquaponics'
import { SENSOR_TYPES } from '@/shared/config/aquaponics'
import { computeStatus } from '@/shared/lib/status'
import type { Status } from '@/shared/lib/status'

export type SchematicNodeId = 'fish_tank' | 'biofilter' | 'grow_beds' | 'sump' | 'pump'

type NodeStatus = Status | 'neutral'

type NodeDef = {
  id: SchematicNodeId
  x: number
  y: number
  w: number
  h: number
  statusSensors: SensorType[]
  valueSensor: SensorType | null
}

const NODES: NodeDef[] = [
  { id: 'fish_tank', x: 40, y: 40, w: 110, h: 60, statusSensors: ['dissolved_oxygen', 'water_temp', 'ph'], valueSensor: 'dissolved_oxygen' },
  { id: 'pump', x: 45, y: 130, w: 100, h: 40, statusSensors: [], valueSensor: null },
  { id: 'sump', x: 40, y: 200, w: 110, h: 60, statusSensors: [], valueSensor: null },
  { id: 'biofilter', x: 250, y: 40, w: 110, h: 60, statusSensors: ['ammonia', 'nitrite'], valueSensor: 'ammonia' },
  { id: 'grow_beds', x: 250, y: 200, w: 110, h: 60, statusSensors: ['nitrate', 'ph'], valueSensor: 'nitrate' },
]

const EDGES = [
  { x1: 150, y1: 70, x2: 250, y2: 70 },
  { x1: 305, y1: 100, x2: 305, y2: 200 },
  { x1: 250, y1: 230, x2: 150, y2: 230 },
  { x1: 95, y1: 200, x2: 95, y2: 170 },
  { x1: 95, y1: 130, x2: 95, y2: 100 },
]

function rank(status: Status): number {
  return status === 'critical' ? 2 : status === 'warning' ? 1 : 0
}

function worstStatus(types: SensorType[], latest: Map<SensorType, number>): NodeStatus {
  let worst: Status | null = null
  for (const type of types) {
    const value = latest.get(type)
    if (value === undefined) continue
    const status = computeStatus(value, SENSOR_TYPES[type].thresholds)
    if (worst === null || rank(status) > rank(worst)) worst = status
  }
  return worst ?? 'neutral'
}

function nodeFill(status: NodeStatus): string {
  if (status === 'critical') return 'var(--color-foreground)'
  if (status === 'warning') return 'var(--color-border)'
  return 'var(--color-background)'
}

function nodeTextColor(status: NodeStatus): string {
  if (status === 'critical') return 'var(--color-background)'
  if (status === 'neutral') return 'var(--color-muted)'
  return 'var(--color-foreground)'
}

export type SchematicProps = {
  devices: Device[]
  selected: SchematicNodeId | null
  onSelect: (id: SchematicNodeId) => void
}

export function Schematic({ devices, selected, onSelect }: SchematicProps) {
  const { t } = useTranslation()
  const { latest } = useLiveReadings()
  const arrowId = useId()

  const pump = devices.find((device) => device.type === 'main_pump')
  const pumpOn = pump?.is_on ?? false

  function statusFor(node: NodeDef): NodeStatus {
    if (node.id === 'pump') return pumpOn ? 'ok' : 'warning'
    if (node.id === 'sump') return 'neutral'
    return worstStatus(node.statusSensors, latest)
  }

  function valueFor(node: NodeDef): string | null {
    if (node.id === 'pump') return pumpOn ? t('app.overview.on') : t('app.overview.off')
    if (!node.valueSensor) return null
    const value = latest.get(node.valueSensor)
    if (value === undefined) return '—'
    const config = SENSOR_TYPES[node.valueSensor]
    return `${value.toFixed(config.decimals)} ${config.unit}`
  }

  function handleKeyDown(event: KeyboardEvent<SVGGElement>, id: SchematicNodeId) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(id)
    }
  }

  return (
    <svg viewBox="0 0 400 300" className="h-auto w-full" role="group" aria-label={t('twin.tabs.schematic')}>
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 6 6"
          refX="5"
          refY="3"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 z" fill="var(--color-foreground)" />
        </marker>
      </defs>

      {EDGES.map((edge, index) => (
        <g key={`edge-${index}`}>
          <line
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            stroke="var(--color-border)"
            strokeWidth={1.5}
            markerEnd={`url(#${arrowId})`}
          />
          <line
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            stroke="var(--color-foreground)"
            strokeWidth={1.5}
            strokeDasharray="4 8"
            className={pumpOn ? 'twin-pipe-flow' : undefined}
          />
        </g>
      ))}

      {NODES.map((node) => {
        const status = statusFor(node)
        const value = valueFor(node)
        const cx = node.x + node.w / 2
        const cy = node.y + node.h / 2
        const isSelected = selected === node.id
        return (
          <g
            key={node.id}
            role="button"
            tabIndex={0}
            aria-label={t(`twin.nodes.${node.id}`)}
            aria-pressed={isSelected}
            onClick={() => onSelect(node.id)}
            onKeyDown={(event) => handleKeyDown(event, node.id)}
            className="cursor-pointer outline-none"
          >
            {isSelected ? (
              <rect
                x={node.x - 3}
                y={node.y - 3}
                width={node.w + 6}
                height={node.h + 6}
                rx={2}
                fill="none"
                stroke="var(--color-foreground)"
                strokeWidth={2}
              />
            ) : null}
            <rect
              x={node.x}
              y={node.y}
              width={node.w}
              height={node.h}
              rx={2}
              fill={nodeFill(status)}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
            <text
              x={cx}
              y={value ? cy - 3 : cy + 4}
              textAnchor="middle"
              fontSize={12}
              fill={nodeTextColor(status)}
            >
              {t(`twin.nodes.${node.id}`)}
            </text>
            {value ? (
              <text
                x={cx}
                y={cy + 13}
                textAnchor="middle"
                fontSize={11}
                className="font-mono"
                fill={nodeTextColor(status)}
              >
                {value}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}
