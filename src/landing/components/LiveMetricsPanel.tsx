import { TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SensorType } from '@/shared/config/aquaponics'
import { SENSOR_TYPES } from '@/shared/config/aquaponics'
import { Badge, Card, CardFooter, Stat } from '@/shared/ui'

type Metric = {
  type: SensorType
  base: number
  spread: number
  status: 'ok' | 'warning'
}

const METRICS: Metric[] = [
  { type: 'ph', base: 7.02, spread: 0.06, status: 'ok' },
  { type: 'water_temp', base: 24.6, spread: 0.3, status: 'ok' },
  { type: 'dissolved_oxygen', base: 7.8, spread: 0.2, status: 'ok' },
  { type: 'ammonia', base: 0.24, spread: 0.04, status: 'warning' },
]

function drift(base: number, spread: number): number {
  return base + (Math.random() - 0.5) * 2 * spread
}

export function LiveMetricsPanel() {
  const { t } = useTranslation()
  const [values, setValues] = useState<number[]>(() => METRICS.map((m) => m.base))

  useEffect(() => {
    const id = setInterval(() => {
      setValues(METRICS.map((m) => drift(m.base, m.spread)))
    }, 2000)
    return () => clearInterval(id)
  }, [])

  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-border p-4">
        <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse bg-foreground" />
        <span className="text-[11px] uppercase tracking-wider text-muted">
          {t('landing.hero.liveView')}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-6 p-4">
        {METRICS.map((metric, index) => {
          const config = SENSOR_TYPES[metric.type]
          return (
            <div key={metric.type} className="flex flex-col gap-2">
              <Stat
                label={t(`sensors.${metric.type}`)}
                value={values[index].toFixed(config.decimals)}
                unit={config.unit}
              />
              <Badge variant={metric.status}>
                {metric.status === 'warning'
                  ? t('landing.hero.warning')
                  : t('landing.hero.normal')}
              </Badge>
            </div>
          )
        })}
      </div>
      <CardFooter className="text-xs text-muted">
        <TrendingUp size={14} strokeWidth={1.5} aria-hidden="true" />
        <span>{t('landing.hero.prediction')}</span>
      </CardFooter>
    </Card>
  )
}
