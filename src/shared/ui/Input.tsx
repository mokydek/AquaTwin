import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/cn'

export type InputProps = ComponentProps<'input'> & {
  invalid?: boolean
}

export function Input({ invalid, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        'h-10 w-full rounded-sharp border bg-background px-3 text-sm text-foreground transition-colors duration-150',
        'placeholder:text-muted focus:border-foreground focus:outline-none',
        invalid ? 'border-foreground' : 'border-border',
        className,
      )}
      {...props}
    />
  )
}
