import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/frontend/auth/AuthProvider'
import { useFarm } from '@/frontend/farm/FarmProvider'
import { Button, FormField, Input, LanguageSwitcher, useToast, Wordmark } from '@/shared/ui'

export function OnboardingScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { createFarm, creating } = useFarm()
  const { signOut } = useAuth()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (name.trim().length === 0) {
      setError('app.farm.nameRequired')
      return
    }
    setError(null)
    const farm = await createFarm(name.trim())
    if (!farm) {
      toast(t('app.farm.createFailed'), { kind: 'critical' })
    }
    // On success the FarmProvider state updates and the shell replaces this screen.
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="absolute right-6 top-6 flex items-center gap-4">
        <LanguageSwitcher />
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          {t('auth.actions.signOut')}
        </Button>
      </div>

      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center gap-6 text-center">
          <Wordmark size="md" />
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {t('app.farm.onboardingTitle')}
            </h1>
            <p className="text-[13px] text-muted">{t('app.farm.onboardingDescription')}</p>
          </div>
        </div>

        <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
          <FormField
            label={t('app.farm.nameLabel')}
            htmlFor="onboarding-name"
            error={error ? t(error) : undefined}
          >
            <Input
              id="onboarding-name"
              value={name}
              invalid={Boolean(error)}
              placeholder={t('app.farm.namePlaceholder')}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>
          <Button type="submit" fullWidth disabled={creating}>
            {creating ? t('app.farm.creating') : t('app.farm.create')}
          </Button>
        </form>
      </div>
    </div>
  )
}
