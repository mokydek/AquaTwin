import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { usePageTitle } from '@/shared/lib/usePageTitle'
import { Wordmark } from '@/shared/ui/Wordmark'

export default function NotFound() {
  const { t } = useTranslation()
  usePageTitle(`${t('system.notFoundTitle')} · ${t('app.name')}`)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <Wordmark size="md" />
      <p className="font-mono text-7xl font-semibold tracking-tight text-foreground">404</p>
      <p className="text-[13px] text-muted">{t('system.notFoundBody')}</p>
      <Link to="/" className="text-foreground underline">
        {t('system.backHome')}
      </Link>
    </main>
  )
}
