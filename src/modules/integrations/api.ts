import { authenticatedFetch } from '@/shared/api/http-client'
import { z } from 'zod'
import { appConfig } from '@/app/config/app-config'

const profile = z.enum(['consulta', 'operacion', 'catalogo', 'gerencia', 'personalizado'])
const tokenDetails = z.object({
  id: z.string(), userId: z.string(), name: z.string(), profile, tools: z.array(z.string()),
  createdAt: z.string(), expiresAt: z.string().nullable(), revokedAt: z.string().nullable(),
  userName: z.string().optional(), lastUsedAt: z.string().nullable().optional(),
  ownerActive: z.boolean().optional(),
})
export type TokenProfile = z.infer<typeof profile>
export type TokenDetails = z.infer<typeof tokenDetails>

async function request(path: string, method = 'GET', body?: unknown): Promise<unknown> {
  const response = await authenticatedFetch(new URL(path, appConfig.gatewayUrl), {
    method, credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const issue: unknown = await response.json().catch(() => null)
    const message = typeof issue === 'object' && issue !== null && 'message' in issue && typeof issue.message === 'string'
      ? issue.message : 'No se pudo completar la operación.'
    throw new Error(message)
  }
  return response.json()
}

export async function tokenOptions() {
  return z.object({ profiles: z.array(profile), tools: z.array(z.string()) }).parse(await request('/mcp/token-options'))
}

export async function listTokens(): Promise<TokenDetails[]> {
  return z.array(tokenDetails).parse(await request('/mcp/tokens'))
}

export async function createToken(input: { name: string; profile: TokenProfile; tools?: string[]; days: number }) {
  return z.object({ token: z.string(), details: tokenDetails }).parse(await request('/mcp/tokens', 'POST', input))
}

export async function revokeToken(id: string): Promise<void> {
  await request(`/mcp/tokens/${encodeURIComponent(id)}`, 'DELETE')
}

export async function listCompanyTokens(): Promise<TokenDetails[]> {
  return z.array(tokenDetails).parse(await request('/mcp/company-tokens'))
}

const usageEntry = z.object({
  userId: z.string(), companyId: z.string(), tool: z.string(), result: z.enum(['ok', 'denied', 'error']),
  movementId: z.string().nullable(), tokenId: z.string().nullable().optional(),
  tokenName: z.string().nullable().optional(), userName: z.string().nullable().optional(), createdAt: z.string().optional(),
})
export type UsageEntry = z.infer<typeof usageEntry>

export async function listUsage(query: { page: number; pageSize: number; search: string; userId?: string } = { page: 1, pageSize: 25, search: '' }): Promise<{ items: UsageEntry[]; total: number }> {
  const url = new URL('/mcp/usage', appConfig.gatewayUrl)
  url.searchParams.set('page', String(query.page))
  url.searchParams.set('pageSize', String(query.pageSize))
  url.searchParams.set('search', query.search)
  if (query.userId) url.searchParams.set('userId', query.userId)
  return z.object({ items: z.array(usageEntry), total: z.number() }).parse(await request(url.pathname + url.search))
}

export async function revokeCompanyToken(id: string): Promise<void> {
  await request(`/mcp/company-tokens/${encodeURIComponent(id)}`, 'DELETE')
}

export async function rotateCompanyToken(id: string) {
  return z.object({ token: z.string(), details: tokenDetails }).parse(await request(`/mcp/company-tokens/${encodeURIComponent(id)}/rotate`, 'POST'))
}
