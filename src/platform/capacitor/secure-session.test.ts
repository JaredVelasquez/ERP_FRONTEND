import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configureCapacitorRefreshTokenStore } from './secure-session'

const secureMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  configureStore: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: secureMocks.isNativePlatform } }))
vi.mock('capacitor-secure-storage-plugin', () => ({
  SecureStoragePlugin: { get: secureMocks.get, set: secureMocks.set, remove: secureMocks.remove },
}))
vi.mock('@/shared/api/refresh-token-store', () => ({ configureRefreshTokenStore: secureMocks.configureStore }))

describe('Capacitor refresh token adapter', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('uses the platform secure store for get, set, and clear', async () => {
    secureMocks.isNativePlatform.mockReturnValue(true)
    secureMocks.get.mockResolvedValue({ value: 'refresh-secret' })
    secureMocks.set.mockResolvedValue(undefined)
    secureMocks.remove.mockResolvedValue(undefined)
    configureCapacitorRefreshTokenStore()

    const store = secureMocks.configureStore.mock.calls[0]?.[0]
    expect(store).toBeDefined()
    await expect(store.get()).resolves.toBe('refresh-secret')
    await store.set('next-refresh')
    await store.clear()

    expect(secureMocks.get).toHaveBeenCalledWith({ key: 'erp.refresh-token' })
    expect(secureMocks.set).toHaveBeenCalledWith({ key: 'erp.refresh-token', value: 'next-refresh' })
    expect(secureMocks.remove).toHaveBeenCalledWith({ key: 'erp.refresh-token' })
  })

  it('does not configure native storage for a web browser', () => {
    secureMocks.isNativePlatform.mockReturnValue(false)

    configureCapacitorRefreshTokenStore()

    expect(secureMocks.configureStore).not.toHaveBeenCalled()
  })

  it('returns no refresh token when secure storage cannot read it', async () => {
    secureMocks.isNativePlatform.mockReturnValue(true)
    secureMocks.get.mockRejectedValue(new Error('secure storage unavailable'))
    configureCapacitorRefreshTokenStore()

    const store = secureMocks.configureStore.mock.calls[0]?.[0]
    await expect(store.get()).resolves.toBeNull()
  })
})
