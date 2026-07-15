import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { FarmEdge, FarmNode, NodeProps, NodeType } from '@/backend'
import {
  createEdge,
  createNode,
  deleteEdge,
  deleteNode,
  defaultPropsFor,
  getLayout,
  seedDefaultLayout,
  updateNode,
} from '@/backend'
import { useFarm } from '@/frontend/farm/FarmProvider'
import { useToast } from '@/shared/ui'

type LayoutContextValue = {
  nodes: FarmNode[]
  edges: FarmEdge[]
  loading: boolean
  addNode: (type: NodeType, x: number, y: number, label: string) => void
  moveNodeLocal: (id: string, x: number, y: number) => void
  persistNodePosition: (id: string, x: number, y: number) => void
  updateNodeFields: (id: string, patch: { label?: string; props?: NodeProps }) => void
  removeNode: (id: string) => Promise<void>
  addEdge: (source: string, target: string) => void
  removeEdge: (id: string) => Promise<void>
}

const LayoutContext = createContext<LayoutContextValue | null>(null)

export function LayoutProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { activeFarmId } = useFarm()

  const [nodes, setNodes] = useState<FarmNode[]>([])
  const [edges, setEdges] = useState<FarmEdge[]>([])
  const [loading, setLoading] = useState(true)
  const farmRef = useRef<string | null>(null)

  const reload = useCallback(async (farmId: string) => {
    const layout = await getLayout(farmId)
    setNodes(layout.nodes)
    setEdges(layout.edges)
  }, [])

  const fail = useCallback(
    (farmId: string) => {
      toast(t('twin.layout.saveFailed'), { kind: 'critical' })
      void reload(farmId).catch(() => {})
    },
    [reload, t, toast],
  )

  useEffect(() => {
    farmRef.current = activeFarmId
    if (!activeFarmId) {
      setNodes([])
      setEdges([])
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    getLayout(activeFarmId)
      .then(async (layout) => {
        if (!active) return
        if (layout.nodes.length === 0) {
          const seeded = await seedDefaultLayout(activeFarmId, {
            fish_tank: t('twin.nodes.fish_tank'),
            grow_bed: t('twin.nodes.grow_bed'),
            biofilter: t('twin.nodes.biofilter'),
            sump: t('twin.nodes.sump'),
            pump: t('twin.nodes.pump'),
          })
          if (!active) return
          setNodes(seeded.nodes)
          setEdges(seeded.edges)
        } else {
          setNodes(layout.nodes)
          setEdges(layout.edges)
        }
      })
      .catch(() => {
        if (active) {
          setNodes([])
          setEdges([])
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // Labels are only read at seed time; re-running on language change is unwanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFarmId])

  const addNode = useCallback(
    (type: NodeType, x: number, y: number, label: string) => {
      const farmId = farmRef.current
      if (!farmId) return
      const id = crypto.randomUUID()
      const props = defaultPropsFor(type)
      const optimistic: FarmNode = {
        id,
        farm_id: farmId,
        type,
        label,
        x,
        y,
        props,
        created_at: new Date().toISOString(),
      }
      setNodes((previous) => [...previous, optimistic])
      void createNode({ id, farm_id: farmId, type, label, x, y, props }).catch(() => fail(farmId))
    },
    [fail],
  )

  const moveNodeLocal = useCallback((id: string, x: number, y: number) => {
    setNodes((previous) => previous.map((node) => (node.id === id ? { ...node, x, y } : node)))
  }, [])

  const persistNodePosition = useCallback(
    (id: string, x: number, y: number) => {
      const farmId = farmRef.current
      if (!farmId) return
      void updateNode(id, { x, y }).catch(() => fail(farmId))
    },
    [fail],
  )

  const updateNodeFields = useCallback(
    (id: string, patch: { label?: string; props?: NodeProps }) => {
      const farmId = farmRef.current
      if (!farmId) return
      setNodes((previous) => previous.map((node) => (node.id === id ? { ...node, ...patch } : node)))
      void updateNode(id, patch).catch(() => fail(farmId))
    },
    [fail],
  )

  const removeNode = useCallback(
    async (id: string) => {
      const farmId = farmRef.current
      if (!farmId) return
      setNodes((previous) => previous.filter((node) => node.id !== id))
      setEdges((previous) =>
        previous.filter((edge) => edge.source_node !== id && edge.target_node !== id),
      )
      try {
        await deleteNode(id)
      } catch {
        fail(farmId)
      }
    },
    [fail],
  )

  const addEdge = useCallback(
    (source: string, target: string) => {
      const farmId = farmRef.current
      if (!farmId) return
      const id = crypto.randomUUID()
      const optimistic: FarmEdge = {
        id,
        farm_id: farmId,
        source_node: source,
        target_node: target,
        created_at: new Date().toISOString(),
      }
      setEdges((previous) => [...previous, optimistic])
      void createEdge({ id, farm_id: farmId, source_node: source, target_node: target }).catch(() =>
        fail(farmId),
      )
    },
    [fail],
  )

  const removeEdge = useCallback(
    async (id: string) => {
      const farmId = farmRef.current
      if (!farmId) return
      setEdges((previous) => previous.filter((edge) => edge.id !== id))
      try {
        await deleteEdge(id)
      } catch {
        fail(farmId)
      }
    },
    [fail],
  )

  const value: LayoutContextValue = {
    nodes,
    edges,
    loading,
    addNode,
    moveNodeLocal,
    persistNodePosition,
    updateNodeFields,
    removeNode,
    addEdge,
    removeEdge,
  }

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}

export function useLayout(): LayoutContextValue {
  const context = useContext(LayoutContext)
  if (!context) {
    throw new Error('useLayout must be used within LayoutProvider')
  }
  return context
}
