import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/shared/ui'
import { LiveMetricsPanel } from '@/landing/components/LiveMetricsPanel'

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView()
}

export function Hero() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <section className="border-b border-border">
      <div className="mx-auto grid w-full max-w-[1080px] items-center gap-12 px-6 py-20 sm:py-24 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <span className="text-[11px] uppercase tracking-wider text-muted">
            {t('landing.hero.label')}
          </span>
          <h1 className="text-[2.5rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.5rem]">
            {t('landing.hero.title')}
          </h1>
          <p className="max-w-xl text-base text-muted sm:text-lg">{t('landing.hero.subtitle')}</p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <Button size="md" onClick={() => navigate('/auth')}>
                {t('landing.hero.getStarted')}
              </Button>
              <Button variant="secondary" size="md" onClick={() => navigate('/demo')}>
                {t('landing.hero.tryDemo')}
              </Button>
            </div>
            <button
              type="button"
              onClick={() => scrollToId('how')}
              className="self-start text-sm text-muted transition-colors duration-150 hover:text-foreground"
            >
              {t('landing.hero.seeHow')}
            </button>
          </div>
        </div>
        <LiveMetricsPanel />
      </div>
    </section>
  )
}
