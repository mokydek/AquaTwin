import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type { ReadingRow, Sensor } from '@/backend'
import { getReadings, listSensors, subscribeToReadings } from '@/backend'
import { useFarm } from '@/frontend/farm/FarmProvider'
import { useSimulator } from '@/frontend/simulator/SimulatorProvider'
import type { SensorType, Thresholds } from '@/shared/config/aquaponics'
import { SENSOR_TYPES } from '@/shared/config/aquaponics'
import type { LineChartPoint } from '@/shared/ui'

const LIVE_WINDOW_MS = 60 * 60 * 1000

type LiveReadingsValue = {
  bySensorType: Map<SensorType, LineChartPoint[]>
  latest: Map<SensorType, number>
  sensors: Sensor[]
  // Thresholds come from the farm's own sensor rows (editable in Settings), with
  // the config values as a fallback until the rows load.
  getThresholds: (type: SensorType) => Thresholds
  refreshSensors: () => Promise<void>
}

const LiveReadingsContext = createContext<LiveReadingsValue | null>(null)

export function LiveReadingsProvider({ children }: { children: ReactNode }) {
  const { activeFarmId } = useFarm()
  const { subscribeLocal } = useSimulator()
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [pointsById, setPointsById] = useState<Record<string, LineChartPoint[]>>({})

  const sensorKey = sensors.map((sensor) => sensor.id).join(',')

  useEffect(() => {
    if (!activeFarmId) {
      setSensors([])
      setPointsById({})
      return
    }
    let active = true
    setPointsById({})
    listSensors(activeFarmId)
      .then(async (list) => {
        if (!active) return
        setSensors(list)
        const ids = list.map((sensor) => sensor.id)
        const fromIso = new Date(Date.now() - LIVE_WINDOW_MS).toISOString()
        const grouped = await getReadings(ids, fromIso)
        if (!active) return
        const initial: Record<string, LineChartPoint[]> = {}
        for (const id of ids) {
          initial[id] = (grouped[id] ?? []).map((row) => ({
            t: Date.parse(row.recorded_at),
            value: row.value,
          }))
        }
        setPointsById(initial)
      })
      .catch(() => {
        if (!active) return
        setSensors([])
        setPointsById({})
      })
    return () => {
      active = false
    }
  }, [activeFarmId])

  const refreshSensors = useCallback(async () => {
    if (!activeFarmId) return
    try {
      const list = await listSensors(activeFarmId)
      setSensors(list)
    } catch {
      // Keep the current sensors if the refetch fails.
    }
  }, [activeFarmId])

  const appendReadings = useCallback((rows: ReadingRow[]) => {
    const cutoff = Date.now() - LIVE_WINDOW_MS
    setPointsById((previous) => {
      let changed = false
      const next = { ...previous }
      for (const row of rows) {
        const arr = next[row.sensor_id]
        if (!arr) continue
        const time = Date.parse(row.recorded_at)
        if (arr.length > 0 && time <= arr[arr.length - 1].t) continue
        next[row.sensor_id] = [...arr, { t: time, value: row.value }].filter((p) => p.t >= cutoff)
        changed = true
      }
      return changed ? next : previous
    })
  }, [])

  useEffect(() => {
    if (sensors.length === 0) return
    const ids = sensors.map((sensor) => sensor.id)
    const unsubscribeRealtime = subscribeToReadings(ids, (reading) => appendReadings([reading]))
    const unsubscribeLocal = subscribeLocal((readings) => appendReadings(readings))
    return () => {
      unsubscribeRealtime()
      unsubscribeLocal()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensorKey, appendReadings, subscribeLocal])

  // Age out points beyond the window even when no new data arrives.
  useEffect(() => {
    const id = window.setInterval(() => {
      const cutoff = Date.now() - LIVE_WINDOW_MS
      setPointsById((previous) => {
        let changed = false
        const next: Record<string, LineChartPoint[]> = {}
        for (const key of Object.keys(previous)) {
          const arr = previous[key]
          const filtered = arr.filter((p) => p.t >= cutoff)
          next[key] = filtered
          if (filtered.length !== arr.length) changed = true
        }
        return changed ? next : previous
      })
    }, 60000)
    return () => window.clearInterval(id)
  }, [])

  const thresholdsByType = useMemo(() => {
    const map = new Map<SensorType, Thresholds>()
    for (const sensor of sensors) {
      map.set(sensor.type, {
        warnLow: sensor.warn_low,
        warnHigh: sensor.warn_high,
        critLow: sensor.crit_low,
        critHigh: sensor.crit_high,
      })
    }
    return map
  }, [sensors])

  const getThresholds = useCallback(
    (type: SensorType): Thresholds => thresholdsByType.get(type) ?? SENSOR_TYPES[type].thresholds,
    [thresholdsByType],
  )

  const value = useMemo<LiveReadingsValue>(() => {
    const bySensorType = new Map<SensorType, LineChartPoint[]>()
    const latest = new Map<SensorType, number>()
    for (const sensor of sensors) {
      const arr = pointsById[sensor.id] ?? []
      bySensorType.set(sensor.type, arr)
      if (arr.length > 0) latest.set(sensor.type, arr[arr.length - 1].value)
    }
    return { bySensorType, latest, sensors, getThresholds, refreshSensors }
  }, [pointsById, sensors, getThresholds, refreshSensors])

  return <LiveReadingsContext.Provider value={value}>{children}</LiveReadingsContext.Provider>
}

export function useLiveReadings(): LiveReadingsValue {
  const context = useContext(LiveReadingsContext)
  if (!context) {
    throw new Error('useLiveReadings must be used within LiveReadingsProvider')
  }
  return context
}
