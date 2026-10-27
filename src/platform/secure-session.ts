import { configureCapacitorRefreshTokenStore } from '@/platform/capacitor/secure-session'
import { configureElectronRefreshTokenStore } from '@/platform/electron/secure-session'

export function configureSecureSessionStorage(): void {
  configureElectronRefreshTokenStore()
  configureCapacitorRefreshTokenStore()
}
