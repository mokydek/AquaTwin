import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

import { cn } from '@/shared/lib/cn'

export type StatDeltaDirection = 'up' | 'down' | 'flat'

export type StatProps = {
  label: string
  value: string | number
  unit?: string
  delta?: {
    value: string
    direction: StatDeltaDirection
  }
  className?: string
}

const deltaIcons = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
} as const

export function Stat({ label, value, unit, delta, className }: StatProps) {
  const DeltaIcon = delta ? deltaIcons[delta.direction] : null

  return (
    <div className={cn('flex flex-col items-start gap-1.5', className)}>
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className="font-mono text-[28px] font-medium leading-none tracking-tight text-foreground tabular-nums">
          {value}
        </span>
        {unit ? <span className="font-mono text-sm text-muted">{unit}</span> : null}
      </span>
      {delta && DeltaIcon ? (
        <span className="flex items-center gap-1 font-mono text-xs text-muted tabular-nums">
          <DeltaIcon size={14} strokeWidth={1.5} aria-hidden="true" />
          {delta.value}
        </span>
      ) : null}
    </div>
  )
}
