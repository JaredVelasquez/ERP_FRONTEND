import { authenticatedFetch } from '@/shared/api/http-client'
import { appConfig } from '@/app/config/app-config'
import type { PageResult } from '@/shared/ui/server-table'

export async function listCompanyUsers(companyId: string, query: { page: number; pageSize: number; search: string }): Promise<PageResult> {
  const url = new URL('/erp/company-users', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  url.searchParams.set('page', String(query.page))
  url.searchParams.set('pageSize', String(query.pageSize))
  url.searchParams.set('search', query.search)
  const response = await authenticatedFetch(url, { credentials: 'include' })
  if (!response.ok) {
    throw new Error('users')
  }
  return readUsers(await response.json())
}

function readUsers(payload: unknown): PageResult {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return { items: [], page: 1, pageSize: 25, total: 0 }
  }
  return {
    items: payload.items.flatMap(readUser),
    page: numberOf(payload.page),
    pageSize: numberOf(payload.pageSize),
    total: numberOf(payload.total),
  }
}

function readUser(value: unknown): PageResult['items'] {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return []
  }
  return [{
    id: value.id,
    cells: {
      email: typeof value.email === 'string' ? value.email : '',
      displayName: typeof value.displayName === 'string' ? value.displayName : '',
    },
  }]
}

function numberOf(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }
  return parsed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
