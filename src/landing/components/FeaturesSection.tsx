import { Activity, Bell, FlaskConical, Workflow } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/shared/ui'

type Feature = {
  icon: LucideIcon
  title: string
  body: string
}

const FEATURES: Feature[] = [
  { icon: Activity, title: 'landing.features.monitoringTitle', body: 'landing.features.monitoringBody' },
  { icon: Bell, title: 'landing.features.alertsTitle', body: 'landing.features.alertsBody' },
  {
    icon: FlaskConical,
    title: 'landing.features.simulationTitle',
    body: 'landing.features.simulationBody',
  },
  {
    icon: Workflow,
    title: 'landing.features.automationTitle',
    body: 'landing.features.automationBody',
  },
]

export function FeaturesSection() {
  const { t } = useTranslation()

  return (
    <section id="features" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto w-full max-w-[1080px] px-6 py-20 sm:py-24">
        <span className="text-[11px] uppercase tracking-wider text-muted">
          {t('landing.features.label')}
        </span>
        <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('landing.features.title')}
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <Card key={feature.title} className="flex flex-col gap-3 p-6">
                <Icon size={20} strokeWidth={1.5} aria-hidden="true" className="text-foreground" />
                <h3 className="text-sm font-medium text-foreground">{t(feature.title)}</h3>
                <p className="text-[13px] text-muted">{t(feature.body)}</p>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
