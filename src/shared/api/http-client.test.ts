import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticatedFetch, refreshAccessToken, setAccessToken } from './http-client'
import { configureRefreshTokenStore } from './refresh-token-store'

describe('authenticated requests', () => {
  let storedRefreshToken: string | null

  beforeEach(() => {
    storedRefreshToken = null
    setAccessToken(null)
    configureRefreshTokenStore({
      get: async () => storedRefreshToken,
      set: async (token) => { storedRefreshToken = token },
      clear: async () => { storedRefreshToken = null },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('coalesces concurrent refresh calls and stores the rotated token', async () => {
    storedRefreshToken = 'refresh-old'
    const fetchMock = vi.fn(async () => {
      await Promise.resolve()
      return jsonResponse({ accessToken: 'access-new', refreshToken: 'refresh-new' })
    })
    vi.stubGlobal('fetch', fetchMock)

    const [first, second] = await Promise.all([refreshAccessToken(), refreshAccessToken()])

    expect(first).toBe('access-new')
    expect(second).toBe('access-new')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(storedRefreshToken).toBe('refresh-new')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/identity/refresh',
      expect.objectContaining({
        credentials: 'include',
        body: JSON.stringify({ refreshToken: 'refresh-old', clientPlatform: 'native' }),
      }),
    )
  })

  it('refreshes once after unauthorized response and retries with the new access token', async () => {
    const authorizationHeaders: (string | null)[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/identity/refresh')) {
        return jsonResponse({ accessToken: 'access-new' })
      }
      authorizationHeaders.push(new Headers(init?.headers).get('Authorization'))
      return new Response(null, { status: authorizationHeaders.length === 1 ? 401 : 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    setAccessToken('access-expired')

    const response = await authenticatedFetch('http://localhost:3000/erp/session')

    expect(response.status).toBe(200)
    expect(authorizationHeaders).toEqual(['Bearer access-expired', 'Bearer access-new'])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
