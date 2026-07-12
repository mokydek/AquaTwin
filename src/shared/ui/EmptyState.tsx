import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/shared/lib/cn'

export type EmptyStateProps = {
  icon: LucideIcon
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 py-12 text-center', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-sharp border border-border">
        <Icon size={24} strokeWidth={1.5} aria-hidden="true" className="text-muted" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="text-[13px] text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
