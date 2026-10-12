import { Capacitor } from '@capacitor/core'

export function capacitorShellName(): 'capacitor' | 'web' {
  if (Capacitor.isNativePlatform()) {
    return 'capacitor'
  }
  return 'web'
}
