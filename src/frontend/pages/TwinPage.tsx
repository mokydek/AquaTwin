import { ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { Device } from '@/backend'
import { listDevices, setDeviceState } from '@/backend'
import { useLiveReadings } from '@/frontend/data/LiveReadingsProvider'
import { useFarm } from '@/frontend/farm/FarmProvider'
import { Schematic } from '@/frontend/twin/Schematic'
import type { SchematicNodeId } from '@/frontend/twin/Schematic'
import { baselineState } from '@/frontend/twin/model'
import type { WaterState } from '@/frontend/twin/model'
import { defaultScenario, runScenario } from '@/frontend/twin/scenario'
import type { Scenario, ScenarioResult, Verdict } from '@/frontend/twin/scenario'
import { SENSOR_TYPES, SENSOR_TYPE_LIST } from '@/shared/config/aquaponics'
import type { SensorType, Thresholds } from '@/shared/config/aquaponics'
import { computeStatus, statusToBadgeVariant } from '@/shared/lib/status'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import type { Status } from '@/shared/lib/status'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  LineChart,
  PageHeader,
  Select,
  Stat,
  Switch,
  Tabs,
  useToast,
} from '@/shared/ui'

type TabKey = 'schematic' | 'whatif'

const DAY_MS = 24 * 60 * 60 * 1000

const NODE_SENSORS: Record<SchematicNodeId, SensorType[]> = {
  fish_tank: ['dissolved_oxygen', 'water_temp', 'ph'],
  biofilter: ['ammonia', 'nitrite'],
  grow_beds: ['nitrate', 'ph'],
  sump: [],
  pump: [],
}

const VERDICT_STATUS: Record<Verdict, Status> = {
  stable: 'ok',
  at_risk: 'warning',
  critical: 'critical',
}

function buildCurrentState(latest: Map<SensorType, number>): WaterState {
  const base = baselineState()
  return {
    ph: latest.get('ph') ?? base.ph,
    water_temp: latest.get('water_temp') ?? base.water_temp,
    dissolved_oxygen: latest.get('dissolved_oxygen') ?? base.dissolved_oxygen,
    ammonia: latest.get('ammonia') ?? base.ammonia,
    nitrite: latest.get('nitrite') ?? base.nitrite,
    nitrate: latest.get('nitrate') ?? base.nitrate,
  }
}

function ControlLabel({ children, value }: { children: ReactNode; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] uppercase tracking-wider text-muted">{children}</span>
      <span className="font-mono text-xs text-foreground">{value}</span>
    </div>
  )
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (value: number) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <ControlLabel value={display}>{label}</ControlLabel>
      <input
        type="range"
        className="range-mono"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}

