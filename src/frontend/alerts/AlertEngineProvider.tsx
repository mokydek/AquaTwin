import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

import { createAlert, listActiveAlerts, resolveAlerts, updateAlertEta } from '@/backend'
import { useFarm } from '@/frontend/farm/FarmProvider'
import { useLiveReadings } from '@/frontend/data/LiveReadingsProvider'
import type { SensorType, Thresholds } from '@/shared/config/aquaponics'
import { SENSOR_TYPES } from '@/shared/config/aquaponics'
import { computeStatus } from '@/shared/lib/status'
import type { Status } from '@/shared/lib/status'
import type { LineChartPoint } from '@/shared/ui'
import { linearRegression, predictThresholdEta } from '@/shared/lib/trend'

const PREDICTION_INTERVAL_MS = 30_000
const PREDICTION_WINDOW_MS = 15 * 60 * 1000
const MIN_POINTS = 8
const MIN_SPAN_MS = 6 * 60 * 1000
const MIN_R2 = 0.5

// Slopes per minute below this magnitude are treated as noise, per sensor type.
const MIN_ABS_SLOPE: Record<SensorType, number> = {
  ph: 0.005,
  water_temp: 0.03,
  dissolved_oxygen: 0.02,
  ammonia: 0.004,
  nitrite: 0.004,
  nitrate: 0.8,
}

const PENDING = 'pending'

function thresholdKey(type: SensorType, severity: Status): string {
  return `${type}|threshold|${severity}`
}

function predictionKey(type: SensorType): string {
  return `${type}|prediction|warning`
}

function crossedBound(value: number, thresholds: Thresholds, severity: Status): number | null {
  if (severity === 'critical') {
    if (thresholds.critHigh !== null && value > thresholds.critHigh) return thresholds.critHigh
    if (thresholds.critLow !== null && value < thresholds.critLow) return thresholds.critLow
    return null
  }
  if (thresholds.warnHigh !== null && value > thresholds.warnHigh) return thresholds.warnHigh
  if (thresholds.warnLow !== null && value < thresholds.warnLow) return thresholds.warnLow
  return null
}

export function AlertEngineProvider({ children }: { children: ReactNode }) {
  const { activeFarmId } = useFarm()
  const { latest, bySensorType, sensors } = useLiveReadings()

  const lastStatusRef = useRef<Map<SensorType, Status>>(new Map())
  const managedRef = useRef<Map<string, string>>(new Map())
  const initializedRef = useRef(false)
  const bySensorTypeRef = useRef<Map<SensorType, LineChartPoint[]>>(bySensorType)
  const predictionFnRef = useRef<() => void>(() => {})

  useEffect(() => {
    bySensorTypeRef.current = bySensorType
  }, [bySensorType])

  // Reset and seed the managed set from existing active alerts on farm change.
  useEffect(() => {
    initializedRef.current = false
    lastStatusRef.current = new Map()
    managedRef.current = new Map()
    if (!activeFarmId) return
    let active = true
    listActiveAlerts(activeFarmId)
      .then((alerts) => {
        if (!active) return
        for (const alert of alerts) {
          managedRef.current.set(`${alert.sensor_type}|${alert.kind}|${alert.severity}`, alert.id)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [activeFarmId])

  // Threshold alerts: react to status transitions in the latest values.
  useEffect(() => {
    if (!activeFarmId || latest.size === 0) return

    if (!initializedRef.current) {
      for (const sensor of sensors) {
        const value = latest.get(sensor.type)
        if (value === undefined) continue
        lastStatusRef.current.set(
          sensor.type,
          computeStatus(value, SENSOR_TYPES[sensor.type].thresholds),
        )
      }
      initializedRef.current = true
      return
    }

    for (const sensor of sensors) {
      const value = latest.get(sensor.type)
      if (value === undefined) continue
      const thresholds = SENSOR_TYPES[sensor.type].thresholds
      const status = computeStatus(value, thresholds)
      const previous = lastStatusRef.current.get(sensor.type) ?? 'ok'
      if (status === previous) continue
      lastStatusRef.current.set(sensor.type, status)

      if (status === 'ok') {
        managedRef.current.delete(thresholdKey(sensor.type, 'warning'))
        managedRef.current.delete(thresholdKey(sensor.type, 'critical'))
        void resolveAlerts(activeFarmId, sensor.type, 'threshold').catch(() => {})
        continue
      }

      const key = thresholdKey(sensor.type, status)
      if (managedRef.current.has(key)) continue
      managedRef.current.set(key, PENDING)
      const bound = crossedBound(value, thresholds, status)
      void createAlert({
        farm_id: activeFarmId,
        sensor_type: sensor.type,
        kind: 'threshold',
        severity: status,
        value,
        threshold: bound,
      })
        .then((alert) => managedRef.current.set(key, alert.id))
        .catch(() => managedRef.current.delete(key))
    }
  }, [latest, sensors, activeFarmId])

  // Prediction alerts: evaluate trends on a fixed cadence.
  useEffect(() => {
    predictionFnRef.current = () => {
      if (!activeFarmId) return
      const cutoff = Date.now() - PREDICTION_WINDOW_MS

      for (const sensor of sensors) {
        const key = predictionKey(sensor.type)
        const points = (bySensorTypeRef.current.get(sensor.type) ?? []).filter((p) => p.t >= cutoff)

        const enoughData =
          points.length >= MIN_POINTS && points[points.length - 1].t - points[0].t >= MIN_SPAN_MS
        if (!enoughData) {
          clearPrediction(activeFarmId, sensor.type, key)
          continue
        }

        const { slopePerMinute, r2 } = linearRegression(points)
        if (r2 < MIN_R2 || Math.abs(slopePerMinute) < MIN_ABS_SLOPE[sensor.type]) {
          clearPrediction(activeFarmId, sensor.type, key)
          continue
        }

        const thresholds = SENSOR_TYPES[sensor.type].thresholds
        const current = points[points.length - 1].value
        const eta = predictThresholdEta(current, slopePerMinute, {
          warnLow: null,
          warnHigh: null,
          critLow: thresholds.critLow,
          critHigh: thresholds.critHigh,
        })

        if (!eta) {
          clearPrediction(activeFarmId, sensor.type, key)
          continue
        }

        const etaMinutes = Math.round(eta.etaMinutes)
        const existing = managedRef.current.get(key)
        if (existing) {
          if (existing !== PENDING) {
            void updateAlertEta(existing, etaMinutes, current).catch(() => {})
          }
        } else {
          managedRef.current.set(key, PENDING)
          void createAlert({
            farm_id: activeFarmId,
            sensor_type: sensor.type,
            kind: 'prediction',
            severity: 'warning',
            value: current,
            eta_minutes: etaMinutes,
          })
            .then((alert) => managedRef.current.set(key, alert.id))
            .catch(() => managedRef.current.delete(key))
        }
      }
    }

    function clearPrediction(farmId: string, type: SensorType, key: string) {
      if (managedRef.current.has(key)) {
        managedRef.current.delete(key)
        void resolveAlerts(farmId, type, 'prediction').catch(() => {})
      }
    }
  })

  useEffect(() => {
    const id = window.setInterval(() => predictionFnRef.current(), PREDICTION_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [])

  return <>{children}</>
}
