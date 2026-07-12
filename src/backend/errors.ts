// Thrown on any Supabase failure so callers get a typed, non silent error.
export class BackendError extends Error {
  readonly code: string | undefined
  constructor(message: string, code?: string) {
    super(message)
    this.name = 'BackendError'
    this.code = code
  }
}
