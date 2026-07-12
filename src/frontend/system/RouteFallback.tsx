import { Skeleton } from '@/shared/ui'

// Minimal page frame shown while a lazy route loads, so navigation never flashes
// a blank white screen.
export function RouteFallback() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
