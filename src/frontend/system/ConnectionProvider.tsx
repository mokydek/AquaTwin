import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { subscribeConnection } from '@/backend'
import { Badge } from '@/shared/ui'

const ConnectionContext = createContext<boolean>(true)

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeConnection(setConnected)
    return unsubscribe
  }, [])

  return <ConnectionContext.Provider value={connected}>{children}</ConnectionContext.Provider>
}

export function useConnection(): boolean {
  return useContext(ConnectionContext)
}

export function ConnectionBadge() {
  const { t } = useTranslation()
  const connected = useConnection()
  return (
    <Badge variant={connected ? 'ok' : 'neutral'}>
      {connected ? <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse bg-foreground" /> : null}
      {connected ? t('system.live') : t('system.reconnecting')}
    </Badge>
  )
}
