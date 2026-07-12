import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { LanguageSwitcher, Wordmark } from '@/shared/ui'

const navLink = 'text-sm text-muted transition-colors duration-150 hover:text-foreground'

export function LandingFooter() {
  const { t } = useTranslation()

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-[1080px] flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <Wordmark size="sm" />
          <span className="text-[13px] text-muted">{t('landing.footer.copyright')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <a href="#features" className={navLink}>
            {t('landing.nav.features')}
          </a>
          <a href="#how" className={navLink}>
            {t('landing.nav.how')}
          </a>
          <Link to="/auth" className={navLink}>
            {t('landing.nav.signIn')}
          </Link>
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  )
}
