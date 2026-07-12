import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'

import { AlertEngineProvider } from '@/frontend/alerts/AlertEngineProvider'
import { AlertsProvider } from '@/frontend/alerts/AlertsProvider'
import { LiveReadingsProvider } from '@/frontend/data/LiveReadingsProvider'
import { FarmProvider, useFarm } from '@/frontend/farm/FarmProvider'
import { OnboardingScreen } from '@/frontend/farm/OnboardingScreen'
import { SidebarContent } from '@/frontend/layout/SidebarContent'
import { SimulatorProvider } from '@/frontend/simulator/SimulatorProvider'
import { Skeleton, Wordmark } from '@/shared/ui'

const iconButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-sharp text-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-foreground'

function MobileBar() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4 md:hidden">
        <Link to="/app">
          <Wordmark size="sm" />
        </Link>
        <button
          type="button"
          aria-label={t('app.nav.openMenu')}
          onClick={() => setOpen(true)}
          className={iconButton}
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
            <Link to="/app" onClick={() => setOpen(false)}>
              <Wordmark size="sm" />
            </Link>
            <button
              type="button"
              aria-label={t('app.nav.closeMenu')}
              onClick={() => setOpen(false)}
              className={iconButton}
            >
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SidebarContent scope="mobile" onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  )
}

function LayoutSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-[232px] flex-col gap-6 border-r border-border p-4 md:flex">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-full" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      </aside>
      <div className="flex h-14 items-center border-b border-border px-4 md:hidden">
        <Skeleton className="h-5 w-28" />
      </div>
      <main className="md:pl-[232px]">
        <div className="mx-auto max-w-[1120px] p-6 md:p-8">
          <Skeleton className="h-8 w-48" />
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

function AppShell() {
  const { loading, farms } = useFarm()

  if (loading) return <LayoutSkeleton />
  if (farms.length === 0) return <OnboardingScreen />

  return (
    <SimulatorProvider>
      <LiveReadingsProvider>
        <AlertEngineProvider>
          <AlertsProvider>
            <div className="min-h-screen bg-background">
              <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-border bg-background md:flex">
                <SidebarContent scope="desktop" />
              </aside>

              <MobileBar />

              <main className="md:pl-[232px]">
                <div className="mx-auto max-w-[1120px] p-6 md:p-8">
                  <Outlet />
                </div>
              </main>
            </div>
          </AlertsProvider>
        </AlertEngineProvider>
      </LiveReadingsProvider>
    </SimulatorProvider>
  )
}

export default function AppLayout() {
  return (
    <FarmProvider>
      <AppShell />
    </FarmProvider>
  )
}
