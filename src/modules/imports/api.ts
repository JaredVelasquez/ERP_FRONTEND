import { authenticatedFetch } from '@/shared/api/http-client'
import { appConfig } from '@/app/config/app-config'
import type { PageResult } from '@/shared/ui/server-table'

export async function importCatalog(companyId: string, csv: string): Promise<{ document: unknown | null }> {
  const response = await authenticatedFetch(new URL('/erp/imports/catalog', appConfig.gatewayUrl), {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ companyId, csv, receivedAt: new Date().toISOString() }),
  })
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    const detail = isRecord(payload) && typeof payload.message === 'string' ? payload.message : 'No se pudo importar el catálogo.'
    throw new Error(detail)
  }
  return response.json() as Promise<{ document: unknown | null }>
}

export async function downloadCatalogTemplate(): Promise<void> {
  const response = await authenticatedFetch(new URL('/erp/imports/catalog-template', appConfig.gatewayUrl), { credentials: 'include' })
  if (!response.ok) throw new Error('No se pudo descargar la plantilla.')
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = 'plantilla-catalogo.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export async function listImportHistory(companyId: string, query: { page: number; pageSize: number; search: string }): Promise<PageResult> {
  const url = new URL('/erp/import-history', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  url.searchParams.set('page', String(query.page))
  url.searchParams.set('pageSize', String(query.pageSize))
  url.searchParams.set('search', query.search)
  const response = await authenticatedFetch(url, { credentials: 'include' })
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
