import { SessionProvider } from '@/app/providers/session'
import { AppRouter, createAppRouter } from '@/app/router/router'
import { loginMessages } from '@/modules/authentication'
import type { ModuleGrant } from '@/modules/access'
import { shellMessages } from '@/shared/i18n/messages'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createMemoryHistory } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'

const operatorGrants: ModuleGrant[] = [
  { module: 'dashboard', access: 'view' },
  { module: 'products', access: 'edit' },
  { module: 'inventory', access: 'edit' },
  { module: 'prices', access: 'view' },
  { module: 'imports', access: 'edit' },
  { module: 'documents', access: 'edit' },
]

async function renderAt(grants: readonly ModuleGrant[] | null) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))
  await router.load()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const tree = <QueryClientProvider client={queryClient}><AppRouter router={router} /></QueryClientProvider>
  if (grants === null) {
    return render(tree)
  }
  return render(<SessionProvider grants={grants}>{tree}</SessionProvider>)
}

describe('store navigation', () => {
  it('does not show accounting or platform to an operator', async () => {
    await renderAt(operatorGrants)

    expect(await screen.findByRole('link', { name: shellMessages.products })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: shellMessages.accounting })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: shellMessages.platform })).not.toBeInTheDocument()
    expect(screen.getByText(shellMessages.devCompany)).toBeInTheDocument()
  })

  it('keeps the sections hidden when nobody has signed in', async () => {
    await renderAt(null)

    expect(await screen.findByRole('button', { name: loginMessages.submit })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: shellMessages.products })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: shellMessages.accounting })).not.toBeInTheDocument()
  })
})
