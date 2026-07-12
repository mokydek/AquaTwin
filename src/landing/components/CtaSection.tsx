import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/shared/ui'

export function CtaSection() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <section className="bg-foreground text-background">
      <div className="mx-auto w-full max-w-[1080px] px-6 py-24 text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('landing.cta.title')}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-background/70">{t('landing.cta.body')}</p>
        <div className="mt-8 flex justify-center">
          <Button variant="secondary" size="md" onClick={() => navigate('/auth')}>
            {t('landing.cta.button')}
          </Button>
        </div>
      </div>
    </section>
  )
}
