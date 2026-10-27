import { SessionProvider } from '@/app/providers/session'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginForm } from '@/modules/authentication'
import { loginMessages } from '../messages'

const ownerGrants = [
  { module: 'dashboard', access: 'edit' },
  { module: 'products', access: 'edit' },
  { module: 'inventory', access: 'edit' },
  { module: 'prices', access: 'edit' },
  { module: 'accounting', access: 'edit' },
  { module: 'imports', access: 'edit' },
  { module: 'documents', access: 'edit' },
]

describe('login', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith('/identity/companies')) {
          return { ok: true, json: async () => ({ companies: [{ companyId: 'company-dev', companyName: 'Michelle Market (desarrollo)' }] }) }
        }
        if (url.endsWith('/identity/login')) {
          return { ok: true, json: async () => ({ token: 'session-token', accessToken: 'access-token', role: 'owner', userId: 'user-1', companyId: 'company-dev', companyName: 'Michelle Market (desarrollo)', grants: ownerGrants }) }
        }
        if (url.endsWith('/identity/refresh')) {
          return { ok: false, json: async () => ({}) }
        }
        return { ok: true, json: async () => ({ userId: 'user-1', role: 'owner', companyId: 'company-dev', companyName: 'Michelle Market (desarrollo)', grants: ownerGrants }) }
      }),
    )
  })

  it('posts to the gateway with the cookie and selects the only company', async () => {
    render(
      <SessionProvider>
        <LoginForm />
      </SessionProvider>,
    )
    fireEvent.change(screen.getByLabelText(loginMessages.email), { target: { value: 'revision@michelle.local' } })
    fireEvent.change(screen.getByLabelText(loginMessages.password), { target: { value: 'secret' } })
    fireEvent.submit(screen.getByRole('button', { name: loginMessages.submit }))

    expect(await screen.findByRole('status')).toHaveTextContent(loginMessages.signedIn)
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/identity/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'revision@michelle.local', password: 'secret', companyId: 'company-dev', clientPlatform: 'web' }),
      }),
    )
  })
})
