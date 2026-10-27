import { authenticatedFetch } from '@/shared/api/http-client'
import { appConfig } from '@/app/config/app-config'

export interface DashboardSnapshot {
  salesAmount: number
  shrinkageCost: number
  inventoryQuantity: number
  inventoryValue: number
  daily: readonly DashboardDay[]
}

export interface DashboardDay {
  date: string
  salesAmount: number
  movementCount: number
}

export interface RecentMovement {
  id: string
  documentType: string
  status: string
  createdAt: string
}

export interface RecentMovementsQuery {
  page: number
  pageSize: number
  search: string
}

export interface RecentMovementsPage {
  items: Array<{ id: string; cells: Record<string, string> }>
  page: number
  pageSize: number
  total: number
}

const movementName: Record<string, string> = { purchase: 'Compra', opening: 'Apertura', sale: 'Venta', shrinkage: 'Merma', adjustment: 'Ajuste', void: 'Anulación' }

export async function loadRecentMovements(companyId: string, query: RecentMovementsQuery): Promise<RecentMovementsPage> {
  const url = new URL('/erp/inventory-documents', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  url.searchParams.set('page', String(query.page))
  url.searchParams.set('pageSize', String(query.pageSize))
  url.searchParams.set('search', query.search)
  const response = await authenticatedFetch(url, { credentials: 'include' })
  if (!response.ok) throw new Error('movements')
  const payload: unknown = await response.json()
  if (!isRecord(payload) || !Array.isArray(payload.items)) return { items: [], page: query.page, pageSize: query.pageSize, total: 0 }
  const items = payload.items.flatMap((item): RecentMovementsPage['items'] => {
    if (!isRecord(item) || typeof item.id !== 'string') return []
    const documentType = typeof item.documentType === 'string' ? item.documentType : ''
    const createdAt = typeof item.createdAt === 'string' ? item.createdAt : ''
    const status = typeof item.status === 'string' ? item.status : ''
    return [{ id: item.id, cells: {
      date: createdAt ? new Date(createdAt).toLocaleDateString('es-HN') : '—',
      movement: movementName[documentType] ?? documentType,
      status: status === 'confirmed' ? 'Confirmado' : status,
      reference: item.id.slice(0, 8),
    } }]
  })
  return {
    items,
    page: numberOf(payload.page) || query.page,
    pageSize: numberOf(payload.pageSize) || query.pageSize,
    total: numberOf(payload.total),
  }
}

export async function loadDashboard(companyId: string): Promise<DashboardSnapshot> {
  const url = new URL('/erp/reports/dashboard', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  url.searchParams.set('to', localDate())
  url.searchParams.set('days', '30')
  const response = await authenticatedFetch(url, { credentials: 'include' })
  if (!response.ok) {
    throw new Error('dashboard')
  }
  return readSnapshot(await response.json())
}

function readSnapshot(payload: unknown): DashboardSnapshot {
  if (!isRecord(payload)) {
    return { salesAmount: 0, shrinkageCost: 0, inventoryQuantity: 0, inventoryValue: 0, daily: [] }
  }
  const inventory = isRecord(payload.inventory) ? payload.inventory : {}
  return {
    salesAmount: numberOf(payload.salesAmount),
    shrinkageCost: numberOf(payload.shrinkageCost),
    inventoryQuantity: numberOf(inventory.quantity),
    inventoryValue: numberOf(inventory.value),
    daily: Array.isArray(payload.daily) ? payload.daily.flatMap(readDashboardDay) : [],
  }
}

function readDashboardDay(value: unknown): DashboardDay[] {
  if (!isRecord(value) || typeof value.date !== 'string') {
    return []
  }
  return [{ date: value.date, salesAmount: numberOf(value.salesAmount), movementCount: numberOf(value.movementCount) }]
}

function localDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
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
