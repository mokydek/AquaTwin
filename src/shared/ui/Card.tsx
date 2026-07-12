import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'

export type CardProps = ComponentProps<'div'>

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div className={cn('rounded-sharp border border-border bg-background', className)} {...props}>
      {children}
    </div>
  )
}

export type CardHeaderProps = {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

export function CardHeader({ title, description, actions, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 p-4', className)}>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description ? <p className="text-[13px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export type CardContentProps = ComponentProps<'div'>

export function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div className={cn('px-4 pb-4', className)} {...props}>
      {children}
    </div>
  )
}

export type CardFooterProps = ComponentProps<'div'>

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div
      className={cn('flex items-center gap-2 border-t border-border bg-surface px-4 py-3', className)}
      {...props}
    >
      {children}
    </div>
  )
}
