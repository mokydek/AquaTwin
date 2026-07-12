import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/cn'

export type LabelProps = ComponentProps<'label'>

export function Label({ className, children, ...props }: LabelProps) {
  return (
    <label
      className={cn('text-[11px] uppercase tracking-wider text-muted', className)}
      {...props}
    >
      {children}
    </label>
  )
}
