import { ChevronDown } from 'lucide-react'
import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/cn'

export type SelectProps = ComponentProps<'select'>

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className={cn('relative w-full', className)}>
      <select
        className={cn(
          'h-10 w-full cursor-pointer appearance-none rounded-sharp border border-border bg-background pl-3 pr-8 text-sm text-foreground transition-colors duration-150',
          'focus:border-foreground focus:outline-none',
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={1.5}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  )
}
