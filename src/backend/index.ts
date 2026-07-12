// Public backend API. Components import from here and never touch Supabase
// directly (see CLAUDE.md architecture rules). The raw client stays internal.
export * from '@/backend/types'
export { BackendError } from '@/backend/errors'
export { createFarmWithDefaults, getFarm, listFarms } from '@/backend/farms'
export { listSensors } from '@/backend/sensors'
export { listDevices, setDeviceState } from '@/backend/devices'
export type { SetDeviceResult } from '@/backend/devices'
export {
  getSession,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  subscribeToAuth,
} from '@/backend/auth'
export type { AuthErrorCode, AuthResult, Session, SignOutResult, User } from '@/backend/auth'
