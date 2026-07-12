import { useCallback, useRef } from 'react'
import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/cn'

export function useDialog() {
  const ref = useRef<HTMLDialogElement>(null)
  const open = useCallback(() => {
    ref.current?.showModal()
  }, [])
  const close = useCallback(() => {
    ref.current?.close()
  }, [])
  return { ref, open, close }
}

export type DialogProps = ComponentProps<'dialog'>

export function Dialog({ className, children, ...props }: DialogProps) {
  return (
    <dialog
      className={cn(
        'm-auto w-full max-w-[440px] rounded-sharp border border-border bg-background p-6 text-foreground',
        'backdrop:bg-foreground/40',
        className,
      )}
      {...props}
    >
      {children}
    </dialog>
  )
}

export type DialogTitleProps = ComponentProps<'h2'>

export function DialogTitle({ className, children, ...props }: DialogTitleProps) {
  return (
    <h2 className={cn('text-base font-semibold tracking-tight text-foreground', className)} {...props}>
      {children}
    </h2>
  )
}

export type DialogDescriptionProps = ComponentProps<'p'>

export function DialogDescription({ className, children, ...props }: DialogDescriptionProps) {
  return (
    <p className={cn('mt-1.5 text-[13px] text-muted', className)} {...props}>
      {children}
    </p>
  )
}

export type DialogFooterProps = ComponentProps<'div'>

export function DialogFooter({ className, children, ...props }: DialogFooterProps) {
  return (
    <div className={cn('mt-6 flex items-center justify-end gap-2', className)} {...props}>
      {children}
    </div>
  )
}
