import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import type { DemoStage } from '@/backend'
import { setupDemoFarm, signInAnonymously } from '@/backend'
import { useAuth } from '@/frontend/auth/AuthProvider'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { ErrorState, Wordmark } from '@/shared/ui'

export default function DemoPage() {
  const { t } = useTranslation()
  usePageTitle(`${t('demo.title')} · ${t('app.name')}`)
  const navigate = useNavigate()
  const { user, isAnonymous, loading } = useAuth()

  const [stage, setStage] = useState<DemoStage>('farm')
  const [progress, setProgress] = useState(0.05)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const startedRef = useRef(false)

  useEffect(() => {
    if (loading) return
    // A permanent account skips the demo bootstrap and goes to the app.
    if (user && !isAnonymous) {
      navigate('/app', { replace: true })
      return
    }
    // Run the bootstrap exactly once. We deliberately do NOT cancel on cleanup:
    // signInAnonymously updates the auth state (an effect dependency), which
    // re-runs this effect mid flight; the startedRef guard swallows the re-run so
    // the single in flight run always reaches its navigate. State updates after a
    // possible unmount are safe no ops in React 19.
    if (startedRef.current) return
    startedRef.current = true

    const content = {
      farmName: t('demo.farmName'),
      nodeLabels: {
        fish_tank: t('twin.nodes.fish_tank'),
        grow_bed: t('twin.nodes.grow_bed'),
        biofilter: t('twin.nodes.biofilter'),
        sump: t('twin.nodes.sump'),
        pump: t('twin.nodes.pump'),
      },
      oxygenRuleName: t('automation.presets.lowOxygenName'),
      tempRuleName: t('automation.presets.lowTempName'),
    }

    void (async () => {
      try {
        // Sign in anonymously only if there is no session at all.
        if (!user) {
          const result = await signInAnonymously()
          if (!result.ok) throw new Error('sign in failed')
        }
        await setupDemoFarm(content, (update) => {
          setStage(update.stage)
          setProgress(update.progress)
        })
        navigate('/app', { replace: true })
      } catch {
        setFailed(true)
        startedRef.current = false
      }
    })()
  }, [loading, user, isAnonymous, navigate, t, attempt])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <Wordmark size="md" />
        {failed ? (
          <ErrorState
            title={t('demo.entry.error')}
            retryLabel={t('demo.entry.retry')}
            onRetry={() => {
              setFailed(false)
              setProgress(0.05)
              setStage('farm')
              setAttempt((value) => value + 1)
            }}
          />
        ) : (
          <div className="flex w-full flex-col gap-4">
            <p className="text-sm text-muted" aria-live="polite">
              {t(`demo.entry.${stage === 'done' ? 'sensors' : stage}`)}
            </p>
            <div className="h-0.5 w-full bg-border" role="progressbar" aria-valuenow={Math.round(progress * 100)}>
              <div
                className="h-full bg-foreground transition-all duration-500"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
