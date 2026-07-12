import { useTranslation } from 'react-i18next'

// Values stay identical across languages; only the labels are translated.
const STATS = [
  { value: '4 h', label: 'landing.problem.stat1Label' },
  { value: '6', label: 'landing.problem.stat2Label' },
  { value: '100%', label: 'landing.problem.stat3Label' },
] as const

export function ProblemSection() {
  const { t } = useTranslation()

  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-[1080px] px-6 py-20 sm:py-24">
        <span className="text-[11px] uppercase tracking-wider text-muted">
          {t('landing.problem.label')}
        </span>
        <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('landing.problem.title')}
        </h2>
        <p className="mt-4 max-w-2xl text-muted">{t('landing.problem.body')}</p>
        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {STATS.map((stat) => (
            <div key={stat.value} className="border-t border-border pt-6">
              <div className="font-mono text-4xl font-medium tabular-nums sm:text-5xl">
                {stat.value}
              </div>
              <div className="mt-2 text-[13px] text-muted">{t(stat.label)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
