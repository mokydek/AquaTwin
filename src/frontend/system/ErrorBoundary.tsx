import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

import i18n from '@/shared/i18n'
import { Button, Wordmark } from '@/shared/ui'

type ErrorBoundaryProps = { children: ReactNode }
type ErrorBoundaryState = { hasError: boolean }

function Fallback() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <Wordmark size="md" />
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {i18n.t('system.errorTitle')}
        </h1>
        <p className="text-[13px] text-muted">{i18n.t('system.errorBody')}</p>
      </div>
      <Button variant="secondary" onClick={() => window.location.reload()}>
        {i18n.t('system.reload')}
      </Button>
    </main>
  )
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AquaTwin render error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) return <Fallback />
    return this.props.children
  }
}
