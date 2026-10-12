import { appConfig } from '@/app/config/app-config'
import type { PageResult } from '@/shared/ui/server-table'

export async function listInventoryDocuments(companyId: string, query: { page: number; pageSize: number; search: string }): Promise<PageResult> {
  return readRows('/erp/inventory-documents', companyId, query, (row) => ({
    id: text(row, 'id'),
    cells: {
      type: documentLabel(text(row, 'documentType')),
      status: statusLabel(text(row, 'status')),
      createdAt: text(row, 'createdAt'),
    },
  }))
}

const documentLabels: Record<string, string> = {
  purchase: 'Compra',
  opening: 'Apertura',
  sale: 'Venta',
  shrinkage: 'Merma',
  adjustment: 'Ajuste',
  'cash-transfer': 'Traslado',
  void: 'Anulación',
}

const statusLabels: Record<string, string> = {
  confirmed: 'Confirmado',
  voided: 'Anulado',
}

function documentLabel(value: string): string {
  return documentLabels[value] ?? value
}

function statusLabel(value: string): string {
  return statusLabels[value] ?? value
}

async function readRows(
  path: string,
  companyId: string,
  query: { page: number; pageSize: number; search: string },
  mapRow: (row: Record<string, unknown>) => PageResult['items'][number],
): Promise<PageResult> {
  const url = new URL(path, appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  url.searchParams.set('page', String(query.page))
  url.searchParams.set('pageSize', String(query.pageSize))
  url.searchParams.set('search', query.search)
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) {
    throw new Error(path)
  }
  const payload: unknown = await response.json()
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return { items: [], page: 1, pageSize: 25, total: 0 }
  }
  return {
    items: payload.items.flatMap((item) => (isRecord(item) ? [mapRow(item)] : [])),
    page: numberOf(payload.page),
    pageSize: numberOf(payload.pageSize),
    total: numberOf(payload.total),
  }
}

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  return typeof value === 'string' ? value : ''
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
