import { authenticatedFetch } from '@/shared/api/http-client'
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
  'cash-transfer': 'Traslado de dinero',
  'warehouse-transfer': 'Traslado entre bodegas',
  void: 'Anulación',
}

export interface WarehouseOption { id: string; code: string; name: string; active: boolean; isDefault: boolean }

export async function listWarehouses(): Promise<WarehouseOption[]> {
  const response = await authenticatedFetch(new URL('/erp/company-controls/warehouses', appConfig.gatewayUrl), { credentials: 'include' })
  if (!response.ok) {
    throw new Error('No se pudieron cargar las bodegas.')
  }
  const payload: unknown = await response.json()
  if (!isRecord(payload) || !Array.isArray(payload.warehouses)) {
    return []
  }
  return payload.warehouses.flatMap(readWarehouse)
}

function readWarehouse(value: unknown): WarehouseOption[] {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.code !== 'string' || typeof value.name !== 'string') {
    return []
  }
  return [{ id: value.id, code: value.code, name: value.name, active: value.active === true, isDefault: value.isDefault === true }]
}

export interface ProductSearchHit { productId: string; name: string; barcode: string }

export async function searchProductsByName(companyId: string, name: string): Promise<ProductSearchHit[]> {
  const url = new URL('/erp/products/search', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  url.searchParams.set('q', name.trim())
  const response = await authenticatedFetch(url, { credentials: 'include' })
  if (!response.ok) {
    throw new Error('No se pudo buscar productos.')
  }
  const payload: unknown = await response.json()
  if (!isRecord(payload) || !Array.isArray(payload.products)) {
    return []
  }
  return payload.products.flatMap(readSearchHit)
}

function readSearchHit(value: unknown): ProductSearchHit[] {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.internalBarcode !== 'string') {
    return []
  }
  return [{ productId: value.id, name: value.name, barcode: value.internalBarcode }]
}

export interface TransferPresentation { unit: string; factor: number }
export interface TransferStockCard { productId: string; name: string; onHand: number; presentations: TransferPresentation[] }

export async function readStockCardForTransfer(companyId: string, code: string, warehouseId: string): Promise<TransferStockCard | null> {
  const url = new URL('/erp/stock-cards', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  url.searchParams.set('code', code)
  url.searchParams.set('warehouseId', warehouseId)
  const response = await authenticatedFetch(url, { credentials: 'include' })
  if (!response.ok) {
    return null
  }
  const payload: unknown = await response.json()
  if (!isRecord(payload) || !isRecord(payload.card)) {
    return null
  }
  const card = payload.card
  if (typeof card.productId !== 'string' || typeof card.name !== 'string') {
    return null
  }
  return {
    productId: card.productId,
    name: card.name,
    onHand: numberOf(card.baseQuantity),
    presentations: Array.isArray(card.presentations) ? card.presentations.flatMap(readTransferPresentation) : [],
  }
}

function readTransferPresentation(value: unknown): TransferPresentation[] {
  if (!isRecord(value) || typeof value.unit !== 'string') {
    return []
  }
  return [{ unit: value.unit, factor: numberOf(value.factor) }]
}

export async function transferStock(input: {
  companyId: string
  productId: string
  unit: string
  quantity: number
  originWarehouseId: string
  destinationWarehouseId: string
}): Promise<{ error: string } | { id: string }> {
  const response = await authenticatedFetch(`${appConfig.gatewayUrl}/erp/inventory-transfers`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      companyId: input.companyId,
      idempotencyKey: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      productId: input.productId,
      unit: input.unit,
      quantity: input.quantity,
      originWarehouseId: input.originWarehouseId,
      destinationWarehouseId: input.destinationWarehouseId,
    }),
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    return { error: isRecord(payload) && typeof payload.message === 'string' ? payload.message : 'No se pudo completar el traslado.' }
  }
  if (!isRecord(payload) || !isRecord(payload.document) || typeof payload.document.id !== 'string') {
    return { error: 'Respuesta de traslado inválida.' }
  }
  return { id: payload.document.id }
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
  const response = await authenticatedFetch(url, { credentials: 'include' })
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
