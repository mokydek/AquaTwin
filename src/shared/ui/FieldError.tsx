import { AlertCircle } from 'lucide-react'
import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/cn'

export type FieldErrorProps = ComponentProps<'p'>

export function FieldError({ className, children, ...props }: FieldErrorProps) {
  return (
    <p
      role="alert"
      className={cn('flex items-center gap-1.5 text-[13px] text-foreground', className)}
      {...props}
    >
      <AlertCircle size={14} strokeWidth={1.5} aria-hidden="true" />
      {children}
    </p>
  )
}
