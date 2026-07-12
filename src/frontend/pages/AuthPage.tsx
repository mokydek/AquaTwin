import { AlertCircle } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router-dom'

import type { AuthErrorCode } from '@/backend'
import { signInWithPassword, signUpWithPassword } from '@/backend'
import { useAuth } from '@/frontend/auth/AuthProvider'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { Button, FormField, Input, LanguageSwitcher, Tabs, Wordmark } from '@/shared/ui'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value)
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-sharp border border-border p-3 text-[13px] text-foreground">
      <AlertCircle size={16} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function SignInForm() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<AuthErrorCode | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setServerError(null)

    const nextEmailError = isValidEmail(email) ? null : 'auth.validation.email'
    const nextPasswordError = password.length > 0 ? null : 'auth.validation.passwordRequired'
    setEmailError(nextEmailError)
    setPasswordError(nextPasswordError)
    if (nextEmailError || nextPasswordError) return

    setPending(true)
    const result = await signInWithPassword(email, password)
    setPending(false)

    if (!result.ok) {
      setServerError(result.code)
      return
    }
    // On success the AuthProvider picks up the session and the page redirects.
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      <FormField
        label={t('auth.fields.emailLabel')}
        htmlFor="signin-email"
        error={emailError ? t(emailError) : undefined}
      >
        <Input
          id="signin-email"
          type="email"
          autoComplete="email"
          placeholder={t('auth.fields.emailPlaceholder')}
          value={email}
          invalid={Boolean(emailError)}
          onChange={(event) => setEmail(event.target.value)}
        />
      </FormField>

      <FormField
        label={t('auth.fields.passwordLabel')}
        htmlFor="signin-password"
        error={passwordError ? t(passwordError) : undefined}
      >
        <Input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          placeholder={t('auth.fields.passwordPlaceholder')}
          value={password}
          invalid={Boolean(passwordError)}
          onChange={(event) => setPassword(event.target.value)}
        />
      </FormField>

      {serverError ? <Notice>{t(`auth.errors.${serverError}`)}</Notice> : null}

      <Button type="submit" fullWidth disabled={pending}>
        {pending ? t('auth.actions.pending') : t('auth.actions.signIn')}
      </Button>
    </form>
  )
}

function SignUpForm() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<AuthErrorCode | null>(null)
  const [checkInbox, setCheckInbox] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setServerError(null)
    setCheckInbox(false)

    const nextEmailError = isValidEmail(email) ? null : 'auth.validation.email'
    const nextPasswordError = password.length >= 8 ? null : 'auth.validation.passwordLength'
    const nextConfirmError = password === confirm ? null : 'auth.validation.passwordMatch'
    setEmailError(nextEmailError)
    setPasswordError(nextPasswordError)
    setConfirmError(nextConfirmError)
    if (nextEmailError || nextPasswordError || nextConfirmError) return

    setPending(true)
    const result = await signUpWithPassword(email, password)
    setPending(false)

    if (!result.ok) {
      setServerError(result.code)
      return
    }
    // With an active session the AuthProvider redirects to /app. Without one
    // (email confirmation enabled), tell the user to confirm the address.
    if (!result.session) {
      setCheckInbox(true)
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      <FormField
        label={t('auth.fields.emailLabel')}
        htmlFor="signup-email"
        error={emailError ? t(emailError) : undefined}
      >
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          placeholder={t('auth.fields.emailPlaceholder')}
          value={email}
          invalid={Boolean(emailError)}
          onChange={(event) => setEmail(event.target.value)}
        />
      </FormField>

      <FormField
        label={t('auth.fields.passwordLabel')}
        htmlFor="signup-password"
        error={passwordError ? t(passwordError) : undefined}
      >
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          placeholder={t('auth.fields.newPasswordPlaceholder')}
          value={password}
          invalid={Boolean(passwordError)}
          onChange={(event) => setPassword(event.target.value)}
        />
      </FormField>

      <FormField
        label={t('auth.fields.confirmLabel')}
        htmlFor="signup-confirm"
        error={confirmError ? t(confirmError) : undefined}
      >
        <Input
          id="signup-confirm"
          type="password"
          autoComplete="new-password"
          placeholder={t('auth.fields.confirmPlaceholder')}
          value={confirm}
          invalid={Boolean(confirmError)}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </FormField>

      {serverError ? <Notice>{t(`auth.errors.${serverError}`)}</Notice> : null}
      {checkInbox ? <Notice>{t('auth.notice.checkInbox')}</Notice> : null}

      <Button type="submit" fullWidth disabled={pending}>
        {pending ? t('auth.actions.pending') : t('auth.actions.signUp')}
      </Button>
    </form>
  )
}

export default function AuthPage() {
  const { t } = useTranslation()
  usePageTitle(`${t('common.auth')} · ${t('app.name')}`)
  const { user, loading } = useAuth()
  const [tab, setTab] = useState('sign-in')

  if (loading) return null
  if (user) return <Navigate to="/app" replace />

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-[1080px] items-center justify-between px-6 py-6">
        <Link to="/">
          <Wordmark />
        </Link>
        <LanguageSwitcher />
      </div>

      <div className="flex flex-1 items-start justify-center px-6 pb-24 pt-10">
        <div className="w-full max-w-[400px]">
          <Tabs
            aria-label={t('auth.aria.tabs')}
            items={[
              { value: 'sign-in', label: t('auth.tabs.signIn') },
              { value: 'sign-up', label: t('auth.tabs.signUp') },
            ]}
            value={tab}
            onChange={setTab}
          />
          <div className="mt-8">{tab === 'sign-in' ? <SignInForm /> : <SignUpForm />}</div>
        </div>
      </div>
    </div>
  )
}
