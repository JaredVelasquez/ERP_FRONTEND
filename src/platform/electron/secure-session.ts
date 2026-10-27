import { configureRefreshTokenStore } from '@/shared/api/refresh-token-store'

export function configureElectronRefreshTokenStore(): void {
  const secureSession = window.michelleShell?.secureSession
  if (window.michelleShell?.name !== 'electron' || secureSession === undefined) return
  configureRefreshTokenStore({
    get: () => secureSession.getRefreshToken(),
    set: (token) => secureSession.setRefreshToken(token),
    clear: () => secureSession.clearRefreshToken(),
  })
}
