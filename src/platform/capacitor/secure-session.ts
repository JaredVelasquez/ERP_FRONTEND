import { Capacitor } from '@capacitor/core'
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin'
import { configureRefreshTokenStore } from '@/shared/api/refresh-token-store'

const REFRESH_TOKEN_KEY = 'erp.refresh-token'

export function configureCapacitorRefreshTokenStore(): void {
  if (!Capacitor.isNativePlatform()) return
  configureRefreshTokenStore({
    get: async () => SecureStoragePlugin.get({ key: REFRESH_TOKEN_KEY }).then(({ value }) => value).catch(() => null),
    set: async (token) => { await SecureStoragePlugin.set({ key: REFRESH_TOKEN_KEY, value: token }) },
    clear: async () => { await SecureStoragePlugin.remove({ key: REFRESH_TOKEN_KEY }).catch(() => undefined) },
  })
}
