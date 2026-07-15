import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type { Session, User } from '@/backend'
import { getSession, signOut as backendSignOut, subscribeToAuth } from '@/backend'

type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  // True when signed in as a Supabase anonymous user (the public demo).
  isAnonymous: boolean
  signOut: () => Promise<void>
  // Re-reads the session, e.g. right after converting an anonymous account so
  // the demo banner disappears immediately.
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    void getSession().then((current) => {
      if (!active) return
      setSession(current)
      setLoading(false)
    })

    const unsubscribe = subscribeToAuth((current) => {
      setSession(current)
      setLoading(false)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      isAnonymous: session?.user?.is_anonymous === true,
      signOut: async () => {
        await backendSignOut()
        setSession(null)
      },
      refreshAuth: async () => {
        const current = await getSession()
        setSession(current)
      },
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
