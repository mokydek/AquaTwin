import type { ComponentProps } from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/shared/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'md' | 'sm'

export type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: LucideIcon
  rightIcon?: LucideIcon
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-foreground text-background hover:bg-foreground/85',
  secondary: 'border border-border bg-background text-foreground hover:bg-surface',
  ghost: 'text-muted hover:text-foreground',
}

const sizeClasses: Record<ButtonSize, string> = {
  md: 'h-10 px-4 text-sm',
  sm: 'h-8 px-3 text-[13px]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  fullWidth,
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-sharp font-medium transition-colors duration-150',
        'focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {LeftIcon ? <LeftIcon size={16} strokeWidth={1.5} /> : null}
      {children}
      {RightIcon ? <RightIcon size={16} strokeWidth={1.5} /> : null}
    </button>
  )
}
