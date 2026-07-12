import type { ComponentProps } from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/shared/lib/cn'

export type BadgeVariant = 'neutral' | 'ok' | 'warning' | 'critical'

export type BadgeProps = ComponentProps<'span'> & {
  variant?: BadgeVariant
  icon?: LucideIcon
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'border-border text-muted',
  ok: 'border-border text-foreground',
  warning: 'border-border bg-border text-foreground',
  critical: 'border-foreground bg-foreground text-background',
}

export function Badge({ variant = 'neutral', icon: Icon, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sharp border px-2 py-1 text-[11px] uppercase tracking-wider',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {Icon ? <Icon size={12} strokeWidth={1.5} aria-hidden="true" /> : null}
      {children}
    </span>
  )
}
