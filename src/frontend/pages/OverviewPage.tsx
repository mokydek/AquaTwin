import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Device, Sensor } from '@/backend'
import { listDevices, listSensors, setDeviceState } from '@/backend'
import { useFarm } from '@/frontend/farm/FarmProvider'
import { cn } from '@/shared/lib/cn'
import { DEVICE_TYPE_LIST, SENSOR_TYPE_LIST } from '@/shared/config/aquaponics'
import { Badge, Card, PageHeader, Skeleton, Switch } from '@/shared/ui'
import { useToast } from '@/shared/ui'

function byOrder<T extends { type: string }>(items: T[], order: readonly string[]): T[] {
  return [...items].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
}

function SensorSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-24 w-full" />
      ))}
    </div>
  )
}

export default function OverviewPage() {
  const { t } = useTranslation()
  const { activeFarm, activeFarmId } = useFarm()
  const { toast } = useToast()
  const [sensors, setSensors] = useState<Sensor[] | null>(null)
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null)

  useEffect(() => {
    if (!activeFarmId) return
    let active = true
    setSensors(null)
    setDevices(null)
    Promise.all([listSensors(activeFarmId), listDevices(activeFarmId)])
      .then(([loadedSensors, loadedDevices]) => {
        if (!active) return
        setSensors(loadedSensors)
        setDevices(loadedDevices)
      })
      .catch(() => {
        if (!active) return
        setSensors([])
        setDevices([])
      })
    return () => {
      active = false
    }
  }, [activeFarmId])

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

  const orderedSensors = sensors ? byOrder(sensors, SENSOR_TYPE_LIST) : null
  const orderedDevices = devices ? byOrder(devices, DEVICE_TYPE_LIST) : null

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title={activeFarm?.name ?? ''} description={t('app.overview.description')} />

      <section className="flex flex-col gap-4">
        <h2 className="text-[11px] uppercase tracking-wider text-muted">
          {t('app.overview.sensors')}
        </h2>
        {orderedSensors === null ? (
          <SensorSkeleton />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orderedSensors.map((sensor) => (
              <Card key={sensor.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {t(`sensors.${sensor.type}`)}
                  </span>
                  <span className="font-mono text-xs text-muted">{sensor.unit}</span>
                </div>
                <Badge variant="neutral">{t('app.overview.noData')}</Badge>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-[11px] uppercase tracking-wider text-muted">
          {t('app.overview.devices')}
        </h2>
        {orderedDevices === null ? (
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
    </div>
  )
}
