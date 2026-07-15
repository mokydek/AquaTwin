import { supabase } from '@/backend/client'
import { BackendError } from '@/backend/errors'
import type { Database, FarmEdge, FarmNode, NodeProps, NodeType } from '@/backend/types'

type NodeInsert = Database['public']['Tables']['farm_nodes']['Insert']
type NodeUpdate = Database['public']['Tables']['farm_nodes']['Update']
type EdgeInsert = Database['public']['Tables']['farm_edges']['Insert']

export type Layout = { nodes: FarmNode[]; edges: FarmEdge[] }

export const NODE_TYPES: NodeType[] = ['fish_tank', 'grow_bed', 'biofilter', 'sump', 'pump']

// Each node type carries exactly one numeric prop, with a fixed unit.
export const NODE_PROP_FIELD: Record<NodeType, keyof NodeProps> = {
  fish_tank: 'volumeL',
  grow_bed: 'areaM2',
  biofilter: 'volumeL',
  sump: 'volumeL',
  pump: 'flowLph',
}

export const NODE_PROP_UNIT: Record<keyof NodeProps, string> = {
  volumeL: 'L',
  areaM2: 'm²',
  flowLph: 'L/h',
}

const DEFAULT_PROPS: Record<NodeType, NodeProps> = {
  fish_tank: { volumeL: 1000 },
  grow_bed: { areaM2: 4 },
  biofilter: { volumeL: 200 },
  sump: { volumeL: 300 },
  pump: { flowLph: 1000 },
}

export function defaultPropsFor(type: NodeType): NodeProps {
  return { ...DEFAULT_PROPS[type] }
}

export async function getLayout(farmId: string): Promise<Layout> {
  const [nodesResult, edgesResult] = await Promise.all([
    supabase.from('farm_nodes').select('*').eq('farm_id', farmId).order('created_at', { ascending: true }),
    supabase.from('farm_edges').select('*').eq('farm_id', farmId).order('created_at', { ascending: true }),
  ])
  if (nodesResult.error) throw new BackendError(nodesResult.error.message, nodesResult.error.code)
  if (edgesResult.error) throw new BackendError(edgesResult.error.message, edgesResult.error.code)
  return { nodes: nodesResult.data, edges: edgesResult.data }
}

export async function createNode(row: NodeInsert): Promise<FarmNode> {
  const { data, error } = await supabase.from('farm_nodes').insert(row).select().single()
  if (error) throw new BackendError(error.message, error.code)
  return data
}

export async function updateNode(id: string, patch: NodeUpdate): Promise<FarmNode> {
  const { data, error } = await supabase
    .from('farm_nodes')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new BackendError(error.message, error.code)
  return data
}

export async function deleteNode(id: string): Promise<void> {
  const { error } = await supabase.from('farm_nodes').delete().eq('id', id)
  if (error) throw new BackendError(error.message, error.code)
}

export async function createEdge(row: EdgeInsert): Promise<FarmEdge> {
  const { data, error } = await supabase.from('farm_edges').insert(row).select().single()
  if (error) throw new BackendError(error.message, error.code)
  return data
}

export async function deleteEdge(id: string): Promise<void> {
  const { error } = await supabase.from('farm_edges').delete().eq('id', id)
  if (error) throw new BackendError(error.message, error.code)
}

export async function assignSensorToNode(sensorId: string, nodeId: string | null): Promise<void> {
  const { error } = await supabase.from('sensors').update({ node_id: nodeId }).eq('id', sensorId)
  if (error) throw new BackendError(error.message, error.code)
}

// The classic loop, matching the layout users saw before this phase. Called once
// per farm when the layout is empty (self migrating backfill).
export async function seedDefaultLayout(
  farmId: string,
  labels: Record<NodeType, string>,
): Promise<Layout> {
  const nodeDefs: { type: NodeType; x: number; y: number }[] = [
    { type: 'fish_tank', x: 40, y: 40 },
    { type: 'pump', x: 40, y: 140 },
    { type: 'sump', x: 40, y: 240 },
    { type: 'biofilter', x: 300, y: 40 },
    { type: 'grow_bed', x: 300, y: 240 },
  ]
  const nodeRows: NodeInsert[] = nodeDefs.map((def) => ({
    farm_id: farmId,
    type: def.type,
    label: labels[def.type],
    x: def.x,
    y: def.y,
    props: defaultPropsFor(def.type),
  }))
  const { data: nodes, error: nodeError } = await supabase.from('farm_nodes').insert(nodeRows).select()
  if (nodeError) throw new BackendError(nodeError.message, nodeError.code)

  const idByType = new Map(nodes.map((node) => [node.type, node.id]))
  const pairs: [NodeType, NodeType][] = [
    ['fish_tank', 'biofilter'],
    ['biofilter', 'grow_bed'],
    ['grow_bed', 'sump'],
    ['sump', 'pump'],
    ['pump', 'fish_tank'],
  ]
  const edgeRows: EdgeInsert[] = pairs.map(([source, target]) => ({
    farm_id: farmId,
    source_node: idByType.get(source) as string,
    target_node: idByType.get(target) as string,
  }))
  const { data: edges, error: edgeError } = await supabase.from('farm_edges').insert(edgeRows).select()
  if (edgeError) throw new BackendError(edgeError.message, edgeError.code)

  return { nodes, edges }
}
