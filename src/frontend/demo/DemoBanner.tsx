import { AlertCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { AuthErrorCode } from '@/backend'
import { convertAnonymousAccount } from '@/backend'
import { useAuth } from '@/frontend/auth/AuthProvider'
import { useSimulator } from '@/frontend/simulator/SimulatorProvider'
import {
  Button,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  FormField,
  Input,
  useDialog,
  useToast,
} from '@/shared/ui'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-sharp border border-border p-3 text-[13px] text-foreground">
      <AlertCircle size={16} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

export function DemoBanner() {
  const { t } = useTranslation()
  const { isAnonymous, refreshAuth } = useAuth()
  const { running, start } = useSimulator()
  const { toast } = useToast()
  const dialog = useDialog()

  // Demo visitors get the local simulator running on arrival, once.
  const autoStartedRef = useRef(false)
  useEffect(() => {
    if (isAnonymous && !autoStartedRef.current && !running) {
      autoStartedRef.current = true
      start()
    }
  }, [isAnonymous, running, start])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<AuthErrorCode | null>(null)
  const [pending, setPending] = useState(false)

  function reset() {
    setEmail('')
    setPassword('')
    setConfirm('')
    setEmailError(null)
    setPasswordError(null)
    setConfirmError(null)
    setServerError(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setServerError(null)
    const nextEmailError = EMAIL_PATTERN.test(email.trim()) ? null : 'auth.validation.email'
    const nextPasswordError = password.length >= 8 ? null : 'auth.validation.passwordLength'
    const nextConfirmError = password === confirm ? null : 'auth.validation.passwordMatch'
    setEmailError(nextEmailError)
    setPasswordError(nextPasswordError)
    setConfirmError(nextConfirmError)
    if (nextEmailError || nextPasswordError || nextConfirmError) return

    setPending(true)
    const result = await convertAnonymousAccount(email.trim(), password)
    setPending(false)
    if (result.ok) {
      toast(t('demo.convert.success'))
      dialog.close()
      reset()
      // Refresh the session so is_anonymous flips to false and this banner hides.
      await refreshAuth()
    } else {
      setServerError(result.code)
    }
  }

  if (!isAnonymous) return null

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2 sm:px-6 print:hidden">
        <span className="text-[13px] text-muted">{t('demo.banner.text')}</span>
        <Button size="sm" onClick={dialog.open}>
          {t('demo.banner.keep')}
        </Button>
      </div>

      <Dialog ref={dialog.ref} onClose={reset}>
        <form onSubmit={handleSubmit} noValidate>
          <DialogTitle>{t('demo.convert.title')}</DialogTitle>
          <DialogDescription>{t('demo.convert.description')}</DialogDescription>
          <div className="mt-4 flex flex-col gap-4">
            <FormField
              label={t('auth.fields.emailLabel')}
              htmlFor="demo-convert-email"
              error={emailError ? t(emailError) : undefined}
            >
              <Input
                id="demo-convert-email"
                type="email"
                autoComplete="email"
                value={email}
                invalid={Boolean(emailError)}
                placeholder={t('auth.fields.emailPlaceholder')}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>
            <FormField
              label={t('auth.fields.passwordLabel')}
              htmlFor="demo-convert-password"
              error={passwordError ? t(passwordError) : undefined}
            >
              <Input
                id="demo-convert-password"
                type="password"
                autoComplete="new-password"
                value={password}
                invalid={Boolean(passwordError)}
                placeholder={t('auth.fields.newPasswordPlaceholder')}
                onChange={(event) => setPassword(event.target.value)}
              />
            </FormField>
            <FormField
              label={t('auth.fields.confirmLabel')}
              htmlFor="demo-convert-confirm"
              error={confirmError ? t(confirmError) : undefined}
            >
              <Input
                id="demo-convert-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                invalid={Boolean(confirmError)}
                placeholder={t('auth.fields.confirmPlaceholder')}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </FormField>
            {serverError ? <Notice>{t(`auth.errors.${serverError}`)}</Notice> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                reset()
                dialog.close()
              }}
            >
              {t('demo.convert.cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t('demo.convert.pending') : t('demo.convert.submit')}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  )
}
