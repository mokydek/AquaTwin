import { ChevronDown, FileText, Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

import type {
  AlertExportRow,
  AutomationSummary,
  FishEventExportRow,
  LivestockSummary,
  RangeAlert,
  ReadingExportRow,
  SensorStat,
} from '@/backend'
import {
  exportAlertsCsv,
  exportFishEventsCsv,
  exportReadingsCsv,
  getAlertsInRange,
  getAutomationSummary,
  getHourlySeries,
  getLivestockSummary,
  getReportStats,
} from '@/backend'
import { useFarm } from '@/frontend/farm/FarmProvider'
import { useLiveReadings } from '@/frontend/data/LiveReadingsProvider'
import type { CsvColumn } from '@/shared/lib/csv'
import { downloadCsv, toCsv } from '@/shared/lib/csv'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { SENSOR_TYPES, SENSOR_TYPE_LIST } from '@/shared/config/aquaponics'
import type { SensorType } from '@/shared/config/aquaponics'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LineChart,
  PageHeader,
  Skeleton,
  Stat,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Tabs,
  useToast,
  Wordmark,
} from '@/shared/ui'
import type { BadgeVariant, LineChartPoint } from '@/shared/ui'

const DAY_MS = 24 * 60 * 60 * 1000

type Period = '7' | '30'
type ExportKind = 'readings' | 'alerts' | 'livestock'

type ReportData = {
  fromIso: string
  toIso: string
  stats: SensorStat[]
  hourly: { sensorType: SensorType; t: number; value: number }[]
  alerts: RangeAlert[]
  automation: AutomationSummary
  livestock: LivestockSummary
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: ReportData }

// Export column headers stay English and machine stable (see shared/lib/csv).
const READINGS_COLUMNS: CsvColumn<ReadingExportRow>[] = [
  { key: 'timestamp', header: 'timestamp' },
  { key: 'sensor', header: 'sensor' },
  { key: 'value', header: 'value' },
  { key: 'unit', header: 'unit' },
  { key: 'source', header: 'source' },
]
const ALERTS_COLUMNS: CsvColumn<AlertExportRow>[] = [
  { key: 'created_at', header: 'created_at' },
  { key: 'resolved_at', header: 'resolved_at' },
  { key: 'sensor', header: 'sensor' },
  { key: 'kind', header: 'kind' },
  { key: 'severity', header: 'severity' },
  { key: 'value', header: 'value' },
  { key: 'threshold', header: 'threshold' },
  { key: 'eta_minutes', header: 'eta_minutes' },
  { key: 'acknowledged', header: 'acknowledged' },
]
const FISH_EVENTS_COLUMNS: CsvColumn<FishEventExportRow>[] = [
  { key: 'created_at', header: 'created_at' },
  { key: 'batch_id', header: 'batch_id' },
  { key: 'type', header: 'type' },
  { key: 'count', header: 'count' },
  { key: 'avg_weight_g', header: 'avg_weight_g' },
  { key: 'note', header: 'note' },
]

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'farm'
  )
}

function formatDuration(ms: number, t: TFunction): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0
    ? t('alerts.etaHoursMinutes', { hours, minutes })
    : t('alerts.etaMinutes', { minutes })
}

// Stability index: 100 minus 40 times the average share of critical time minus
// 15 times the average share of warning time, across sensors that have samples,
// clamped at 0. Shares are fractions in the range 0 to 1.
function stabilityIndex(stats: SensorStat[]): number | null {
  const scored = stats.filter((stat) => stat.samples > 0)
  if (scored.length === 0) return null
  const critShare = scored.reduce((sum, s) => sum + s.pctCritical, 0) / scored.length / 100
  const warnShare = scored.reduce((sum, s) => sum + s.pctWarning, 0) / scored.length / 100
  return Math.max(0, Math.round(100 - 40 * critShare - 15 * warnShare))
}

