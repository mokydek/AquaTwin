import type { Thresholds } from '@/shared/config/aquaponics'
import type { BadgeVariant } from '@/shared/ui/Badge'

export type Status = 'ok' | 'warning' | 'critical'

// The single source of truth for status across the product. Critical wins.
export function computeStatus(value: number, thresholds: Thresholds): Status {
  const { warnLow, warnHigh, critLow, critHigh } = thresholds
  if ((critLow !== null && value < critLow) || (critHigh !== null && value > critHigh)) {
    return 'critical'
  }
  if ((warnLow !== null && value < warnLow) || (warnHigh !== null && value > warnHigh)) {
    return 'warning'
  }
  return 'ok'
}

const STATUS_BADGE: Record<Status, BadgeVariant> = {
  ok: 'ok',
  warning: 'warning',
  critical: 'critical',
}

export function statusToBadgeVariant(status: Status): BadgeVariant {
  return STATUS_BADGE[status]
}
