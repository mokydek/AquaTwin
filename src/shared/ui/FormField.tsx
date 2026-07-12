import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'
import { FieldError } from '@/shared/ui/FieldError'
import { Label } from '@/shared/ui/Label'

export type FormFieldProps = {
  label: ReactNode
  htmlFor?: string
  error?: ReactNode
  children: ReactNode
  className?: string
}

export function FormField({ label, htmlFor, error, children, className }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  )
}
