import { cn } from '@/shared/lib/cn'

export type SwitchProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  className?: string
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  className,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative h-5 w-9 cursor-pointer rounded-sharp border transition-colors duration-150',
        'focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
        checked ? 'border-foreground bg-foreground' : 'border-border bg-background',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-[1px] top-[1px] block h-4 w-4 rounded-sharp bg-background transition-transform duration-150',
          checked ? 'translate-x-4' : 'translate-x-0 border border-border',
        )}
      />
    </button>
  )
}
