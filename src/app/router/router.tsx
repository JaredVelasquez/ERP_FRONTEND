import { StoreLayout } from '@/app/layouts/store-layout'
import { shelfFamily } from '@/shared/catalog/shelf-families'
import { LoginScreen } from '@/app/screens/login-screen'
import { AssistantPage } from '@/modules/assistant'
import { SalesFiscalWorkspace } from '@/app/screens/sales-fiscal-workspace'
import { createGatedScreen } from '@/app/screens/gated-screen'
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  type RouterHistory,
} from '@tanstack/react-router'

const rootRoute = createRootRoute({
  component: StoreLayout,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LoginScreen,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: createGatedScreen('dashboard', () =>
    import('@/modules/dashboard').then((mod) => ({ Page: mod.DashboardPage })),
  ),
})

const productsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/products',
  validateSearch: (search: Record<string, unknown>) => ({ family: shelfFamily(search.family) }),
  component: createGatedScreen('products', () =>
    import('@/modules/products').then((mod) => ({ Page: mod.ProductsPage })),
  ),
})

const scanRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/scan',
  component: createGatedScreen(['inventory', 'accounting', 'documents'], () =>
    Promise.resolve({ Page: SalesFiscalWorkspace }),
  ),
})

const operationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/operations',
  component: createGatedScreen(['inventory', 'accounting', 'documents'], () => Promise.resolve({ Page: SalesFiscalWorkspace })),
})

const inventoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inventory',
  component: createGatedScreen('inventory', () =>
    import('@/modules/inventory').then((mod) => ({ Page: mod.InventoryPage })),
  ),
})

const pricesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/prices',
  component: createGatedScreen('prices', () =>
    import('@/modules/prices').then((mod) => ({ Page: mod.PricesPage })),
  ),
})

const accountingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accounting',
  component: createGatedScreen('accounting', () =>
    import('@/modules/accounting').then((mod) => ({ Page: mod.AccountingPage })),
  ),
})

const journalEntriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accounting/journal-entries',
  component: createGatedScreen('accounting', () =>
    import('@/modules/accounting').then((mod) => ({ Page: mod.JournalEntriesPage })),
  ),
})

const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reports',
  component: createGatedScreen('accounting', () =>
    import('@/modules/reports').then((mod) => ({ Page: mod.ReportsPage })),
  ),
})

const fiscalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/fiscal',
  component: createGatedScreen(['inventory', 'accounting', 'documents'], () =>
    Promise.resolve({ Page: SalesFiscalWorkspace }),
  ),
})

const importsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/imports',
  component: createGatedScreen('imports', () =>
    import('@/modules/imports').then((mod) => ({ Page: mod.ImportsPage })),
  ),
})

const documentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/documents',
  component: createGatedScreen('documents', () =>
    import('@/modules/documents').then((mod) => ({ Page: mod.DocumentsPage })),
  ),
})

const businessDocumentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/business-documents',
  component: createGatedScreen(['inventory', 'accounting', 'documents'], () =>
    Promise.resolve({ Page: SalesFiscalWorkspace }),
  ),
})

function AssistantFullPageRoute() {
  const { conversationId } = assistantRoute.useSearch()
  return <AssistantPage conversationId={conversationId} />
}

const assistantRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/assistant',
  validateSearch: (search: Record<string, unknown>) => ({
    conversationId: typeof search.conversationId === 'string' ? search.conversationId : undefined,
  }),
  component: AssistantFullPageRoute,
})

const platformRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/platform',
  component: createGatedScreen('platform', () =>
    import('@/modules/platform').then((mod) => ({ Page: mod.PlatformPage })),
  ),
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: createGatedScreen('settings', () =>
    import('@/modules/settings/ui/settings-page').then((mod) => ({ Page: mod.SettingsPage })),
  ),
})

const settingsUsersRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/settings/users',
  component: createGatedScreen('settings', () => import('@/modules/settings/ui/settings-page').then((mod) => ({ Page: () => <mod.SettingsPage section="users" /> }))),
})

const settingsPricesRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/settings/prices',
  component: createGatedScreen('settings', () => import('@/modules/settings/ui/settings-page').then((mod) => ({ Page: () => <mod.SettingsPage section="prices" /> }))),
})

const settingsDocumentsRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/settings/documents',
  component: createGatedScreen('settings', () => import('@/modules/settings/ui/settings-page').then((mod) => ({ Page: () => <mod.SettingsPage section="documents" /> }))),
})
const settingsPaymentsRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/settings/payments',
  component: createGatedScreen('settings', () => import('@/modules/settings/ui/settings-page').then((mod) => ({ Page: () => <mod.SettingsPage section="payments" /> }))),
})
const settingsControlsRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/settings/controls',
  component: createGatedScreen('settings', () => import('@/modules/settings/ui/settings-page').then((mod) => ({ Page: () => <mod.SettingsPage section="controls" /> }))),
})
const settingsTemplatesRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/settings/templates',
  component: createGatedScreen('settings', () => import('@/modules/document-center').then((mod) => ({ Page: mod.TemplatesPage }))),
})
const settingsAssistantRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/settings/assistant',
  component: createGatedScreen('settings', () => import('@/modules/settings/ui/settings-page').then((mod) => ({ Page: () => <mod.SettingsPage section="assistant" /> }))),
})

const integrationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/integrations',
  component: createGatedScreen('settings', () => import('@/modules/integrations/ui/integrations-page').then((mod) => ({ Page: mod.IntegrationsPage }))),
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  dashboardRoute,
  productsRoute,
  scanRoute,
  operationsRoute,
  inventoryRoute,
  pricesRoute,
  accountingRoute,
  journalEntriesRoute,
  reportsRoute,
  fiscalRoute,
  importsRoute,
  documentsRoute,
  businessDocumentsRoute,
  assistantRoute,
  platformRoute,
  settingsRoute,
  settingsUsersRoute,
  settingsPricesRoute,
  settingsDocumentsRoute,
  settingsPaymentsRoute,
  settingsControlsRoute,
  settingsTemplatesRoute,
  settingsAssistantRoute,
  integrationsRoute,
])

export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history })
}

export const router = createAppRouter()

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

type AppRouterProps = {
  router?: ReturnType<typeof createAppRouter>
}

export function AppRouter({ router: instance = router }: AppRouterProps) {
  return <RouterProvider router={instance} />
}
