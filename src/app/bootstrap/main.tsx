import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProviders } from '@/app/providers/app-providers'
import { AppRouter } from '@/app/router/router'
import { configureSecureSessionStorage } from '@/platform/secure-session'
import { activePlatform } from '@/app/wiring/platform'
import { configureClientPlatform } from '@/shared/api/client-platform'
import '../../index.css'

const root = document.getElementById('root')

configureSecureSessionStorage()
configureClientPlatform(activePlatform())

if (!root) {
  throw new Error('Missing #root')
}

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
)
