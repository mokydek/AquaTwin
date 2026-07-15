import { useId } from 'react'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { Device, FarmNode, Sensor } from '@/backend'
import { useLiveReadings } from '@/frontend/data/LiveReadingsProvider'
import { useLayout } from '@/frontend/twin/LayoutProvider'
import {
  CANVAS_H,
  CANVAS_W,
  FALLBACK_SENSORS,
  FALLBACK_VALUE_SENSOR,
  NODE_H,
  NODE_W,
} from '@/frontend/twin/nodeConfig'
import type { SensorType, Thresholds } from '@/shared/config/aquaponics'
import { SENSOR_TYPES } from '@/shared/config/aquaponics'
import { computeStatus } from '@/shared/lib/status'
import type { Status } from '@/shared/lib/status'

type NodeStatus = Status | 'neutral'

function rank(status: Status): number {
  return status === 'critical' ? 2 : status === 'warning' ? 1 : 0
}

function worstOf(types: SensorType[], latest: Map<SensorType, number>, getThresholds: (t: SensorType) => Thresholds): NodeStatus {
  let worst: Status | null = null
  for (const type of types) {
    const value = latest.get(type)
    if (value === undefined) continue
    const status = computeStatus(value, getThresholds(type))
    if (worst === null || rank(status) > rank(worst)) worst = status
  }
  return worst ?? 'neutral'
}

function formatSensorValue(type: SensorType, latest: Map<SensorType, number>): string {
  const value = latest.get(type)
  if (value === undefined) return '—'
  const config = SENSOR_TYPES[type]
  return `${value.toFixed(config.decimals)} ${config.unit}`
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

function boundaryPoint(cx: number, cy: number, dx: number, dy: number): { x: number; y: number } {
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const scaleX = dx !== 0 ? NODE_W / 2 / Math.abs(dx) : Number.POSITIVE_INFINITY
  const scaleY = dy !== 0 ? NODE_H / 2 / Math.abs(dy) : Number.POSITIVE_INFINITY
  const scale = Math.min(scaleX, scaleY)
  return { x: cx + dx * scale, y: cy + dy * scale }
}

export type SchematicProps = {
  devices: Device[]
  selected: string | null
  onSelect: (id: string) => void
}

export function Schematic({ devices, selected, onSelect }: SchematicProps) {
  const { t } = useTranslation()
  const { nodes, edges } = useLayout()
  const { latest, getThresholds, sensors } = useLiveReadings()
  const arrowId = useId()

  const pumpOn = devices.find((device) => device.type === 'main_pump')?.is_on ?? false
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  function statusAndValue(node: FarmNode): { status: NodeStatus; value: string | null } {
    if (node.type === 'pump') {
      return { status: pumpOn ? 'ok' : 'warning', value: pumpOn ? t('app.overview.on') : t('app.overview.off') }
    }
    const assigned = sensors.filter((sensor: Sensor) => sensor.node_id === node.id)
    if (assigned.length > 0) {
      const status = worstOf(assigned.map((s) => s.type), latest, getThresholds)
      return { status, value: formatSensorValue(assigned[0].type, latest) }
    }
    if (node.type === 'sump') return { status: 'neutral', value: null }
    const status = worstOf(FALLBACK_SENSORS[node.type], latest, getThresholds)
    const valueSensor = FALLBACK_VALUE_SENSOR[node.type]
    return { status, value: valueSensor ? formatSensorValue(valueSensor, latest) : null }
  }

  function handleKeyDown(event: KeyboardEvent<SVGGElement>, id: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(id)
    }
  }

  return (
    <svg
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      className="h-auto w-full"
      role="group"
      aria-label={t('twin.tabs.schematic')}
    >
      <defs>
        <marker id={arrowId} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill="var(--color-foreground)" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const source = nodeById.get(edge.source_node)
        const target = nodeById.get(edge.target_node)
        if (!source || !target) return null
        const sc = { x: source.x + NODE_W / 2, y: source.y + NODE_H / 2 }
        const tc = { x: target.x + NODE_W / 2, y: target.y + NODE_H / 2 }
        const dx = tc.x - sc.x
        const dy = tc.y - sc.y
        const start = boundaryPoint(sc.x, sc.y, dx, dy)
        const end = boundaryPoint(tc.x, tc.y, -dx, -dy)
        return (
          <g key={edge.id}>
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="var(--color-border)"
              strokeWidth={1.5}
              markerEnd={`url(#${arrowId})`}
            />
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="var(--color-foreground)"
              strokeWidth={1.5}
              strokeDasharray="4 8"
              className={pumpOn ? 'twin-pipe-flow' : undefined}
            />
          </g>
        )
      })}

      {nodes.map((node) => {
        const { status, value } = statusAndValue(node)
        const cx = node.x + NODE_W / 2
        const cy = node.y + NODE_H / 2
        const isSelected = selected === node.id
        return (
          <g
            key={node.id}
            role="button"
            tabIndex={0}
            aria-label={node.label}
            aria-pressed={isSelected}
            onClick={() => onSelect(node.id)}
            onKeyDown={(event) => handleKeyDown(event, node.id)}
            className="cursor-pointer outline-none"
          >
            {isSelected ? (
              <rect
                x={node.x - 3}
                y={node.y - 3}
                width={NODE_W + 6}
                height={NODE_H + 6}
                rx={2}
                fill="none"
                stroke="var(--color-foreground)"
                strokeWidth={2}
              />
            ) : null}
            <rect
              x={node.x}
              y={node.y}
              width={NODE_W}
              height={NODE_H}
              rx={2}
              fill={nodeFill(status)}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
            <text x={cx} y={value ? cy - 3 : cy + 4} textAnchor="middle" fontSize={12} fill={nodeTextColor(status)}>
              {node.label}
            </text>
            {value ? (
              <text x={cx} y={cy + 13} textAnchor="middle" fontSize={11} className="font-mono" fill={nodeTextColor(status)}>
                {value}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}
