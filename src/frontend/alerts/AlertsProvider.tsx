import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { Alert } from '@/backend'
import { acknowledgeAlert, listActiveAlerts, subscribeToAlerts } from '@/backend'
import { alertToastText } from '@/frontend/alerts/format'
import { useFarm } from '@/frontend/farm/FarmProvider'
import { useToast } from '@/shared/ui'

type AlertsContextValue = {
  active: Alert[]
  acknowledge: (id: string) => Promise<void>
  unacknowledgedCount: number
}

const AlertsContext = createContext<AlertsContextValue | null>(null)

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { activeFarmId } = useFarm()
  const [active, setActive] = useState<Alert[]>([])
  const seenRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!activeFarmId) {
      setActive([])
      seenRef.current = new Set()
      return
    }
    let live = true
    seenRef.current = new Set()

    listActiveAlerts(activeFarmId)
      .then((list) => {
        if (!live) return
        for (const alert of list) seenRef.current.add(alert.id)
        setActive(list)
      })
      .catch(() => {
        if (live) setActive([])
      })

    const unsubscribe = subscribeToAlerts(activeFarmId, (change) => {
      if (change.type === 'INSERT') {
        if (!seenRef.current.has(change.alert.id)) {
          seenRef.current.add(change.alert.id)
          toast(alertToastText(change.alert, t), {
            kind: change.alert.severity === 'critical' ? 'critical' : 'default',
          })
        }
        setActive((previous) =>
          previous.some((alert) => alert.id === change.alert.id)
            ? previous
            : [change.alert, ...previous],
        )
      } else if (change.alert.resolved_at) {
        setActive((previous) => previous.filter((alert) => alert.id !== change.alert.id))
      } else {
        setActive((previous) =>
          previous.map((alert) => (alert.id === change.alert.id ? change.alert : alert)),
        )
      }
    })

    return () => {
      live = false
      unsubscribe()
    }
  }, [activeFarmId, t, toast])

  const acknowledge = useCallback(async (id: string) => {
    setActive((previous) =>
      previous.map((alert) => (alert.id === id ? { ...alert, acknowledged: true } : alert)),
    )
    try {
      await acknowledgeAlert(id)
    } catch {
      setActive((previous) =>
        previous.map((alert) => (alert.id === id ? { ...alert, acknowledged: false } : alert)),
      )
    }
  }, [])

  const value = useMemo<AlertsContextValue>(
    () => ({
      active,
      acknowledge,
      unacknowledgedCount: active.filter((alert) => !alert.acknowledged).length,
    }),
    [active, acknowledge],
  )

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
}

export function useAlerts(): AlertsContextValue {
  const context = useContext(AlertsContext)
  if (!context) {
    throw new Error('useAlerts must be used within AlertsProvider')
  }
  return context
}
