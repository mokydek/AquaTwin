import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/cn'

export type SkeletonProps = ComponentProps<'div'>

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div aria-hidden="true" className={cn('animate-pulse rounded-sharp bg-border', className)} {...props} />
  )
}
