// Public backend API. Components import from here and never touch Supabase
// directly (see CLAUDE.md architecture rules). The raw client stays internal.
export * from '@/backend/types'
export { BackendError } from '@/backend/errors'
export { createFarmWithDefaults, deleteFarm, getFarm, listFarms, renameFarm } from '@/backend/farms'
export { setupDemoFarm } from '@/backend/demo'
export type { DemoContent, DemoProgress, DemoStage } from '@/backend/demo'
export { listSensors, updateSensorThresholds, validThresholds } from '@/backend/sensors'
export type { ThresholdPatch, ThresholdResult } from '@/backend/sensors'
export { subscribeConnection } from '@/backend/connection'
export {
  assignSensorToNode,
  createEdge,
  createNode,
  defaultPropsFor,
  deleteEdge,
  deleteNode,
  getLayout,
  NODE_PROP_FIELD,
  NODE_PROP_UNIT,
  NODE_TYPES,
  seedDefaultLayout,
  updateNode,
} from '@/backend/layout'
export type { Layout } from '@/backend/layout'
export { createBatch, deleteBatch, listBatches, listEvents, logEvent } from '@/backend/livestock'
export { createApiKey, listApiKeys, revokeApiKey } from '@/backend/apiKeys'
export type { ApiKeyView } from '@/backend/apiKeys'
export { listDevices, setDeviceState, subscribeToDevices } from '@/backend/devices'
export type { SetDeviceResult } from '@/backend/devices'
export {
  createRule,
  deleteRule,
  listAutomationEvents,
  listRules,
  setRuleEnabled,
  subscribeToAutomationEvents,
  updateRule,
} from '@/backend/automation'
export type { AutomationEventInsert, AutomationEventRow } from '@/backend/automation'
export { getReadings, insertReadings, subscribeToReadings } from '@/backend/readings'
export type { ReadingRow, ReadingSource } from '@/backend/readings'
export {
  exportAlertsCsv,
  exportFishEventsCsv,
  exportReadingsCsv,
  getAlertsInRange,
  getAutomationSummary,
  getHourlySeries,
  getLivestockSummary,
  getReportStats,
  MAX_EXPORT_DAYS,
} from '@/backend/reports'
export type {
  AlertExportRow,
  AutomationSummary,
  FishEventExportRow,
  HourlyPoint,
  LivestockSummary,
  RangeAlert,
  ReadingExportRow,
  SensorStat,
} from '@/backend/reports'
export {
  acknowledgeAlert,
  createAlert,
  listActiveAlerts,
  listResolvedAlerts,
  resolveAlerts,
  subscribeToAlerts,
  updateAlertEta,
} from '@/backend/alerts'
export type { AlertChange } from '@/backend/alerts'
export {
  convertAnonymousAccount,
  getSession,
  signInAnonymously,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  subscribeToAuth,
  updatePassword,
} from '@/backend/auth'
export type { AuthErrorCode, AuthResult, Session, SignOutResult, User } from '@/backend/auth'
