import { useEffect, useId, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { Thresholds } from '@/shared/config/aquaponics'
import { computeStatus } from '@/shared/lib/status'

export type LineChartPoint = {
  t: number
  value: number
}

export type LineChartProps = {
  points: LineChartPoint[]
  thresholds: Thresholds
  unit: string
  decimals: number
  timeWindowMs: number
  height?: number
}

const PAD = { top: 12, right: 44, bottom: 14, left: 10 }

function formatClock(ms: number): string {
  const date = new Date(ms)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

type ThresholdLine = { value: number; kind: 'warn' | 'crit' }

function visibleThresholds(thresholds: Thresholds): ThresholdLine[] {
  const lines: ThresholdLine[] = []
  if (thresholds.warnLow !== null) lines.push({ value: thresholds.warnLow, kind: 'warn' })
  if (thresholds.warnHigh !== null) lines.push({ value: thresholds.warnHigh, kind: 'warn' })
  if (thresholds.critLow !== null) lines.push({ value: thresholds.critLow, kind: 'crit' })
  if (thresholds.critHigh !== null) lines.push({ value: thresholds.critHigh, kind: 'crit' })
  return lines
}

export function LineChart({
  points,
  thresholds,
  unit,
  decimals,
  timeWindowMs,
  height = 180,
}: LineChartProps) {
  const { t } = useTranslation()
  const clipId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [width, setWidth] = useState(0)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  useEffect(() => {
    const element = wrapperRef.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const isEmpty = points.length === 0

  if (isEmpty) {
    return (
      <div ref={wrapperRef} style={{ height }} className="flex w-full items-center justify-center">
        <span className="text-xs text-muted">{t('common.noData')}</span>
      </div>
    )
  }

  if (width === 0) {
    return <div ref={wrapperRef} style={{ height }} className="w-full" />
  }

  const now = Date.now()
  const tMax = now
  const tMin = now - timeWindowMs
  const innerW = Math.max(1, width - PAD.left - PAD.right)
  const innerH = Math.max(1, height - PAD.top - PAD.bottom)

  const thresholdLines = visibleThresholds(thresholds)
  let yMin = Math.min(...points.map((p) => p.value))
  let yMax = Math.max(...points.map((p) => p.value))
  for (const line of thresholdLines) {
    yMin = Math.min(yMin, line.value)
    yMax = Math.max(yMax, line.value)
  }
  if (yMin === yMax) {
    yMin -= 1
    yMax += 1
  }
  const yPad = (yMax - yMin) * 0.08
  yMin -= yPad
  yMax += yPad

  const xScale = (time: number) => PAD.left + ((time - tMin) / (tMax - tMin)) * innerW
  const yScale = (value: number) => PAD.top + (1 - (value - yMin) / (yMax - yMin)) * innerH

  const polyline = points.map((p) => `${xScale(p.t)},${yScale(p.value)}`).join(' ')
  const last = points[points.length - 1]
  const gridValues = [yMax, (yMin + yMax) / 2, yMin]

  const hovered = hoverIndex !== null ? points[hoverIndex] : null
  const tooltipWidth = 66
  const tooltipHeight = 32

  function handleMove(event: ReactPointerEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = event.clientX - rect.left
    let nearest = 0
    let best = Number.POSITIVE_INFINITY
    for (let i = 0; i < points.length; i += 1) {
      const distance = Math.abs(xScale(points[i].t) - px)
      if (distance < best) {
        best = distance
        nearest = i
      }
    }
    setHoverIndex(nearest)
  }

  const tooltipX = hovered
    ? Math.min(Math.max(xScale(hovered.t) + 6, PAD.left), width - PAD.right - tooltipWidth)
    : 0

  const latestValue = last.value
  const latestStatus = computeStatus(latestValue, thresholds)
  const ariaLabel = t('system.chartSummary', {
    value: latestValue.toFixed(decimals),
    unit,
    status: t(`app.status.${latestStatus}`),
  })

  return (
    <div ref={wrapperRef} style={{ height }} className="w-full">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        className="block touch-none select-none"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} />
          </clipPath>
        </defs>

        {gridValues.map((value, index) => {
          const y = yScale(value)
          return (
            <g key={`grid-${index}`}>
              <line
                x1={PAD.left}
                y1={y}
                x2={width - PAD.right}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth={1}
              />
              <text
                x={PAD.left}
                y={y - 3}
                fontSize={10}
                className="font-mono"
                fill="var(--color-muted)"
              >
                {value.toFixed(decimals)}
              </text>
            </g>
          )
        })}

        {thresholdLines.map((line, index) => {
          if (line.value < yMin || line.value > yMax) return null
          const y = yScale(line.value)
          const stroke = line.kind === 'crit' ? 'var(--color-foreground)' : 'var(--color-border)'
          return (
            <g key={`threshold-${index}`}>
              <line
                x1={PAD.left}
                y1={y}
                x2={width - PAD.right}
                y2={y}
                stroke={stroke}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={width - PAD.right + 3}
                y={y + 3}
                fontSize={9}
                className="font-mono"
                fill={line.kind === 'crit' ? 'var(--color-foreground)' : 'var(--color-muted)'}
              >
                {line.value.toFixed(decimals)}
              </text>
            </g>
          )
        })}

        <g clipPath={`url(#${clipId})`}>
          <polyline
            points={polyline}
            fill="none"
            stroke="var(--color-foreground)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>

        <rect
          x={xScale(last.t) - 1.5}
          y={yScale(last.value) - 1.5}
          width={3}
          height={3}
          fill="var(--color-foreground)"
        />

        {hovered ? (
          <g>
            <line
              x1={xScale(hovered.t)}
              y1={PAD.top}
              x2={xScale(hovered.t)}
              y2={PAD.top + innerH}
              stroke="var(--color-muted)"
              strokeWidth={1}
            />
            <rect
              x={tooltipX}
              y={PAD.top}
              width={tooltipWidth}
              height={tooltipHeight}
              rx={2}
              fill="var(--color-background)"
              stroke="var(--color-border)"
              strokeWidth={1}
            />
            <text
              x={tooltipX + 6}
              y={PAD.top + 13}
              fontSize={10}
              className="font-mono"
              fill="var(--color-foreground)"
            >
              {hovered.value.toFixed(decimals)} {unit}
            </text>
            <text
              x={tooltipX + 6}
              y={PAD.top + 25}
              fontSize={9}
              className="font-mono"
              fill="var(--color-muted)"
            >
              {formatClock(hovered.t)}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  )
}
