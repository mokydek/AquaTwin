import type { DeviceType, SensorType } from '@/shared/config/aquaponics'

// Narrowed domain unions shared across the app. SensorType and DeviceType are
// re-exported from the domain config (their single source of truth).
export type { DeviceType, SensorType }
export type AlertKind = 'threshold' | 'prediction'
export type AlertSeverity = 'warning' | 'critical'
export type RuleCondition = 'above' | 'below'
export type RuleAction = 'turn_on' | 'turn_off'
export type TriggeredBy = 'rule' | 'manual'

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
        }
        Insert: {
          id?: number
          sensor_id: string
          value: number
          recorded_at?: string
        }
        Update: {
          id?: number
          sensor_id?: string
          value?: number
          recorded_at?: string
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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
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
