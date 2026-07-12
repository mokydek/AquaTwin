import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/cn'

export type TextareaProps = ComponentProps<'textarea'> & {
  invalid?: boolean
}

export function Textarea({ invalid, className, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        'min-h-20 w-full rounded-sharp border bg-background px-3 py-2 text-sm text-foreground transition-colors duration-150',
        'placeholder:text-muted focus:border-foreground focus:outline-none',
        invalid ? 'border-foreground' : 'border-border',
        className,
      )}
      {...props}
    />
  )
}
