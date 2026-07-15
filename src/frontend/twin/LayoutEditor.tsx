import { Link } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { NodeProps, NodeType } from '@/backend'
import { assignSensorToNode, NODE_PROP_FIELD, NODE_PROP_UNIT, NODE_TYPES } from '@/backend'
import { useLiveReadings } from '@/frontend/data/LiveReadingsProvider'
import { useLayout } from '@/frontend/twin/LayoutProvider'
import {
  CANVAS_H,
  CANVAS_W,
  clampX,
  clampY,
  GRID,
  MAX_NODES,
  NODE_H,
  NODE_ICONS,
  NODE_W,
  snap,
} from '@/frontend/twin/nodeConfig'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  FormField,
  Input,
  Select,
  useDialog,
  useToast,
} from '@/shared/ui'

type Selection = { kind: 'node'; id: string } | { kind: 'edge'; id: string } | null

type DragState = {
  id: string
  offsetX: number
  offsetY: number
  startClientX: number
  startClientY: number
  moved: boolean
  x: number
  y: number
}

export function LayoutEditor() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { nodes, edges, addNode, moveNodeLocal, persistNodePosition, updateNodeFields, removeNode, addEdge, removeEdge } =
    useLayout()
  const { sensors, refreshSensors } = useLiveReadings()
  const deleteDialog = useDialog()

  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<DragState | null>(null)

  const [armedType, setArmedType] = useState<NodeType | null>(null)
  const [connectMode, setConnectMode] = useState(false)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection>(null)
  const [hint, setHint] = useState<string | null>(null)

  const [labelDraft, setLabelDraft] = useState('')
  const [propDraft, setPropDraft] = useState('')

  const selectedNode = selection?.kind === 'node' ? nodes.find((n) => n.id === selection.id) ?? null : null
  const selectedEdge = selection?.kind === 'edge' ? edges.find((e) => e.id === selection.id) ?? null : null
  const atCap = nodes.length >= MAX_NODES

  useEffect(() => {
    if (!selectedNode) return
    setLabelDraft(selectedNode.label)
    const field = NODE_PROP_FIELD[selectedNode.type]
    const value = selectedNode.props[field]
    setPropDraft(value === undefined ? '' : String(value))
  }, [selectedNode])

  function reset() {
    setArmedType(null)
    setConnectMode(false)
    setConnectFrom(null)
    setSelection(null)
    setHint(null)
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') reset()
      if ((event.key === 'Delete' || event.key === 'Backspace') && selection) {
        const target = event.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return
        event.preventDefault()
        deleteDialog.open()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection, deleteDialog])

  function toSvg(event: ReactPointerEvent): { x: number; y: number } {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_H,
    }
  }

  function defaultLabel(type: NodeType): string {
    const count = nodes.filter((node) => node.type === type).length
    const base = t(`twin.nodes.${type}`)
    return count === 0 ? base : `${base} ${count + 1}`
  }

  function placeAt(event: ReactPointerEvent) {
    if (!armedType || atCap) return
    const point = toSvg(event)
    const x = clampX(snap(point.x - NODE_W / 2))
    const y = clampY(snap(point.y - NODE_H / 2))
    addNode(armedType, x, y, defaultLabel(armedType))
    setArmedType(null)
  }

  function onBackgroundPointerDown(event: ReactPointerEvent) {
    if (armedType) {
      placeAt(event)
      return
    }
    setSelection(null)
    setConnectFrom(null)
  }

  function handleConnect(nodeId: string) {
    setHint(null)
    if (connectFrom === null) {
      setConnectFrom(nodeId)
      return
    }
    if (connectFrom === nodeId) {
      setHint('twin.layout.hintSelfLoop')
      return
    }
    if (edges.some((edge) => edge.source_node === connectFrom && edge.target_node === nodeId)) {
      setHint('twin.layout.hintDuplicate')
      setConnectFrom(null)
      return
    }
    addEdge(connectFrom, nodeId)
    setConnectFrom(null)
  }

  function onNodePointerDown(event: ReactPointerEvent, nodeId: string) {
    event.stopPropagation()
    if (armedType) {
      placeAt(event)
      return
    }
    if (connectMode) {
      handleConnect(nodeId)
      return
    }
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    const point = toSvg(event)
    dragRef.current = {
      id: nodeId,
      offsetX: point.x - node.x,
      offsetY: point.y - node.y,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
      x: node.x,
      y: node.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onNodePointerMove(event: ReactPointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    if (!drag.moved) {
      const distance = Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY)
      if (distance < 4) return
      drag.moved = true
    }
    const point = toSvg(event)
    const x = clampX(snap(point.x - drag.offsetX))
    const y = clampY(snap(point.y - drag.offsetY))
    drag.x = x
    drag.y = y
    moveNodeLocal(drag.id, x, y)
  }

  function onNodePointerUp() {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (drag.moved) {
      persistNodePosition(drag.id, drag.x, drag.y)
    } else {
      setSelection({ kind: 'node', id: drag.id })
    }
  }

  function commitLabel() {
    if (selectedNode && labelDraft.trim().length > 0 && labelDraft !== selectedNode.label) {
      updateNodeFields(selectedNode.id, { label: labelDraft.trim() })
    } else if (selectedNode) {
      setLabelDraft(selectedNode.label)
    }
  }

  function commitProp() {
    if (!selectedNode) return
    const field = NODE_PROP_FIELD[selectedNode.type]
    const parsed = Number(propDraft)
    if (propDraft.trim() === '' || !Number.isFinite(parsed) || parsed < 0) {
      setPropDraft(String(selectedNode.props[field] ?? ''))
      return
    }
    const props: NodeProps = { ...selectedNode.props, [field]: parsed }
    updateNodeFields(selectedNode.id, { props })
  }

  async function handleAssign(sensorId: string, nodeId: string) {
    try {
      await assignSensorToNode(sensorId, nodeId === '' ? null : nodeId)
      await refreshSensors()
    } catch {
      toast(t('twin.layout.saveFailed'), { kind: 'critical' })
    }
  }

  async function confirmDelete() {
    if (selection?.kind === 'node') {
      await removeNode(selection.id)
      await refreshSensors()
    } else if (selection?.kind === 'edge') {
      await removeEdge(selection.id)
    }
    setSelection(null)
    deleteDialog.close()
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-3 lg:col-span-2">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {NODE_TYPES.map((type) => {
              const Icon = NODE_ICONS[type]
              return (
                <Button
                  key={type}
                  variant="secondary"
                  size="sm"
                  leftIcon={Icon}
                  disabled={atCap}
                  aria-pressed={armedType === type}
                  onClick={() => {
                    setArmedType((current) => (current === type ? null : type))
                    setConnectMode(false)
                    setConnectFrom(null)
                  }}
                  className={armedType === type ? 'border-foreground' : undefined}
                >
                  {t(`twin.nodes.${type}`)}
                </Button>
              )
            })}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={Link}
              aria-pressed={connectMode}
              onClick={() => {
                setConnectMode((current) => !current)
                setArmedType(null)
                setConnectFrom(null)
                setHint(null)
              }}
              className={connectMode ? 'text-foreground' : undefined}
            >
              {t('twin.layout.connect')}
            </Button>
          </div>
          <p className="text-[11px] text-muted">
            {atCap
              ? t('twin.layout.capReached', { max: MAX_NODES })
              : connectMode
                ? t('twin.layout.connectHint')
                : armedType
                  ? t('twin.layout.placeHint')
                  : (hint ?? t('twin.layout.editorHint'))}
          </p>
        </div>

        <Card className="p-2">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            className="h-auto w-full touch-none select-none"
            role="group"
            aria-label={t('twin.layout.tab')}
          >
            <defs>
              <pattern id="twin-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                <circle cx={1} cy={1} r={1} fill="var(--color-border)" />
              </pattern>
              <marker id="twin-edit-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M0,0 L6,3 L0,6 z" fill="var(--color-foreground)" />
              </marker>
            </defs>

            <rect
              width={CANVAS_W}
              height={CANVAS_H}
              fill="url(#twin-grid)"
              onPointerDown={onBackgroundPointerDown}
            />

            {edges.map((edge) => {
              const source = nodeById.get(edge.source_node)
              const target = nodeById.get(edge.target_node)
              if (!source || !target) return null
              const x1 = source.x + NODE_W / 2
              const y1 = source.y + NODE_H / 2
              const x2 = target.x + NODE_W / 2
              const y2 = target.y + NODE_H / 2
              const isSelected = selection?.kind === 'edge' && selection.id === edge.id
              return (
                <g key={edge.id}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isSelected ? 'var(--color-foreground)' : 'var(--color-border)'}
                    strokeWidth={isSelected ? 2 : 1.5}
                    markerEnd="url(#twin-edit-arrow)"
                  />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth={12}
                    className="cursor-pointer"
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      if (!armedType && !connectMode) setSelection({ kind: 'edge', id: edge.id })
                    }}
                  />
                </g>
              )
            })}

            {nodes.map((node) => {
              const highlighted =
                (selection?.kind === 'node' && selection.id === node.id) || connectFrom === node.id
              return (
                <g
                  key={node.id}
                  className="cursor-pointer outline-none"
                  onPointerDown={(event) => onNodePointerDown(event, node.id)}
                  onPointerMove={onNodePointerMove}
                  onPointerUp={onNodePointerUp}
                >
                  <rect
                    x={node.x}
                    y={node.y}
                    width={NODE_W}
                    height={NODE_H}
                    rx={2}
                    fill="var(--color-background)"
                    stroke={highlighted ? 'var(--color-foreground)' : 'var(--color-border)'}
                    strokeWidth={highlighted ? 2 : 1}
                  />
                  <text
                    x={node.x + NODE_W / 2}
                    y={node.y + NODE_H / 2 + 4}
                    textAnchor="middle"
                    fontSize={12}
                    fill="var(--color-foreground)"
                  >
                    {node.label}
                  </text>
                </g>
              )
            })}
          </svg>
        </Card>
      </div>

      <Card>
        {selectedNode ? (
          <>
            <CardHeader title={t('twin.layout.nodeDetails')} />
            <CardContent className="flex flex-col gap-4">
              <FormField label={t('twin.layout.label')} htmlFor="node-label">
                <Input
                  id="node-label"
                  value={labelDraft}
                  onChange={(event) => setLabelDraft(event.target.value)}
                  onBlur={commitLabel}
                />
              </FormField>

              <FormField
                label={t(`twin.layout.prop.${NODE_PROP_FIELD[selectedNode.type]}`)}
                htmlFor="node-prop"
              >
                <div className="flex items-center gap-2">
                  <Input
                    id="node-prop"
                    type="number"
                    className="font-mono tabular-nums"
                    value={propDraft}
                    onChange={(event) => setPropDraft(event.target.value)}
                    onBlur={commitProp}
                  />
                  <span className="font-mono text-xs text-muted">
                    {NODE_PROP_UNIT[NODE_PROP_FIELD[selectedNode.type]]}
                  </span>
                </div>
              </FormField>

              <div className="flex flex-col gap-2">
                <span className="text-[11px] uppercase tracking-wider text-muted">
                  {t('twin.layout.sensors')}
                </span>
                {sensors.map((sensor) => (
                  <div key={sensor.id} className="flex items-center justify-between gap-2">
                    <span className="text-[13px] text-foreground">{t(`sensors.${sensor.type}`)}</span>
                    <div className="w-40">
                      <Select
                        aria-label={t(`sensors.${sensor.type}`)}
                        value={sensor.node_id ?? ''}
                        onChange={(event) => handleAssign(sensor.id, event.target.value)}
                      >
                        <option value="">{t('twin.layout.unassigned')}</option>
                        {nodes.map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <Button variant="secondary" size="sm" onClick={deleteDialog.open}>
                  {t('twin.layout.deleteNode')}
                </Button>
              </div>
            </CardContent>
          </>
        ) : selectedEdge ? (
          <>
            <CardHeader title={t('twin.layout.edgeDetails')} />
            <CardContent className="flex flex-col gap-4">
              <p className="text-[13px] text-muted">
                {t('twin.layout.edgeFromTo', {
                  from: nodeById.get(selectedEdge.source_node)?.label ?? '',
                  to: nodeById.get(selectedEdge.target_node)?.label ?? '',
                })}
              </p>
              <div>
                <Button variant="secondary" size="sm" onClick={deleteDialog.open}>
                  {t('twin.layout.deleteEdge')}
                </Button>
              </div>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader title={t('twin.layout.nodeDetails')} />
            <CardContent>
              <p className="text-[13px] text-muted">{t('twin.layout.selectHint')}</p>
            </CardContent>
          </>
        )}
      </Card>

      <Dialog ref={deleteDialog.ref}>
        <DialogTitle>
          {selection?.kind === 'edge' ? t('twin.layout.deleteEdge') : t('twin.layout.deleteNode')}
        </DialogTitle>
        <DialogDescription>
          {selection?.kind === 'edge'
            ? t('twin.layout.deleteEdgeBody')
            : t('twin.layout.deleteNodeBody', { label: selectedNode?.label ?? '' })}
        </DialogDescription>
        <DialogFooter>
          <Button variant="secondary" onClick={deleteDialog.close}>
            {t('twin.layout.cancel')}
          </Button>
          <Button onClick={confirmDelete}>{t('twin.layout.confirmDelete')}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
