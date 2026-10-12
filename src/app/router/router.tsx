import { StoreLayout } from '@/app/layouts/store-layout'
import { shelfFamily } from '@/shared/catalog/shelf-families'
import { LoginScreen } from '@/app/screens/login-screen'
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
  component: createGatedScreen('inventory', () =>
    import('@/modules/scan').then((mod) => ({ Page: mod.ScanPage })),
  ),
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

const platformRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/platform',
  component: createGatedScreen('platform', () =>
    import('@/modules/platform').then((mod) => ({ Page: mod.PlatformPage })),
  ),
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  dashboardRoute,
  productsRoute,
  scanRoute,
  inventoryRoute,
  pricesRoute,
  accountingRoute,
  importsRoute,
  documentsRoute,
  platformRoute,
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
