import type { KeyboardEvent } from 'react'

import { cn } from '@/shared/lib/cn'

export type TabItem = {
  value: string
  label: string
}

export type TabsProps = {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
  'aria-label'?: string
}

export function Tabs({ items, value, onChange, className, 'aria-label': ariaLabel }: TabsProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const currentIndex = items.findIndex((item) => item.value === value)
    const step = event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (currentIndex + step + items.length) % items.length
    const next = items[nextIndex]
    if (!next) return
    onChange(next.value)
    const tabs = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs[nextIndex]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn('flex items-end gap-4 border-b border-border', className)}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              '-mb-px cursor-pointer border-b-2 px-1 pb-2 pt-1 text-sm transition-colors duration-150',
              'focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-foreground',
              active
                ? 'border-foreground font-medium text-foreground'
                : 'border-transparent text-muted hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
