import type { AppModule } from '@/modules/access'

export const modulePath = {
  dashboard: '/dashboard',
  products: '/products',
  inventory: '/inventory',
  prices: '/prices',
  accounting: '/accounting',
  imports: '/imports',
  documents: '/documents',
  settings: '/settings',
  platform: '/platform',
} as const satisfies Record<AppModule, string>
