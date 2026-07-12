import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'

import { supabase } from '@/backend/client'

// Re-exported so the rest of the app can type sessions and users without
// importing @supabase/supabase-js directly (only src/backend may do that).
export type { Session, User } from '@supabase/supabase-js'

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'user_already_exists'
  | 'weak_password'
  | 'rate_limited'
  | 'network'
  | 'unknown'

// Discriminated results: expected failures are values, not thrown exceptions.
export type AuthResult =
  | { ok: true; session: Session | null; user: User | null }
  | { ok: false; code: AuthErrorCode }

export type SignOutResult = { ok: true } | { ok: false; code: AuthErrorCode }

function toAuthErrorCode(error: unknown): AuthErrorCode {
  if (!error || typeof error !== 'object') return 'unknown'
  const e = error as { code?: string; message?: string; status?: number; name?: string }
  const code = e.code ?? ''
  const message = (e.message ?? '').toLowerCase()
  const status = e.status ?? 0
  const name = e.name ?? ''

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'invalid_credentials'
  }
  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    message.includes('already registered') ||
    message.includes('already been registered')
  ) {
    return 'user_already_exists'
  }
  if (code === 'weak_password' || message.includes('password should be')) {
    return 'weak_password'
  }
  if (
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit' ||
    status === 429 ||
    message.includes('rate limit')
  ) {
    return 'rate_limited'
  }
  if (
    name === 'AuthRetryableFetchError' ||
    message.includes('failed to fetch') ||
    message.includes('network')
  ) {
    return 'network'
  }
  return 'unknown'
}

export async function signUpWithPassword(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { ok: false, code: toAuthErrorCode(error) }
    return { ok: true, session: data.session, user: data.user }
  } catch (error) {
    return { ok: false, code: toAuthErrorCode(error) }
  }
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { ok: false, code: toAuthErrorCode(error) }
    return { ok: true, session: data.session, user: data.user }
  } catch (error) {
    return { ok: false, code: toAuthErrorCode(error) }
  }
}

export async function signOut(): Promise<SignOutResult> {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) return { ok: false, code: toAuthErrorCode(error) }
    return { ok: true }
  } catch (error) {
    return { ok: false, code: toAuthErrorCode(error) }
  }
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function subscribeToAuth(callback: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session) => {
    callback(session)
  })
  return () => data.subscription.unsubscribe()
}