function stabilityVariant(index: number): BadgeVariant {
  if (index > 90) return 'ok'
  if (index >= 70) return 'warning'
  return 'critical'
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="text-[11px] uppercase tracking-wider text-muted">{children}</h2>
}

export default function ReportsPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const pageTitle = `${t('reports.title')} · ${t('app.name')}`
  usePageTitle(pageTitle)

  const { activeFarmId, activeFarm } = useFarm()
  const { getThresholds } = useLiveReadings()
  const { toast } = useToast()

  const [period, setPeriod] = useState<Period>('7')
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pending, setPending] = useState<ExportKind | null>(null)

  const fmtDate = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }),
    [locale],
  )
  const fmtDateTime = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  )
  const fmtTime = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }),
    [locale],
  )

  useEffect(() => {
    if (!activeFarmId) return
    let live = true
    setState({ status: 'loading' })
    const to = new Date()
    const days = period === '7' ? 7 : 30
    const fromIso = new Date(to.getTime() - days * DAY_MS).toISOString()
    const toIso = to.toISOString()
    Promise.all([
      getReportStats(activeFarmId, fromIso, toIso),
      getHourlySeries(activeFarmId, fromIso, toIso),
      getAlertsInRange(activeFarmId, fromIso, toIso),
      getAutomationSummary(activeFarmId, fromIso, toIso),
      getLivestockSummary(activeFarmId, fromIso, toIso),
    ])
      .then(([stats, hourly, alerts, automation, livestock]) => {
        if (!live) return
        setState({
          status: 'ready',
          data: { fromIso, toIso, stats, hourly, alerts, automation, livestock },
        })
      })
      .catch(() => {
        if (live) setState({ status: 'error' })
      })
    return () => {
      live = false
    }
  }, [activeFarmId, period, reloadKey])

  // Swap the document title while printing so the browser print header and the
  // suggested PDF name read AquaTwin Report <farm> <period>, then restore it.
  useEffect(() => {
    if (state.status !== 'ready' || !activeFarm) return
    const periodLabel = period === '7' ? t('reports.period.last7') : t('reports.period.last30')
    const printTitle = t('reports.printTitle', { farm: activeFarm.name, period: periodLabel })
    const apply = () => {
      document.title = printTitle
    }
    const restore = () => {
      document.title = pageTitle
    }
    window.addEventListener('beforeprint', apply)
    window.addEventListener('afterprint', restore)
    return () => {
      window.removeEventListener('beforeprint', apply)
      window.removeEventListener('afterprint', restore)
    }
  }, [state.status, activeFarm, period, pageTitle, t])

  const hourlyByType = useMemo(() => {
    const map = new Map<SensorType, LineChartPoint[]>()
    if (state.status !== 'ready') return map
    for (const point of state.data.hourly) {
      const arr = map.get(point.sensorType) ?? []
      arr.push({ t: point.t, value: point.value })
      map.set(point.sensorType, arr)
    }
    return map
  }, [state])

  async function runExport(kind: ExportKind) {
    if (state.status !== 'ready' || !activeFarmId || !activeFarm) return
    const { fromIso, toIso } = state.data
    const slug = slugify(activeFarm.name)
    const name = `aquatwin-${slug}-${kind}-${fromIso.slice(0, 10)}-${toIso.slice(0, 10)}.csv`
    setPending(kind)
    try {
      let csv: string
      if (kind === 'readings') {
        csv = toCsv(READINGS_COLUMNS, await exportReadingsCsv(activeFarmId, fromIso, toIso))
      } else if (kind === 'alerts') {
        csv = toCsv(ALERTS_COLUMNS, await exportAlertsCsv(activeFarmId, fromIso, toIso))
      } else {
        csv = toCsv(FISH_EVENTS_COLUMNS, await exportFishEventsCsv(activeFarmId, fromIso, toIso))
      }
      downloadCsv(name, csv)
      toast(t('reports.exported'))
    } catch {
      toast(t('reports.exportFailed'), { kind: 'critical' })
    } finally {
      setPending(null)
      setMenuOpen(false)
    }
  }

  const tabs = [
    { value: '7', label: t('reports.period.last7') },
    { value: '30', label: t('reports.period.last30') },
  ]

  const exportItems: { kind: ExportKind; label: string }[] = [
    { kind: 'readings', label: t('reports.exportReadings') },
    { kind: 'alerts', label: t('reports.exportAlerts') },
    { kind: 'livestock', label: t('reports.exportLivestock') },
  ]

  const actions = (
    <>
      <Button variant="secondary" size="sm" leftIcon={Printer} onClick={() => window.print()}>
        {t('reports.savePdf')}
      </Button>
      <div className="relative">
        <Button
          variant="secondary"
          size="sm"
          rightIcon={ChevronDown}
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          {t('reports.export')}
        </Button>
        {menuOpen ? (
          <>
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setMenuOpen(false)}
            />
            <div
              role="menu"
              className="absolute right-0 z-50 mt-1 flex w-52 flex-col gap-1 rounded-sharp border border-border bg-background p-1 shadow-none"
            >
              {exportItems.map((item) => (
                <Button
                  key={item.kind}
                  variant="ghost"
                  size="sm"
                  fullWidth
                  disabled={pending !== null}
                  onClick={() => runExport(item.kind)}
                  className="justify-start"
                >
                  {pending === item.kind ? t('reports.exporting') : item.label}
                </Button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </>
  )

  const chrome = (
    <div className="flex flex-col gap-4 print:hidden">
      <PageHeader title={t('reports.title')} description={t('reports.description')} actions={actions} />
      <Tabs
        items={tabs}
        value={period}
        onChange={(value) => setPeriod(value as Period)}
        aria-label={t('reports.period.aria')}
      />
    </div>
  )

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-8">
        {chrome}
        <div className="flex flex-col gap-6">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col gap-8">
        {chrome}
        <ErrorState
          title={t('reports.error')}
          retryLabel={t('reports.retry')}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      </div>
    )
  }

  const { data } = state
  const totalSamples = data.stats.reduce((sum, stat) => sum + stat.samples, 0)
  const hardwareSamples = data.stats.reduce(
    (sum, stat) => sum + (stat.samples * stat.hardwareShare) / 100,
    0,
  )
  const hardwareShare = totalSamples > 0 ? (hardwareSamples / totalSamples) * 100 : 0
  const simulationShare = 100 - hardwareShare

  const index = stabilityIndex(data.stats)
  const criticalCount = data.alerts.filter((alert) => alert.severity === 'critical').length
  const durations = data.alerts
    .map((alert) => alert.durationMs)
    .filter((ms): ms is number => ms !== null)
  const longest = durations.length > 0 ? Math.max(...durations) : null

  return (
    <div className="flex flex-col gap-8">
      {chrome}

      <div className="flex flex-col gap-10">
        {/* 1. Report header */}
        <div className="flex flex-wrap items-start justify-between gap-4 break-inside-avoid border-b border-border pb-6">
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold tracking-tight text-foreground">
              {activeFarm?.name}
            </span>
            <span className="font-mono text-xs text-muted">
              {fmtDate.format(new Date(data.fromIso))} → {fmtDate.format(new Date(data.toIso))}
            </span>
            <span className="text-xs text-muted">
              {t('reports.generated', { date: fmtDateTime.format(new Date(data.toIso)) })}
            </span>
          </div>
          <Wordmark />
        </div>

        {/* 2. Stability index */}
        <section className="flex flex-col gap-4">
          <SectionLabel>{t('reports.sections.stability')}</SectionLabel>
          <Card className="flex flex-col gap-3 break-inside-avoid p-6">
            <div className="flex items-center gap-4">
              <span className="font-mono text-[44px] font-medium leading-none tracking-tight text-foreground tabular-nums">
                {index === null ? t('common.noData') : index}
              </span>
              {index !== null ? (
                <div className="flex flex-col gap-1">
                  <Badge variant={stabilityVariant(index)}>{t(`app.status.${stabilityVariant(index)}`)}</Badge>
                  <span className="font-mono text-xs text-muted">{t('reports.stability.outOf')}</span>
                </div>
              ) : null}
            </div>
            <p className="text-xs text-muted">{t('reports.stability.footnote')}</p>
          </Card>
        </section>

        {/* 3. Water quality */}
        <section className="flex flex-col gap-4">
          <SectionLabel>{t('reports.sections.waterQuality')}</SectionLabel>
          {data.stats.length === 0 ? (
            <p className="text-[13px] text-muted">{t('reports.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <Tr>
                    <Th>{t('reports.water.sensor')}</Th>
                    <Th>{t('reports.water.avg')}</Th>
                    <Th>{t('reports.water.min')}</Th>
                    <Th>{t('reports.water.max')}</Th>
                    <Th>{t('reports.water.time')}</Th>
                    <Th>{t('reports.water.samples')}</Th>
                    <Th>{t('reports.water.hardware')}</Th>
                  </Tr>
                </THead>
                <TBody>
                  {data.stats.map((stat) => {
                    const config = SENSOR_TYPES[stat.sensorType]
                    return (
                      <Tr key={stat.sensorType} className="break-inside-avoid">
                        <Td>
                          <div className="flex flex-col">
                            <span className="text-foreground">{t(`sensors.${stat.sensorType}`)}</span>
                            <span className="font-mono text-xs text-muted">{config.unit}</span>
                          </div>
                        </Td>
                        <Td className="font-mono tabular-nums">{stat.avg.toFixed(config.decimals)}</Td>
                        <Td className="font-mono tabular-nums">{stat.min.toFixed(config.decimals)}</Td>
                        <Td className="font-mono tabular-nums">{stat.max.toFixed(config.decimals)}</Td>
                        <Td>
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant="ok" className="font-mono tabular-nums">
                              {Math.round(stat.pctOk)}%
                            </Badge>
                            <Badge variant="warning" className="font-mono tabular-nums">
                              {Math.round(stat.pctWarning)}%
                            </Badge>
                            <Badge variant="critical" className="font-mono tabular-nums">
                              {Math.round(stat.pctCritical)}%
                            </Badge>
                          </div>
                        </Td>
                        <Td className="font-mono tabular-nums">{stat.samples.toLocaleString(locale)}</Td>
                        <Td className="font-mono tabular-nums">{Math.round(stat.hardwareShare)}%</Td>
                      </Tr>
                    )
                  })}
                </TBody>
              </Table>
            </div>
          )}
        </section>

        {/* 4. Hourly averages */}
        <section className="flex flex-col gap-4">
          <SectionLabel>{t('reports.sections.hourly')}</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SENSOR_TYPE_LIST.map((type) => {
              const config = SENSOR_TYPES[type]
              const points = hourlyByType.get(type) ?? []
              return (
                <Card key={type} className="flex flex-col gap-2 break-inside-avoid p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{t(`sensors.${type}`)}</span>
                    <span className="font-mono text-xs text-muted">{config.unit}</span>
                  </div>
                  <LineChart
                    points={points}
                    thresholds={getThresholds(type)}
                    unit={config.unit}
                    decimals={config.decimals}
                    timeWindowMs={period === '7' ? 7 * DAY_MS : 30 * DAY_MS}
                    height={120}
                  />
                </Card>
              )
            })}
          </div>
        </section>

        {/* 5. Incidents */}
        <section className="flex flex-col gap-4">
          <SectionLabel>{t('reports.sections.incidents')}</SectionLabel>
          <Card className="grid grid-cols-2 gap-4 break-inside-avoid p-6 sm:grid-cols-3">
            <Stat label={t('reports.incidents.total')} value={data.alerts.length} />
            <Stat label={t('reports.incidents.critical')} value={criticalCount} />
            <Stat
              label={t('reports.incidents.longest')}
              value={longest === null ? t('common.noData') : formatDuration(longest, t)}
            />
          </Card>
          {data.alerts.length === 0 ? (
            <EmptyState icon={FileText} title={t('reports.incidents.empty')} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <Tr>
                    <Th>{t('reports.incidents.time')}</Th>
                    <Th>{t('reports.incidents.sensor')}</Th>
                    <Th>{t('reports.incidents.kind')}</Th>
                    <Th>{t('reports.incidents.severity')}</Th>
                    <Th>{t('reports.incidents.duration')}</Th>
                  </Tr>
                </THead>
                <TBody>
                  {data.alerts.map((alert) => (
                    <Tr key={alert.id} className="break-inside-avoid">
                      <Td className="font-mono tabular-nums">
                        {fmtTime.format(new Date(alert.createdAt))}
                      </Td>
                      <Td>{t(`sensors.${alert.sensorType}`)}</Td>
                      <Td>{t(`alerts.kind.${alert.kind}`)}</Td>
                      <Td>
                        <Badge variant={alert.severity === 'critical' ? 'critical' : 'warning'}>
                          {t(`app.status.${alert.severity}`)}
                        </Badge>
                      </Td>
                      <Td className="font-mono tabular-nums">
                        {alert.durationMs === null
                          ? t('reports.incidents.ongoing')
                          : formatDuration(alert.durationMs, t)}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </section>

        {/* 6. Livestock */}
        <section className="flex flex-col gap-4">
          <SectionLabel>{t('reports.sections.livestock')}</SectionLabel>
          <Card className="grid grid-cols-2 gap-4 break-inside-avoid p-6 sm:grid-cols-4">
            <Stat label={t('reports.livestock.fishCount')} value={data.livestock.currentCount.toLocaleString(locale)} />
            <Stat
              label={t('reports.livestock.biomass')}
              value={data.livestock.biomassKg.toFixed(1)}
              unit="kg"
            />
            <Stat label={t('reports.livestock.mortality')} value={data.livestock.mortality.toLocaleString(locale)} />
            <Stat label={t('reports.livestock.harvested')} value={data.livestock.harvest.toLocaleString(locale)} />
          </Card>
        </section>

        {/* 7. Automation */}
        <section className="flex flex-col gap-4">
          <SectionLabel>{t('reports.sections.automation')}</SectionLabel>
          <Card className="grid grid-cols-2 gap-4 break-inside-avoid p-6">
            <Stat label={t('reports.automation.ruleActions')} value={data.automation.byTrigger.rule} />
            <Stat label={t('reports.automation.manualActions')} value={data.automation.byTrigger.manual} />
          </Card>
          {data.automation.byDevice.length === 0 ? (
            <p className="text-[13px] text-muted">{t('reports.automation.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <Tr>
                    <Th>{t('reports.automation.device')}</Th>
                    <Th>{t('reports.automation.count')}</Th>
                  </Tr>
                </THead>
                <TBody>
                  {data.automation.byDevice.map((row) => (
                    <Tr key={row.device} className="break-inside-avoid">
                      <Td>{t(`devices.${row.device}`)}</Td>
                      <Td className="font-mono tabular-nums">{row.count.toLocaleString(locale)}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </section>

        {/* 8. Data sources */}
        <section className="flex flex-col gap-4">
          <SectionLabel>{t('reports.sections.dataSources')}</SectionLabel>
          <Card className="grid grid-cols-2 gap-4 break-inside-avoid p-6">
            <Stat
              label={t('reports.dataSources.simulation')}
              value={totalSamples > 0 ? Math.round(simulationShare) : t('common.noData')}
              unit={totalSamples > 0 ? '%' : undefined}
            />
            <Stat
              label={t('reports.dataSources.hardware')}
              value={totalSamples > 0 ? Math.round(hardwareShare) : t('common.noData')}
              unit={totalSamples > 0 ? '%' : undefined}
            />
          </Card>
        </section>
      </div>
    </div>
  )
}