export default function TwinPage() {
  const { t } = useTranslation()
  usePageTitle(`${t('app.nav.twin')} · ${t('app.name')}`)
  const { activeFarmId } = useFarm()
  const { latest, getThresholds } = useLiveReadings()
  const { toast } = useToast()

  const [tab, setTab] = useState<TabKey>('schematic')
  const [devices, setDevices] = useState<Device[]>([])
  const [selected, setSelected] = useState<SchematicNodeId | null>(null)
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null)
  const [scenario, setScenario] = useState<Scenario>(defaultScenario)
  const [result, setResult] = useState<ScenarioResult | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!activeFarmId) return
    let live = true
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

  const current = useMemo(() => buildCurrentState(latest), [latest])

  async function toggleDevice(device: Device, next: boolean) {
    setPendingDeviceId(device.id)
    setDevices((previous) =>
      previous.map((item) => (item.id === device.id ? { ...item, is_on: next } : item)),
    )
    const outcome = await setDeviceState(device.id, device.farm_id, device.type, next)
    setPendingDeviceId(null)
    if (outcome.ok) {
      toast(t('app.overview.deviceUpdated'))
    } else {
      setDevices((previous) =>
        previous.map((item) => (item.id === device.id ? { ...item, is_on: !next } : item)),
      )
      toast(t('app.overview.deviceFailed'), { kind: 'critical' })
    }
  }

  function updateScenario(patch: Partial<Scenario>) {
    setScenario((previous) => ({ ...previous, ...patch }))
  }

  function handleRun() {
    setRunning(true)
    const startState = buildCurrentState(latest)
    const snapshot = scenario
    window.setTimeout(() => {
      setResult(runScenario(startState, snapshot, getThresholds))
      setRunning(false)
    }, 60)
  }

  function handleReset() {
    setScenario(defaultScenario())
    setResult(null)
  }

  const pumpDevice = devices.find((device) => device.type === 'main_pump')

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('app.nav.twin')} description={t('twin.description')} />

      <Tabs
        aria-label={t('app.nav.twin')}
        items={[
          { value: 'schematic', label: t('twin.tabs.schematic') },
          { value: 'whatif', label: t('twin.tabs.whatif') },
        ]}
        value={tab}
        onChange={(value) => setTab(value as TabKey)}
      />

      {tab === 'schematic' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-4 lg:col-span-2">
            <Schematic devices={devices} selected={selected} onSelect={setSelected} />
          </Card>

          <Card>
            <CardHeader title={selected ? t(`twin.nodes.${selected}`) : t('twin.details')} />
            <CardContent>
              {!selected ? (
                <p className="text-[13px] text-muted">{t('twin.selectHint')}</p>
              ) : selected === 'pump' ? (
                pumpDevice ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{t('devices.main_pump')}</span>
                    <Switch
                      checked={pumpDevice.is_on}
                      disabled={pendingDeviceId === pumpDevice.id}
                      onCheckedChange={(next) => toggleDevice(pumpDevice, next)}
                      aria-label={t('devices.main_pump')}
                    />
                  </div>
                ) : (
                  <p className="text-[13px] text-muted">{t('twin.noSensors')}</p>
                )
              ) : NODE_SENSORS[selected].length === 0 ? (
                <p className="text-[13px] text-muted">{t('twin.noSensors')}</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {NODE_SENSORS[selected].map((type) => {
                    const config = SENSOR_TYPES[type]
                    const value = latest.get(type)
                    const status = value !== undefined ? computeStatus(value, getThresholds(type)) : null
                    return (
                      <div key={type} className="flex items-start justify-between gap-2">
                        <Stat
                          label={t(`sensors.${type}`)}
                          value={value !== undefined ? value.toFixed(config.decimals) : '—'}
                          unit={config.unit}
                        />
                        <Badge variant={status ? statusToBadgeVariant(status) : 'neutral'}>
                          {status ? t(`app.status.${status}`) : t('app.overview.noData')}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader title={t('twin.controls.title')} description={t('twin.disclaimer')} />
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] uppercase tracking-wider text-muted">
                  {t('twin.controls.horizon')}
                </span>
                <Select
                  value={String(scenario.horizonDays)}
                  onChange={(event) =>
                    updateScenario({ horizonDays: Number(event.target.value) as 7 | 14 | 30 })
                  }
                >
                  <option value="7">{t('twin.horizonOption', { days: 7 })}</option>
                  <option value="14">{t('twin.horizonOption', { days: 14 })}</option>
                  <option value="30">{t('twin.horizonOption', { days: 30 })}</option>
                </Select>
              </div>

              <RangeControl
                label={t('twin.controls.waterTempDelta')}
                value={scenario.waterTempDelta}
                min={-5}
                max={5}
                step={0.5}
                display={`${scenario.waterTempDelta >= 0 ? '+' : ''}${scenario.waterTempDelta.toFixed(1)} °C`}
                onChange={(value) => updateScenario({ waterTempDelta: value })}
              />
              <RangeControl
                label={t('twin.controls.fishLoad')}
                value={scenario.fishLoad}
                min={0.5}
                max={2}
                step={0.1}
                display={`×${scenario.fishLoad.toFixed(1)}`}
                onChange={(value) => updateScenario({ fishLoad: value })}
              />
              <RangeControl
                label={t('twin.controls.feedRate')}
                value={scenario.feedRate}
                min={0.5}
                max={2}
                step={0.1}
                display={`×${scenario.feedRate.toFixed(1)}`}
                onChange={(value) => updateScenario({ feedRate: value })}
              />
              <RangeControl
                label={t('twin.controls.plantMass')}
                value={scenario.plantMass}
                min={0.5}
                max={2}
                step={0.1}
                display={`×${scenario.plantMass.toFixed(1)}`}
                onChange={(value) => updateScenario({ plantMass: value })}
              />
              <RangeControl
                label={t('twin.controls.aeration')}
                value={scenario.aerationLevel}
                min={0}
                max={1}
                step={0.05}
                display={scenario.aerationLevel.toFixed(2)}
                onChange={(value) => updateScenario({ aerationLevel: value })}
              />
              <RangeControl
                label={t('twin.controls.filtration')}
                value={scenario.filtrationLevel}
                min={0}
                max={1}
                step={0.05}
                display={scenario.filtrationLevel.toFixed(2)}
                onChange={(value) => updateScenario({ filtrationLevel: value })}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateScenario({ waterTempDelta: 4 })}
                >
                  {t('twin.presets.heatwave')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateScenario({ feedRate: 1.8, fishLoad: 1.3 })}
                >
                  {t('twin.presets.overfeeding')}
                </Button>
              </div>

              <div className="flex flex-col gap-1 rounded-sharp border border-border bg-surface p-3">
                <span className="text-[11px] uppercase tracking-wider text-muted">
                  {t('twin.controls.baseline')}
                </span>
                {SENSOR_TYPE_LIST.map((type) => {
                  const config = SENSOR_TYPES[type]
                  return (
                    <div key={type} className="flex items-center justify-between font-mono text-xs">
                      <span className="text-muted">{t(`sensors.${type}`)}</span>
                      <span className="text-foreground">
                        {current[type].toFixed(config.decimals)} {config.unit}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={handleRun} disabled={running}>
                  {running ? t('twin.controls.running') : t('twin.controls.run')}
                </Button>
                <Button variant="ghost" onClick={handleReset}>
                  {t('twin.controls.reset')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4 lg:col-span-2">
            {!result ? (
              <Card>
                <CardContent className="py-10">
                  <p className="text-center text-[13px] text-muted">{t('twin.runHint')}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader
                    title={t('twin.overallLabel')}
                    actions={
                      <Badge variant={statusToBadgeVariant(VERDICT_STATUS[result.overall])}>
                        {t(`twin.verdict.${result.overall}`)}
                      </Badge>
                    }
                  />
                  <CardContent>
                    {result.overall === 'stable' ? (
                      <EmptyState icon={ShieldCheck} title={t('twin.allStable')} />
                    ) : (
                      <div className="flex flex-col">
                        {result.analysis
                          .filter((item) => item.verdict !== 'stable')
                          .map((item, index) => (
                            <div
                              key={item.type}
                              className={
                                index > 0
                                  ? 'flex items-center justify-between gap-2 border-t border-border py-2'
                                  : 'flex items-center justify-between gap-2 py-2'
                              }
                            >
                              <div className="flex items-center gap-2">
                                <Badge variant={statusToBadgeVariant(VERDICT_STATUS[item.verdict])}>
                                  {t(`twin.verdict.${item.verdict}`)}
                                </Badge>
                                <span className="text-sm text-foreground">
                                  {t(`sensors.${item.type}`)}
                                </span>
                              </div>
                              <span className="font-mono text-xs text-muted">
                                {item.criticalDay !== null
                                  ? t('twin.entersCritical', { day: item.criticalDay })
                                  : item.warningDay !== null
                                    ? t('twin.entersWarning', { day: item.warningDay })
                                    : ''}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <TwinCharts result={result} getThresholds={getThresholds} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TwinCharts({
  result,
  getThresholds,
}: {
  result: ScenarioResult
  getThresholds: (type: SensorType) => Thresholds
}) {
  const { t } = useTranslation()
  const lastDay = result.series.at(-1)?.day ?? 1
  const windowMs = Math.max(1, lastDay) * DAY_MS
  const base = Date.now() - windowMs

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {SENSOR_TYPE_LIST.map((type) => {
        const config = SENSOR_TYPES[type]
        const points = result.series.map((point) => ({
          t: base + point.day * DAY_MS,
          value: point[type],
        }))
        const analysis = result.analysis.find((item) => item.type === type)
        return (
          <Card key={type}>
            <CardHeader
              title={t(`sensors.${type}`)}
              actions={
                analysis ? (
                  <Badge variant={statusToBadgeVariant(VERDICT_STATUS[analysis.verdict])}>
                    {t(`twin.verdict.${analysis.verdict}`)}
                  </Badge>
                ) : undefined
              }
            />
            <CardContent>
              <LineChart
                points={points}
                thresholds={getThresholds(type)}
                unit={config.unit}
                decimals={config.decimals}
                timeWindowMs={windowMs}
              />
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
