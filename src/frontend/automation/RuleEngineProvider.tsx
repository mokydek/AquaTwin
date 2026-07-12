import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { AutomationRule, Device } from '@/backend'
import { listDevices, listRules, setDeviceState, subscribeToDevices } from '@/backend'
import { useLiveReadings } from '@/frontend/data/LiveReadingsProvider'
import { useFarm } from '@/frontend/farm/FarmProvider'
import type { DeviceType } from '@/shared/config/aquaponics'
import { AUTOMATION_COOLDOWN_MS, SENSOR_DEADBAND } from '@/shared/config/aquaponics'
import { useToast } from '@/shared/ui'

type RuleState = { armed: boolean; lastActedAt: number }

type RuleEngineContextValue = {
  rules: AutomationRule[]
  refreshRules: () => Promise<void>
}

const RuleEngineContext = createContext<RuleEngineContextValue | null>(null)

/*
 * Safety model against chatter and manual fights:
 *  - Hysteresis: a fired rule only re arms after the value crosses back past the
 *    threshold by the sensor deadband, so a value hovering at the threshold does
 *    not toggle repeatedly.
 *  - Cooldown: after acting, a rule stays quiet for AUTOMATION_COOLDOWN_MS.
 *  - Device state guard: if the target device is already in the desired state,
 *    the rule does not act and logs nothing.
 * The engine only reacts to useLiveReadings (real stream). The what if twin uses
 * the pure model and never touches live readings, so it can never trigger a rule.
 */
export function RuleEngineProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { activeFarmId } = useFarm()
  const { latest } = useLiveReadings()

  const [rules, setRules] = useState<AutomationRule[]>([])
  const rulesRef = useRef<AutomationRule[]>([])
  const devicesRef = useRef<Map<DeviceType, Device>>(new Map())
  const ruleStateRef = useRef<Map<string, RuleState>>(new Map())
  const evaluateRef = useRef<() => void>(() => {})

  const refreshRules = useCallback(async () => {
    if (!activeFarmId) return
    try {
      const list = await listRules(activeFarmId)
      rulesRef.current = list
      setRules(list)
    } catch {
      // A refetch failure leaves the previous rules in place.
    }
  }, [activeFarmId])

  useEffect(() => {
    ruleStateRef.current = new Map()
    devicesRef.current = new Map()
    rulesRef.current = []
    setRules([])
    if (!activeFarmId) return
    let active = true
    void refreshRules()
    listDevices(activeFarmId)
      .then((list) => {
        if (!active) return
        const map = new Map<DeviceType, Device>()
        for (const device of list) map.set(device.type, device)
        devicesRef.current = map
      })
      .catch(() => {})
    const unsubscribe = subscribeToDevices(activeFarmId, (device) => {
      devicesRef.current.set(device.type, device)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [activeFarmId, refreshRules])

  // Keep the evaluation closure fresh (current readings, translations, farm).
  useEffect(() => {
    evaluateRef.current = () => {
      const farmId = activeFarmId
      if (!farmId || latest.size === 0) return
      const now = Date.now()

      for (const rule of rulesRef.current) {
        if (!rule.enabled) continue
        const value = latest.get(rule.sensor_type)
        if (value === undefined) continue

        const deadband = SENSOR_DEADBAND[rule.sensor_type]
        const conditionMet =
          rule.condition === 'above' ? value >= rule.threshold : value <= rule.threshold
        const reArmed =
          rule.condition === 'above'
            ? value <= rule.threshold - deadband
            : value >= rule.threshold + deadband

        const state = ruleStateRef.current.get(rule.id) ?? { armed: true, lastActedAt: 0 }

        if (!state.armed && reArmed) state.armed = true

        if (state.armed && conditionMet && now - state.lastActedAt >= AUTOMATION_COOLDOWN_MS) {
          const desiredOn = rule.action === 'turn_on'
          const device = devicesRef.current.get(rule.device_type)
          if (device) {
            state.armed = false
            if (device.is_on !== desiredOn) {
              state.lastActedAt = now
              const previous = device
              devicesRef.current.set(rule.device_type, { ...device, is_on: desiredOn })
              void setDeviceState(device.id, farmId, rule.device_type, desiredOn, 'rule', rule.id)
                .then((result) => {
                  if (result.ok) {
                    toast(
                      t(desiredOn ? 'automation.toast.turnedOn' : 'automation.toast.turnedOff', {
                        device: t(`devices.${rule.device_type}`),
                        rule: rule.name,
                      }),
                    )
                  } else {
                    devicesRef.current.set(rule.device_type, previous)
                  }
                })
                .catch(() => {
                  devicesRef.current.set(rule.device_type, previous)
                })
            }
          }
        }

        ruleStateRef.current.set(rule.id, state)
      }
    }
  })

  useEffect(() => {
    evaluateRef.current()
  }, [latest])

  const value = useMemo<RuleEngineContextValue>(() => ({ rules, refreshRules }), [rules, refreshRules])

  return <RuleEngineContext.Provider value={value}>{children}</RuleEngineContext.Provider>
}

export function useRuleEngine(): RuleEngineContextValue {
  const context = useContext(RuleEngineContext)
  if (!context) {
    throw new Error('useRuleEngine must be used within RuleEngineProvider')
  }
  return context
}
