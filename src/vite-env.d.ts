/// <reference types="vite/client" />

interface Window {
  michelleShell?: {
    name: 'electron'
    secureSession: {
      getRefreshToken(): Promise<string | null>
      setRefreshToken(token: string): Promise<void>
      clearRefreshToken(): Promise<void>
    }
  }
}
