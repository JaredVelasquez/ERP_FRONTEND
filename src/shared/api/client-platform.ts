import type { ShellName } from '@/shared/contracts/shell'

let currentPlatform: ShellName = 'web'

export function configureClientPlatform(platform: ShellName): void {
  currentPlatform = platform
}

export function clientPlatform(): ShellName {
  return currentPlatform
}
