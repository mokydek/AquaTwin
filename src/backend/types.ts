import type { DeviceType, SensorType } from '@/shared/config/aquaponics'
import type { Species } from '@/shared/config/species'

// Narrowed domain unions shared across the app. SensorType and DeviceType are
// re-exported from the domain config (their single source of truth).
export type { DeviceType, SensorType }
export type { Species }
export type FishEventType = 'mortality' | 'harvest' | 'restock' | 'weighing'
export type AlertKind = 'threshold' | 'prediction'
export type AlertSeverity = 'warning' | 'critical'
export type RuleCondition = 'above' | 'below'
export type RuleAction = 'turn_on' | 'turn_off'
export type TriggeredBy = 'rule' | 'manual'
export type ReadingSource = 'simulation' | 'hardware'
export type NodeType = 'fish_tank' | 'grow_bed' | 'biofilter' | 'sump' | 'pump'
// jsonb props, loosely typed here; layout.ts narrows per node type.
export type NodeProps = {
  volumeL?: number
  areaM2?: number
  flowLph?: number
}

// Hand written Database interface matching supabase/schema.sql exactly.
export interface Database {
  public: {
    Tables: {
      farms: {
        Row: {
          id: string
          owner_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      sensors: {
        Row: {
          id: string
          farm_id: string
          type: SensorType
          unit: string
          warn_low: number | null
          warn_high: number | null
          crit_low: number | null
          crit_high: number | null
          node_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          type: SensorType
          unit: string
          warn_low?: number | null
          warn_high?: number | null
          crit_low?: number | null
          crit_high?: number | null
          node_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          type?: SensorType
          unit?: string
          warn_low?: number | null
          warn_high?: number | null
          crit_low?: number | null
          crit_high?: number | null
          node_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      readings: {
        Row: {
          id: number
          sensor_id: string
          value: number
          recorded_at: string
          source: ReadingSource
        }
        Insert: {
          id?: number
          sensor_id: string
          value: number
          recorded_at?: string
          source?: ReadingSource
        }
        Update: {
          id?: number
          sensor_id?: string
          value?: number
          recorded_at?: string
          source?: ReadingSource
        }
        Relationships: []
      }
      devices: {
        Row: {
          id: string
          farm_id: string
          type: DeviceType
          is_on: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          type: DeviceType
          is_on?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          type?: DeviceType
          is_on?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          id: string
          farm_id: string
          sensor_type: SensorType
          kind: AlertKind
          severity: AlertSeverity
          value: number | null
          threshold: number | null
          eta_minutes: number | null
          acknowledged: boolean
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          farm_id: string
          sensor_type: SensorType
          kind: AlertKind
          severity: AlertSeverity
          value?: number | null
          threshold?: number | null
          eta_minutes?: number | null
          acknowledged?: boolean
          created_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          farm_id?: string
          sensor_type?: SensorType
          kind?: AlertKind
          severity?: AlertSeverity
          value?: number | null
          threshold?: number | null
          eta_minutes?: number | null
          acknowledged?: boolean
          created_at?: string
          resolved_at?: string | null
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          id: string
          farm_id: string
          name: string
          sensor_type: SensorType
          condition: RuleCondition
          threshold: number
          device_type: DeviceType
          action: RuleAction
          enabled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          name: string
          sensor_type: SensorType
          condition: RuleCondition
          threshold: number
          device_type: DeviceType
          action: RuleAction
          enabled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          name?: string
          sensor_type?: SensorType
          condition?: RuleCondition
          threshold?: number
          device_type?: DeviceType
          action?: RuleAction
          enabled?: boolean
          created_at?: string
        }
        Relationships: []
      }
      automation_events: {
        Row: {
          id: number
          farm_id: string
          device_type: DeviceType
          action: RuleAction
          triggered_by: TriggeredBy
          rule_id: string | null
          created_at: string
        }
        Insert: {
          id?: number
          farm_id: string
          device_type: DeviceType
          action: RuleAction
          triggered_by: TriggeredBy
          rule_id?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          farm_id?: string
          device_type?: DeviceType
          action?: RuleAction
          triggered_by?: TriggeredBy
          rule_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      farm_nodes: {
        Row: {
          id: string
          farm_id: string
          type: NodeType
          label: string
          x: number
          y: number
          props: NodeProps
          created_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          type: NodeType
          label: string
          x: number
          y: number
          props?: NodeProps
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          type?: NodeType
          label?: string
          x?: number
          y?: number
          props?: NodeProps
          created_at?: string
        }
        Relationships: []
      }
      farm_edges: {
        Row: {
          id: string
          farm_id: string
          source_node: string
          target_node: string
          created_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          source_node: string
          target_node: string
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          source_node?: string
          target_node?: string
          created_at?: string
        }
        Relationships: []
      }
      fish_batches: {
        Row: {
          id: string
          farm_id: string
          node_id: string | null
          species: Species
          initial_count: number
          avg_weight_g: number
          stocked_at: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          farm_id: string
          node_id?: string | null
          species: Species
          initial_count: number
          avg_weight_g: number
          stocked_at?: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          farm_id?: string
          node_id?: string | null
          species?: Species
          initial_count?: number
          avg_weight_g?: number
          stocked_at?: string
          note?: string | null
          created_at?: string
        }
        Relationships: []
      }
      fish_events: {
        Row: {
          id: number
          batch_id: string
          farm_id: string
          type: FishEventType
          count: number | null
          avg_weight_g: number | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: number
          batch_id: string
          farm_id: string
          type: FishEventType
          count?: number | null
          avg_weight_g?: number | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          batch_id?: string
          farm_id?: string
          type?: FishEventType
          count?: number | null
          avg_weight_g?: number | null
          note?: string | null
          created_at?: string
        }
        Relationships: []
      }
      farm_api_keys: {
        Row: {
          id: string
          farm_id: string
          key_hash: string
          key_prefix: string
          label: string
          created_at: string
          last_used_at: string | null
          revoked: boolean
        }
        Insert: {
          id?: string
          farm_id: string
          key_hash: string
          key_prefix: string
          label: string
          created_at?: string
          last_used_at?: string | null
          revoked?: boolean
        }
        Update: {
          id?: string
          farm_id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          created_at?: string
          last_used_at?: string | null
          revoked?: boolean
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      // Report aggregates. Both are language sql, stable, security invoker, so
      // the caller's RLS on readings and sensors still applies (see 0006).
      report_sensor_stats: {
        Args: { p_farm: string; p_from: string; p_to: string }
        Returns: {
          sensor_type: string
          avg_value: number
          min_value: number
          max_value: number
          pct_ok: number
          pct_warning: number
          pct_critical: number
          samples: number
          hardware_share: number
        }[]
      }
      report_hourly_series: {
        Args: { p_farm: string; p_from: string; p_to: string }
        Returns: {
          sensor_type: string
          bucket: string
          avg_value: number
        }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Convenience row aliases for use across the backend and app.
export type Farm = Database['public']['Tables']['farms']['Row']
export type Sensor = Database['public']['Tables']['sensors']['Row']
export type Reading = Database['public']['Tables']['readings']['Row']
export type Device = Database['public']['Tables']['devices']['Row']
export type Alert = Database['public']['Tables']['alerts']['Row']
export type AutomationRule = Database['public']['Tables']['automation_rules']['Row']
export type AutomationEvent = Database['public']['Tables']['automation_events']['Row']
export type FarmNode = Database['public']['Tables']['farm_nodes']['Row']
export type FarmEdge = Database['public']['Tables']['farm_edges']['Row']
export type FishBatch = Database['public']['Tables']['fish_batches']['Row']
export type FishEvent = Database['public']['Tables']['fish_events']['Row']
export type FarmApiKey = Database['public']['Tables']['farm_api_keys']['Row']
