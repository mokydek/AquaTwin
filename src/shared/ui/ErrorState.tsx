import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/Button'

export type ErrorStateProps = {
  title: ReactNode
  description?: ReactNode
  retryLabel?: ReactNode
  onRetry?: () => void
  className?: string
}

export function ErrorState({ title, description, retryLabel, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 py-12 text-center', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-sharp border border-border">
        <AlertTriangle size={24} strokeWidth={1.5} aria-hidden="true" className="text-muted" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="text-[13px] text-muted">{description}</p> : null}
      </div>
      {onRetry && retryLabel ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  )
}
