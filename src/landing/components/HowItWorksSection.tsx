import { Copy, Radio, TrendingUp, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type Step = {
  number: string
  icon: LucideIcon
  title: string
  body: string
}

const STEPS: Step[] = [
  { number: '01', icon: Radio, title: 'landing.how.step1Title', body: 'landing.how.step1Body' },
  { number: '02', icon: Copy, title: 'landing.how.step2Title', body: 'landing.how.step2Body' },
  { number: '03', icon: TrendingUp, title: 'landing.how.step3Title', body: 'landing.how.step3Body' },
  { number: '04', icon: Zap, title: 'landing.how.step4Title', body: 'landing.how.step4Body' },
]

export function HowItWorksSection() {
  const { t } = useTranslation()

  return (
    <section id="how" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto w-full max-w-[1080px] px-6 py-20 sm:py-24">
        <span className="text-[11px] uppercase tracking-wider text-muted">
          {t('landing.how.label')}
        </span>
        <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('landing.how.title')}
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => {
            const Icon = step.icon
            return (
              <div key={step.number} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-muted">
                  <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                  <span className="font-mono text-sm tabular-nums">{step.number}</span>
                </div>
                <h3 className="text-sm font-medium text-foreground">{t(step.title)}</h3>
                <p className="text-[13px] text-muted">{t(step.body)}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
