import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export default function NotFound() {
  const { t } = useTranslation()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
      <p className="font-mono text-7xl font-semibold text-foreground">404</p>
      <Link to="/" className="text-foreground underline">
        {t('common.landing')}
      </Link>
    </main>
  )
}
