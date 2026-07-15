import { ArrowRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Alert, Device } from '@/backend'
import { getReadings, listDevices, setDeviceState } from '@/backend'
import { etaText } from '@/frontend/alerts/format'
import { useAlerts } from '@/frontend/alerts/AlertsProvider'
import { useLiveReadings } from '@/frontend/data/LiveReadingsProvider'
import { useFarm } from '@/frontend/farm/FarmProvider'
import { useSimulator } from '@/frontend/simulator/SimulatorProvider'
import { cn } from '@/shared/lib/cn'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { computeStatus, statusToBadgeVariant } from '@/shared/lib/status'
import type { SensorType } from '@/shared/config/aquaponics'
import { DEVICE_TYPE_LIST, SENSOR_TYPES, SENSOR_TYPE_LIST } from '@/shared/config/aquaponics'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  LineChart,
  PageHeader,
  Skeleton,
  Stat,
  Switch,
  Tabs,
  useToast,
} from '@/shared/ui'
import type { LineChartPoint } from '@/shared/ui'

type RangeKey = '1h' | '6h' | '24h'

const RANGE_MS: Record<RangeKey, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
}

const DELTA_EPSILON = 1e-6

function byOrder<T extends { type: string }>(items: T[], order: readonly string[]): T[] {
  return [...items].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
}

