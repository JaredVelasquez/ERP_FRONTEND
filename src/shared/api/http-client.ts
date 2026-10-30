import { appConfig } from '@/app/config/app-config'
import { clearStoredRefreshToken, getStoredRefreshToken, setStoredRefreshToken } from '@/shared/api/refresh-token-store'
import { clientPlatform } from '@/shared/api/client-platform'

let accessToken: string | null = null
let refreshPromise: Promise<string | null> | null = null
const browserRefreshLockName = 'erp.identity.refresh'

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise !== null) return refreshPromise
  refreshPromise = requestRefresh()
  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const first = await fetchWithAccessToken(input, init)
  if (first.status !== 401) return first
  const refreshed = await refreshAccessToken()
  if (refreshed === null) return first
  return fetchWithAccessToken(input, init)
}

async function fetchWithAccessToken(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers)
  if (accessToken !== null) headers.set('Authorization', `Bearer ${accessToken}`)
  return fetch(input, { ...init, headers, credentials: 'include' })
}

async function requestRefresh(): Promise<string | null> {
  if (canCoordinateBrowserRefresh()) {
    return navigator.locks.request(browserRefreshLockName, requestRefreshWithoutLock)
  }
  return requestRefreshWithoutLock()
}

async function requestRefreshWithoutLock(): Promise<string | null> {
  const refreshToken = await getStoredRefreshToken()
  const response = await fetch(`${appConfig.gatewayUrl}/identity/refresh`, {
    method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(refreshToken === null ? { clientPlatform: clientPlatform() } : { refreshToken, clientPlatform: clientPlatform() }),
  })
  if (!response.ok) {
    setAccessToken(null)
    if (refreshToken !== null) await clearStoredRefreshToken()
    return null
  }
  const payload: unknown = await response.json()
  if (!isRecord(payload) || typeof payload.accessToken !== 'string') return null
  setAccessToken(payload.accessToken)
  if (typeof payload.refreshToken === 'string') await setStoredRefreshToken(payload.refreshToken)
  return payload.accessToken
}

function canCoordinateBrowserRefresh(): boolean {
  return clientPlatform() === 'web'
    && typeof navigator !== 'undefined'
    && typeof navigator.locks?.request === 'function'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
