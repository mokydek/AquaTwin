import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '@/frontend/auth/AuthProvider'

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  // Wait for the session check before deciding, so we never flash the wrong screen.
  if (loading) return null
  if (!user) return <Navigate to="/auth" replace />
  return <Outlet />
}
