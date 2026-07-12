import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'

import { ProtectedRoute } from '@/frontend/auth/ProtectedRoute'

const LandingPage = lazy(() => import('@/landing/pages/LandingPage'))
const AuthPage = lazy(() => import('@/frontend/pages/AuthPage'))
const AppLayout = lazy(() => import('@/frontend/layout/AppLayout'))
const OverviewPage = lazy(() => import('@/frontend/pages/OverviewPage'))
const StubPage = lazy(() => import('@/frontend/pages/StubPage'))
const UiKitPage = lazy(() => import('@/frontend/pages/UiKitPage'))
const NotFound = lazy(() => import('@/shared/ui/NotFound'))

function suspended(node: ReactNode) {
  return <Suspense fallback={null}>{node}</Suspense>
}

export const router = createBrowserRouter([
  { path: '/', element: suspended(<LandingPage />) },
  { path: '/auth', element: suspended(<AuthPage />) },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/app',
        element: suspended(<AppLayout />),
        children: [
          { index: true, element: suspended(<OverviewPage />) },
          { path: 'twin', element: suspended(<StubPage section="twin" />) },
          { path: 'alerts', element: suspended(<StubPage section="alerts" />) },
          { path: 'automation', element: suspended(<StubPage section="automation" />) },
          { path: 'settings', element: suspended(<StubPage section="settings" />) },
        ],
      },
    ],
  },
  { path: '/ui', element: suspended(<UiKitPage />) },
  { path: '*', element: suspended(<NotFound />) },
])
