import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type { Farm } from '@/backend'
import { createFarmWithDefaults, listFarms } from '@/backend'

const STORAGE_KEY = 'aquatwin.farm'

type FarmContextValue = {
  farms: Farm[]
  activeFarm: Farm | null
  activeFarmId: string | null
  setActiveFarmId: (id: string) => void
  refreshFarms: () => Promise<void>
  creating: boolean
  createFarm: (name: string) => Promise<Farm | null>
  loading: boolean
}

const FarmContext = createContext<FarmContextValue | null>(null)

function reconcileActiveId(list: Farm[], preferred: string | null): string | null {
  if (preferred && list.some((farm) => farm.id === preferred)) return preferred
  return list[0]?.id ?? null
}

export function FarmProvider({ children }: { children: ReactNode }) {
  const [farms, setFarms] = useState<Farm[]>([])
  const [activeFarmId, setActiveFarmIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const setActiveFarmId = useCallback((id: string) => {
    setActiveFarmIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }, [])

  const applyList = useCallback((list: Farm[]) => {
    setFarms(list)
    setActiveFarmIdState((previous) => {
      const stored = previous ?? localStorage.getItem(STORAGE_KEY)
      const next = reconcileActiveId(list, stored)
      if (next) localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  const refreshFarms = useCallback(async () => {
    const list = await listFarms()
    applyList(list)
  }, [applyList])

  useEffect(() => {
    let active = true
    listFarms()
      .then((list) => {
        if (!active) return
        applyList(list)
      })
      .catch(() => {
        if (!active) return
        setFarms([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [applyList])

  const createFarm = useCallback(
    async (name: string): Promise<Farm | null> => {
      setCreating(true)
      try {
        const farm = await createFarmWithDefaults(name)
        const list = await listFarms()
        setFarms(list)
        setActiveFarmId(farm.id)
        return farm
      } catch {
        return null
      } finally {
        setCreating(false)
      }
    },
    [setActiveFarmId],
  )

  const value = useMemo<FarmContextValue>(
    () => ({
      farms,
      activeFarm: farms.find((farm) => farm.id === activeFarmId) ?? null,
      activeFarmId,
      setActiveFarmId,
      refreshFarms,
      creating,
      createFarm,
      loading,
    }),
    [farms, activeFarmId, setActiveFarmId, refreshFarms, creating, createFarm, loading],
  )

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>
}

export function useFarm(): FarmContextValue {
  const context = useContext(FarmContext)
  if (!context) {
    throw new Error('useFarm must be used within FarmProvider')
  }
  return context
}
