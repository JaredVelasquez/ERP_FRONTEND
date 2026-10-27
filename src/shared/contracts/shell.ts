export type ShellName = 'web' | 'electron' | 'capacitor'

export interface AppShell {
  name: ShellName
  secureSession?: {
    getRefreshToken(): Promise<string | null>
    setRefreshToken(token: string): Promise<void>
    clearRefreshToken(): Promise<void>
  }
}
