import { capacitorShellName } from '@/platform/capacitor/shell'
import { webShellName } from '@/platform/web/shell'
import type { ShellName } from '@/shared/contracts/shell'

export function activePlatform(): ShellName {
  if (window.michelleShell?.name === 'electron') {
    return 'electron'
  }
  const native = capacitorShellName()
  if (native === 'capacitor') {
    return native
  }
  return webShellName
}
