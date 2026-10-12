import { appConfig } from '@/app/config/app-config'
import type { PageResult } from '@/shared/ui/server-table'

export async function listImportHistory(companyId: string, query: { page: number; pageSize: number; search: string }): Promise<PageResult> {
  const url = new URL('/erp/import-history', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  url.searchParams.set('page', String(query.page))
  url.searchParams.set('pageSize', String(query.pageSize))
  url.searchParams.set('search', query.search)
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) {
    throw new Error('imports')
  }
  const payload: unknown = await response.json()
  if (!isRecord(payload)) {
    return { items: [], page: query.page, pageSize: query.pageSize, total: 0 }
  }
  return {
    items: [],
    page: numberOf(payload.page, query.page),
    pageSize: numberOf(payload.pageSize, query.pageSize),
    total: numberOf(payload.total, 0),
  }
}

function numberOf(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return parsed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
