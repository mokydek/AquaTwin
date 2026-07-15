import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { Sensor } from '@/backend'
import { getLayout, insertReadings, listBatches, listEvents, listSensors } from '@/backend'
import { useFarm } from '@/frontend/farm/FarmProvider'
import {
  generateHistory as buildHistory,
  nextValue,
  setpointFor,
  type SimReading,
} from '@/frontend/simulator/engine'
import type { SensorType } from '@/shared/config/aquaponics'
import { SENSOR_TYPE_LIST } from '@/shared/config/aquaponics'
import { computeLoadFactor, totalBiomassKg } from '@/shared/lib/biomass'
import { useToast } from '@/shared/ui'

type Anomalies = Record<SensorType, boolean>

type SimulatorContextValue = {
  running: boolean
  start: () => void
  stop: () => void
  tick: number
  anomalies: Anomalies
  toggleAnomaly: (type: SensorType) => void
  generating: boolean
  generateHistory: () => Promise<void>
  subscribeLocal: (callback: (readings: SimReading[]) => void) => () => void
}

const SimulatorContext = createContext<SimulatorContextValue | null>(null)

function emptyAnomalies(): Anomalies {
  return SENSOR_TYPE_LIST.reduce((accumulator, type) => {
    accumulator[type] = false
    return accumulator
  }, {} as Anomalies)
}

const TICK_MS = 3000

export function SimulatorProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { activeFarmId } = useFarm()

  const [sensors, setSensors] = useState<Sensor[]>([])
  const [running, setRunning] = useState(false)
  const [tick, setTick] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [anomalies, setAnomalies] = useState<Anomalies>(emptyAnomalies)

  const sensorsRef = useRef<Sensor[]>([])
  const anomaliesRef = useRef<Anomalies>(anomalies)
  const valuesRef = useRef<Map<string, number>>(new Map())
  const listenersRef = useRef<Set<(readings: SimReading[]) => void>>(new Set())
  const intervalRef = useRef<number | null>(null)
  const tickFnRef = useRef<() => Promise<void>>(async () => {})
  const loadFactorRef = useRef(1)
  const farmIdRef = useRef<string | null>(activeFarmId)

  useEffect(() => {
    farmIdRef.current = activeFarmId
  }, [activeFarmId])

  useEffect(() => {
    sensorsRef.current = sensors
  }, [sensors])

  // Derive the fish load from the real stock and tank volumes, so a heavier stock
  // drives ammonia up and oxygen down in the simulated stream.
  const refreshLoadFactor = useCallback(async (farmId: string | null) => {
    if (!farmId) {
      loadFactorRef.current = 1
      return
    }
    try {
      const [layout, batches, events] = await Promise.all([
        getLayout(farmId),
        listBatches(farmId),
        listEvents(farmId, 500),
      ])
      const totalVolumeL = layout.nodes
        .filter((node) => node.type === 'fish_tank')
        .reduce((sum, node) => sum + (node.props.volumeL ?? 0), 0)
      loadFactorRef.current = computeLoadFactor(totalBiomassKg(batches, events), totalVolumeL)
    } catch {
      loadFactorRef.current = 1
    }
  }, [])

  useEffect(() => {
    anomaliesRef.current = anomalies
  }, [anomalies])

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setRunning(false)
  }, [])

  // Load the active farm's sensors and reset simulator state on farm change.
  useEffect(() => {
    stop()
    setAnomalies(emptyAnomalies())
    valuesRef.current = new Map()
    if (!activeFarmId) {
      setSensors([])
      return
    }
    let active = true
    void refreshLoadFactor(activeFarmId)
    listSensors(activeFarmId)
      .then((list) => {
        if (!active) return
        setSensors(list)
        const values = new Map<string, number>()
        for (const sensor of list) values.set(sensor.id, setpointFor(sensor.type))
        valuesRef.current = values
      })
      .catch(() => {
        if (active) setSensors([])
      })
    return () => {
      active = false
    }
  }, [activeFarmId, stop, refreshLoadFactor])

  // Keep the tick closure fresh so the interval always sees current deps.
  useEffect(() => {
    tickFnRef.current = async () => {
      const currentSensors = sensorsRef.current
      if (currentSensors.length === 0) return
      const recorded_at = new Date().toISOString()
      const readings: SimReading[] = currentSensors.map((sensor) => {
        const current = valuesRef.current.get(sensor.id) ?? setpointFor(sensor.type)
        const value = nextValue(
          sensor.type,
          current,
          anomaliesRef.current[sensor.type],
          loadFactorRef.current,
        )
        valuesRef.current.set(sensor.id, value)
        return { sensor_id: sensor.id, value, recorded_at }
      })

      for (const listener of listenersRef.current) listener(readings)
      setTick((previous) => previous + 1)

      try {
        await insertReadings(readings)
      } catch {
        stop()
        toast(t('app.simulator.error'), { kind: 'critical' })
      }
    }
  })

  const start = useCallback(() => {
    if (intervalRef.current !== null) return
    void refreshLoadFactor(farmIdRef.current)
    setRunning(true)
    void tickFnRef.current()
    intervalRef.current = window.setInterval(() => {
      void tickFnRef.current()
    }, TICK_MS)
  }, [refreshLoadFactor])

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

  const toggleAnomaly = useCallback((type: SensorType) => {
    setAnomalies((previous) => ({ ...previous, [type]: !previous[type] }))
  }, [])

  const generateHistory = useCallback(async () => {
    const currentSensors = sensorsRef.current
    if (currentSensors.length === 0) return
    setGenerating(true)
    try {
      const rows = buildHistory(
        currentSensors.map((sensor) => ({ id: sensor.id, type: sensor.type })),
        Date.now(),
        24,
        5,
        loadFactorRef.current,
      )
      await insertReadings(rows)
      toast(t('app.simulator.historyDone'))
    } catch {
      toast(t('app.simulator.error'), { kind: 'critical' })
    } finally {
      setGenerating(false)
    }
  }, [t, toast])

  const subscribeLocal = useCallback((callback: (readings: SimReading[]) => void) => {
    listenersRef.current.add(callback)
    return () => {
      listenersRef.current.delete(callback)
    }
  }, [])

  const value = useMemo<SimulatorContextValue>(
    () => ({
      running,
      start,
      stop,
      tick,
      anomalies,
      toggleAnomaly,
      generating,
      generateHistory,
      subscribeLocal,
    }),
    [running, start, stop, tick, anomalies, toggleAnomaly, generating, generateHistory, subscribeLocal],
  )

  return <SimulatorContext.Provider value={value}>{children}</SimulatorContext.Provider>
}

export function useSimulator(): SimulatorContextValue {
  const context = useContext(SimulatorContext)
  if (!context) {
    throw new Error('useSimulator must be used within SimulatorProvider')
  }
  return context
}
