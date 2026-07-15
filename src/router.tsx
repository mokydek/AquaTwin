import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'

import { ProtectedRoute } from '@/frontend/auth/ProtectedRoute'
import { RouteFallback } from '@/frontend/system/RouteFallback'

const LandingPage = lazy(() => import('@/landing/pages/LandingPage'))
const AuthPage = lazy(() => import('@/frontend/pages/AuthPage'))
const DemoPage = lazy(() => import('@/frontend/pages/DemoPage'))
const AppLayout = lazy(() => import('@/frontend/layout/AppLayout'))
const DashboardPage = lazy(() => import('@/frontend/pages/DashboardPage'))
const LivestockPage = lazy(() => import('@/frontend/pages/LivestockPage'))
const AlertsPage = lazy(() => import('@/frontend/pages/AlertsPage'))
const TwinPage = lazy(() => import('@/frontend/pages/TwinPage'))
const AutomationPage = lazy(() => import('@/frontend/pages/AutomationPage'))
const ReportsPage = lazy(() => import('@/frontend/pages/ReportsPage'))
const SettingsPage = lazy(() => import('@/frontend/pages/SettingsPage'))
const UiKitPage = lazy(() => import('@/frontend/pages/UiKitPage'))
const NotFound = lazy(() => import('@/shared/ui/NotFound'))

function suspended(node: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{node}</Suspense>
}

export const router = createBrowserRouter([
  { path: '/', element: suspended(<LandingPage />) },
  { path: '/auth', element: suspended(<AuthPage />) },
  { path: '/demo', element: suspended(<DemoPage />) },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/app',
        element: suspended(<AppLayout />),
        children: [
          { index: true, element: suspended(<DashboardPage />) },
          { path: 'livestock', element: suspended(<LivestockPage />) },
          { path: 'twin', element: suspended(<TwinPage />) },
          { path: 'alerts', element: suspended(<AlertsPage />) },
          { path: 'automation', element: suspended(<AutomationPage />) },
          { path: 'reports', element: suspended(<ReportsPage />) },
          { path: 'settings', element: suspended(<SettingsPage />) },
        ],
      },
    ],
  },
  { path: '/ui', element: suspended(<UiKitPage />) },
  { path: '*', element: suspended(<NotFound />) },
])
