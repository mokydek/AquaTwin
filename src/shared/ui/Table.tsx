import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/cn'

export type TableProps = ComponentProps<'table'>

export function Table({ className, children, ...props }: TableProps) {
  return (
    <table className={cn('w-full border-collapse text-left text-sm', className)} {...props}>
      {children}
    </table>
  )
}

export type THeadProps = ComponentProps<'thead'>

export function THead({ className, children, ...props }: THeadProps) {
  return (
    <thead className={className} {...props}>
      {children}
    </thead>
  )
}

export type TBodyProps = ComponentProps<'tbody'>

export function TBody({ className, children, ...props }: TBodyProps) {
  return (
    <tbody
      className={cn('[&>tr]:transition-colors [&>tr]:duration-150 [&>tr:hover]:bg-surface', className)}
      {...props}
    >
      {children}
    </tbody>
  )
}

export type TrProps = ComponentProps<'tr'>

export function Tr({ className, children, ...props }: TrProps) {
  return (
    <tr className={cn('border-b border-border', className)} {...props}>
      {children}
    </tr>
  )
}

export type ThProps = ComponentProps<'th'>

export function Th({ className, children, ...props }: ThProps) {
  return (
    <th
      className={cn('px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted', className)}
      {...props}
    >
      {children}
    </th>
  )
}

export type TdProps = ComponentProps<'td'> & {
  numeric?: boolean
}

export function Td({ numeric, className, children, ...props }: TdProps) {
  return (
    <td
      className={cn(
        'px-4 py-3 text-foreground',
        numeric && 'text-right font-mono tabular-nums',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  )
}
