import { AlertTriangle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export type ToastKind = 'default' | 'critical'

export type ToastOptions = {
  kind?: ToastKind
}

type ToastItem = {
  id: number
  message: string
  kind: ToastKind
}

type ToastContextValue = {
  toast: (message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DISMISS_AFTER_MS = 4000
const MAX_VISIBLE = 3

export type ToastProviderProps = {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextIdRef = useRef(0)

  const toast = useCallback((message: string, options?: ToastOptions) => {
    nextIdRef.current += 1
    const id = nextIdRef.current
    setToasts((prev) => [...prev, { id, message, kind: options?.kind ?? 'default' }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, DISMISS_AFTER_MS)
  }, [])

  const value = useMemo(() => ({ toast }), [toast])
  const visible = toasts.slice(-MAX_VISIBLE)

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2"
      >
        {visible.map((item) => (
          <div
            key={item.id}
            role="status"
            className="flex items-center gap-2 rounded-sharp bg-foreground px-4 py-3 text-[13px] text-background"
          >
            {item.kind === 'critical' ? (
              <AlertTriangle size={14} strokeWidth={1.5} aria-hidden="true" />
            ) : null}
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