export default function DashboardPage() {
  const { t } = useTranslation()
  usePageTitle(`${t('app.nav.dashboard')} · ${t('app.name')}`)
  const { activeFarm, activeFarmId } = useFarm()
  const { toast } = useToast()
  const { sensors, bySensorType, latest, getThresholds, hardwareConnected } = useLiveReadings()
  const { active } = useAlerts()
  const {
    running,
    start,
    stop,
    anomalies,
    toggleAnomaly,
    generating,
    generateHistory,
  } = useSimulator()

  const [devices, setDevices] = useState<Device[] | null>(null)
  const [points, setPoints] = useState<Record<string, LineChartPoint[]>>({})
  const [range, setRange] = useState<RangeKey>('6h')
  const [readingsReady, setReadingsReady] = useState(false)
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null)
  const hintedRef = useRef(false)

  const windowMs = RANGE_MS[range]
  const sensorKey = sensors.map((sensor) => sensor.id).join(',')

  const predictionByType = useMemo(() => {
    const map = new Map<SensorType, Alert>()
    for (const alert of active) {
      if (alert.kind === 'prediction' && alert.eta_minutes !== null) {
        map.set(alert.sensor_type, alert)
      }
    }
    return map
  }, [active])

  // Devices for the active farm.
  useEffect(() => {
    if (!activeFarmId) return
    let live = true
    setDevices(null)
    listDevices(activeFarmId)
      .then((list) => {
        if (live) setDevices(list)
      })
      .catch(() => {
        if (live) setDevices([])
      })
    return () => {
      live = false
    }
  }, [activeFarmId])

  // Fetch the selected range for the charts. The live tail is merged in below.
  useEffect(() => {
    if (!activeFarmId || sensors.length === 0) {
      if (sensors.length === 0) setReadingsReady(true)
      return
    }
    let live = true
    const ids = sensors.map((sensor) => sensor.id)
    const fromIso = new Date(Date.now() - windowMs).toISOString()
    setReadingsReady(false)
    getReadings(ids, fromIso)
      .then((grouped) => {
        if (!live) return
        const next: Record<string, LineChartPoint[]> = {}
        let total = 0
        for (const id of ids) {
          const rows = grouped[id] ?? []
          total += rows.length
          next[id] = rows.map((row) => ({ t: Date.parse(row.recorded_at), value: row.value }))
        }
        setPoints(next)
        setReadingsReady(true)
        if (total === 0 && !hintedRef.current) {
          hintedRef.current = true
          toast(t('app.dashboard.emptyHint'))
        }
      })
      .catch(() => {
        if (live) setReadingsReady(true)
      })
    return () => {
      live = false
    }
  }, [sensorKey, windowMs, activeFarmId, sensors, t, toast])

  // Merge the provider's live tail into the range accumulator.
  useEffect(() => {
    if (sensors.length === 0) return
    const cutoff = Date.now() - windowMs - 60000
    setPoints((previous) => {
      let changed = false
      const next = { ...previous }
      for (const sensor of sensors) {
        const tail = bySensorType.get(sensor.type) ?? []
        if (tail.length === 0) continue
        const arr = next[sensor.id] ?? []
        const lastT = arr.length > 0 ? arr[arr.length - 1].t : Number.NEGATIVE_INFINITY
        const additions = tail.filter((p) => p.t > lastT)
        if (additions.length === 0) continue
        next[sensor.id] = [...arr, ...additions].filter((p) => p.t >= cutoff)
        changed = true
      }
      return changed ? next : previous
    })
  }, [bySensorType, latest, windowMs, sensors])

  async function toggleDevice(device: Device, next: boolean) {
    setPendingDeviceId(device.id)
    setDevices((previous) =>
      previous
        ? previous.map((item) => (item.id === device.id ? { ...item, is_on: next } : item))
        : previous,
    )
    const result = await setDeviceState(device.id, device.farm_id, device.type, next)
    setPendingDeviceId(null)
    if (result.ok) {
      toast(t('app.overview.deviceUpdated'))
    } else {
      setDevices((previous) =>
        previous
          ? previous.map((item) => (item.id === device.id ? { ...item, is_on: !next } : item))
          : previous,
      )
      toast(t('app.overview.deviceFailed'), { kind: 'critical' })
    }
  }

  async function handleGenerate() {
    await generateHistory()
    if (!activeFarmId || sensors.length === 0) return
    const ids = sensors.map((sensor) => sensor.id)
    const fromIso = new Date(Date.now() - windowMs).toISOString()
    try {
      const grouped = await getReadings(ids, fromIso)
      const next: Record<string, LineChartPoint[]> = {}
      for (const id of ids) {
        next[id] = (grouped[id] ?? []).map((row) => ({
          t: Date.parse(row.recorded_at),
          value: row.value,
        }))
      }
      setPoints(next)
    } catch {
      // Non fatal: keep the current points on screen.
    }
  }

  const loading = sensors.length === 0 ? false : !readingsReady
  const orderedSensors = byOrder(sensors, SENSOR_TYPE_LIST)
  const orderedDevices = devices ? byOrder(devices, DEVICE_TYPE_LIST) : []

  const simulatorControls = (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={running ? 'ok' : 'neutral'}>
        {running ? (
          <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse bg-foreground" />
        ) : null}
        {running ? t('app.simulator.running') : t('app.simulator.stopped')}
      </Badge>
      <Button variant="secondary" size="sm" onClick={running ? stop : start}>
        {running ? t('app.simulator.stop') : t('app.simulator.start')}
      </Button>
      <Button variant="ghost" size="sm" disabled={generating} onClick={handleGenerate}>
        {generating ? t('app.simulator.generating') : t('app.simulator.generate')}
      </Button>
      {hardwareConnected ? (
        <Badge variant="ok">
          <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse bg-foreground" />
          {t('app.dashboard.hardwareConnected')}
        </Badge>
      ) : null}
    </div>
  )

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title={activeFarm?.name ?? ''} actions={simulatorControls} />

      {hardwareConnected && running ? (
        <p className="text-[13px] text-muted">{t('app.dashboard.mixingWarning')}</p>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {orderedSensors.map((sensor) => {
              const config = SENSOR_TYPES[sensor.type]
              const series = points[sensor.id] ?? []
              const current = latest.get(sensor.type) ?? series.at(-1)?.value ?? null
              if (current === null) {
                return (
                  <Card key={sensor.id} className="flex flex-col gap-3 p-4">
                    <Stat label={t(`sensors.${sensor.type}`)} value="—" unit={config.unit} />
                    <Badge variant="neutral">{t('app.overview.noData')}</Badge>
                  </Card>
                )
              }
              const status = computeStatus(current, getThresholds(sensor.type))
              const target = Date.now() - 60 * 60 * 1000
              let reference = series[0] ?? { t: 0, value: current }
              for (const point of series) {
                if (Math.abs(point.t - target) < Math.abs(reference.t - target)) reference = point
              }
              const diff = current - reference.value
              const direction: 'up' | 'down' | 'flat' =
                diff > DELTA_EPSILON ? 'up' : diff < -DELTA_EPSILON ? 'down' : 'flat'
              const delta =
                series.length > 1
                  ? { value: `${diff >= 0 ? '+' : ''}${diff.toFixed(config.decimals)}`, direction }
                  : undefined
              const prediction = predictionByType.get(sensor.type)
              return (
                <Card
                  key={sensor.id}
                  className={cn(
                    'flex flex-col gap-3 p-4',
                    status === 'critical' && 'border-foreground',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Stat
                      label={t(`sensors.${sensor.type}`)}
                      value={current.toFixed(config.decimals)}
                      unit={config.unit}
                      delta={delta}
                    />
                    <Badge variant={statusToBadgeVariant(status)}>{t(`app.status.${status}`)}</Badge>
                  </div>
                  {prediction && prediction.eta_minutes !== null ? (
                    <span className="flex items-center gap-1 font-mono text-[11px] text-muted">
                      <ArrowRight size={12} strokeWidth={1.5} aria-hidden="true" />
                      {t('alerts.kpiForecast', { eta: etaText(prediction.eta_minutes, t) })}
                    </span>
                  ) : null}
                </Card>
              )
            })}
          </section>

          <Tabs
            aria-label={t('app.dashboard.rangeLabel')}
            items={[
              { value: '1h', label: t('app.dashboard.range1h') },
              { value: '6h', label: t('app.dashboard.range6h') },
              { value: '24h', label: t('app.dashboard.range24h') },
            ]}
            value={range}
            onChange={(value) => setRange(value as RangeKey)}
          />

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {orderedSensors.map((sensor) => {
              const config = SENSOR_TYPES[sensor.type]
              const series = points[sensor.id] ?? []
              const windowed = series.filter((point) => point.t >= Date.now() - windowMs)
              const current = latest.get(sensor.type) ?? series.at(-1)?.value ?? null
              const status =
                current !== null ? computeStatus(current, getThresholds(sensor.type)) : null
              const values = windowed.map((point) => point.value)
              const stats =
                values.length > 0
                  ? {
                      min: Math.min(...values).toFixed(config.decimals),
                      avg: (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(
                        config.decimals,
                      ),
                      max: Math.max(...values).toFixed(config.decimals),
                    }
                  : null
              return (
                <Card key={sensor.id}>
                  <CardHeader
                    title={t(`sensors.${sensor.type}`)}
                    actions={
                      current !== null && status ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-foreground">
                            {current.toFixed(config.decimals)} {config.unit}
                          </span>
                          <Badge variant={statusToBadgeVariant(status)}>
                            {t(`app.status.${status}`)}
                          </Badge>
                        </div>
                      ) : undefined
                    }
                  />
                  <CardContent>
                    <LineChart
                      points={windowed}
                      thresholds={getThresholds(sensor.type)}
                      unit={config.unit}
                      decimals={config.decimals}
                      timeWindowMs={windowMs}
                    />
                    {stats ? (
                      <p className="mt-2 font-mono text-[11px] text-muted">
                        {t('app.dashboard.rangeStats', stats)}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              )
            })}
          </section>

          {running ? (
            <Card>
              <CardHeader
                title={t('app.simulator.scenariosTitle')}
                description={t('app.simulator.scenariosDescription')}
              />
              <CardContent className="flex flex-col">
                {orderedSensors.map((sensor, index) => (
                  <div
                    key={sensor.id}
                    className={cn(
                      'flex items-center justify-between py-2',
                      index > 0 && 'border-t border-border',
                    )}
                  >
                    <span className="text-sm text-foreground">{t(`sensors.${sensor.type}`)}</span>
                    <Switch
                      checked={anomalies[sensor.type]}
                      onCheckedChange={() => toggleAnomaly(sensor.type)}
                      aria-label={t(`sensors.${sensor.type}`)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <section className="flex flex-col gap-4">
            <h2 className="text-[11px] uppercase tracking-wider text-muted">
              {t('app.overview.devices')}
            </h2>
            {orderedDevices.length === 0 ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <Card>
                {orderedDevices.map((device, index) => (
                  <div
                    key={device.id}
                    className={cn(
                      'flex items-center justify-between px-4 py-3',
                      index > 0 && 'border-t border-border',
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm text-foreground">{t(`devices.${device.type}`)}</span>
                      <span className="font-mono text-xs text-muted">
                        {device.is_on ? t('app.overview.on') : t('app.overview.off')}
                      </span>
                    </div>
                    <Switch
                      checked={device.is_on}
                      disabled={pendingDeviceId === device.id}
                      onCheckedChange={(next) => toggleDevice(device, next)}
                      aria-label={t(`devices.${device.type}`)}
                    />
                  </div>
                ))}
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  )
}
