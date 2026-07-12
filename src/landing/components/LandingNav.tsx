import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '@/frontend/auth/AuthProvider'
import { Button, LanguageSwitcher, Wordmark } from '@/shared/ui'

const navLink = 'text-sm text-muted transition-colors duration-150 hover:text-foreground'

export function LandingNav() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session } = useAuth()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <nav className="mx-auto flex h-16 w-full max-w-[1080px] items-center justify-between px-6">
        <Wordmark />
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="hidden items-center gap-6 md:flex">
            <a href="#features" className={navLink}>
              {t('landing.nav.features')}
            </a>
            <a href="#how" className={navLink}>
              {t('landing.nav.how')}
            </a>
          </div>
          <LanguageSwitcher />
          {session ? (
            <Button size="sm" onClick={() => navigate('/app')}>
              {t('landing.nav.openApp')}
            </Button>
          ) : (
            <>
              <Link to="/auth" className={`hidden sm:block ${navLink}`}>
                {t('landing.nav.signIn')}
              </Link>
              <Button size="sm" onClick={() => navigate('/auth')}>
                {t('landing.nav.getStarted')}
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
