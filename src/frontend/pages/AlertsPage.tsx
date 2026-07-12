import { Check, Lightbulb, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Alert } from '@/backend'
import { listResolvedAlerts } from '@/backend'
import { alertDirection, etaText } from '@/frontend/alerts/format'
import { useAlerts } from '@/frontend/alerts/AlertsProvider'
import { useFarm } from '@/frontend/farm/FarmProvider'
import { cn } from '@/shared/lib/cn'
import { statusToBadgeVariant } from '@/shared/lib/status'
import { recommendationKey, SENSOR_TYPES } from '@/shared/config/aquaponics'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tabs,
  Tr,
} from '@/shared/ui'

type TabKey = 'active' | 'history'

function alertMessage(alert: Alert, t: ReturnType<typeof useTranslation>['t']): string {
  if (alert.kind === 'prediction') {
    const eta = alert.eta_minutes !== null ? etaText(alert.eta_minutes, t) : ''
    return t('alerts.message.prediction', { eta })
  }
  const config = SENSOR_TYPES[alert.sensor_type]
  const value = alert.value !== null ? alert.value.toFixed(config.decimals) : ''
  return t('alerts.message.threshold', { value, unit: config.unit })
}

function formatAge(iso: string, locale: string): string {
  const diffMs = Date.parse(iso) - Date.now()
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const minutes = Math.round(diffMs / 60000)
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
  const hours = Math.round(diffMs / 3600000)
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  return rtf.format(Math.round(diffMs / 86400000), 'day')
}

function formatMoment(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function formatDuration(
  fromIso: string,
  toIso: string,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  const totalMinutes = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0
    ? t('alerts.etaHoursMinutes', { hours, minutes })
    : t('alerts.etaMinutes', { minutes })
}

export default function AlertsPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const { active, acknowledge } = useAlerts()
  const { activeFarmId } = useFarm()
  const [tab, setTab] = useState<TabKey>('active')
  const [resolved, setResolved] = useState<Alert[] | null>(null)

  useEffect(() => {
    if (tab !== 'history' || !activeFarmId) return
    let live = true
    setResolved(null)
    listResolvedAlerts(activeFarmId, 100)
      .then((list) => {
        if (live) setResolved(list)
      })
      .catch(() => {
        if (live) setResolved([])
      })
    return () => {
      live = false
    }
  }, [tab, activeFarmId])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('alerts.title')} description={t('alerts.description')} />

      <Tabs
        aria-label={t('alerts.title')}
        items={[
          { value: 'active', label: t('alerts.tabs.active') },
          { value: 'history', label: t('alerts.tabs.history') },
        ]}
        value={tab}
        onChange={(value) => setTab(value as TabKey)}
      />

      {tab === 'active' ? (
        active.length === 0 ? (
          <EmptyState icon={ShieldCheck} title={t('alerts.emptyActive')} />
        ) : (
          <div className="flex flex-col gap-3">
            {active.map((alert) => {
              return (
                <Card
                  key={alert.id}
                  className={cn('p-4', alert.severity === 'critical' && 'border-foreground')}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={statusToBadgeVariant(alert.severity)}>
                          {t(`app.status.${alert.severity}`)}
                        </Badge>
                        <span className="text-[11px] uppercase tracking-wider text-muted">
                          {t(`alerts.kind.${alert.kind}`)}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-muted">
                        {formatAge(alert.created_at, locale)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-foreground">
                        {t(`sensors.${alert.sensor_type}`)}
                      </span>
                      <span className="text-[13px] text-foreground">{alertMessage(alert, t)}</span>
                      <span className="flex items-center gap-1.5 text-[13px] text-muted">
                        <Lightbulb size={14} strokeWidth={1.5} aria-hidden="true" />
                        {t(recommendationKey(alert.sensor_type, alertDirection(alert)))}
                      </span>
                    </div>

                    <div>
                      {alert.acknowledged ? (
                        <span className="flex items-center gap-1.5 text-[13px] text-muted">
                          <Check size={14} strokeWidth={1.5} aria-hidden="true" />
                          {t('alerts.acknowledged')}
                        </span>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => acknowledge(alert.id)}>
                          {t('alerts.acknowledge')}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )
      ) : resolved && resolved.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={t('alerts.emptyHistory')} />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <Tr>
                <Th>{t('alerts.history.time')}</Th>
                <Th>{t('alerts.history.sensor')}</Th>
                <Th>{t('alerts.history.type')}</Th>
                <Th>{t('alerts.history.severity')}</Th>
                <Th className="text-right">{t('alerts.history.peak')}</Th>
                <Th className="text-right">{t('alerts.history.duration')}</Th>
              </Tr>
            </THead>
            <TBody>
              {(resolved ?? []).map((alert) => {
                const config = SENSOR_TYPES[alert.sensor_type]
                return (
                  <Tr key={alert.id}>
                    <Td className="font-mono tabular-nums">
                      {formatMoment(alert.created_at, locale)}
                    </Td>
                    <Td>{t(`sensors.${alert.sensor_type}`)}</Td>
                    <Td>{t(`alerts.kind.${alert.kind}`)}</Td>
                    <Td>
                      <Badge variant={statusToBadgeVariant(alert.severity)}>
                        {t(`app.status.${alert.severity}`)}
                      </Badge>
                    </Td>
                    <Td numeric>
                      {alert.value !== null ? `${alert.value.toFixed(config.decimals)} ${config.unit}` : '—'}
                    </Td>
                    <Td numeric>
                      {alert.resolved_at
                        ? formatDuration(alert.created_at, alert.resolved_at, t)
                        : '—'}
                    </Td>
                  </Tr>
                )
              })}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  )
}
