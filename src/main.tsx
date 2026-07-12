import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import '@fontsource-variable/space-grotesk/index.css'
import '@fontsource-variable/onest/index.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import '@/styles/globals.css'
import '@/shared/i18n'

import { router } from '@/router'
import { AuthProvider } from '@/frontend/auth/AuthProvider'
import { ToastProvider } from '@/shared/ui/Toast'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ToastProvider>
  </StrictMode>,
)
