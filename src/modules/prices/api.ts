import { appConfig } from '@/app/config/app-config'

export interface SalePriceRow {
  id: string
  name: string
  presentation: string
  salePrice: string
  cost: string
}

export interface SalePricePage {
  items: SalePriceRow[]
  page: number
  pageSize: number
  total: number
}

export async function listSalePrices(
  companyId: string,
  query: { page: number; pageSize: number; search: string },
): Promise<SalePricePage> {
  const url = new URL('/erp/products', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  url.searchParams.set('page', String(query.page))
  url.searchParams.set('pageSize', String(query.pageSize))
  url.searchParams.set('search', query.search)
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) {
    throw new Error('prices')
  }
  return readPage(await response.json())
}

function readPage(payload: unknown): SalePricePage {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return { items: [], page: 1, pageSize: 25, total: 0 }
  }
  return {
    items: payload.items.flatMap(readPrice),
    page: numberOf(payload.page),
    pageSize: numberOf(payload.pageSize),
    total: numberOf(payload.total),
  }
}

function readPrice(value: unknown): SalePriceRow[] {
  if (!isRecord(value) || typeof value.name !== 'string') {
    return []
  }
  const presentation = unitPresentation(value.presentations)
  return [{
    id: typeof value.id === 'string' ? value.id : value.name,
    name: value.name,
    presentation: presentation.unit,
    salePrice: presentation.salePrice,
    cost: '—',
  }]
}

function unitPresentation(value: unknown): { unit: string; salePrice: string } {
  if (!Array.isArray(value)) {
    return { unit: '', salePrice: '—' }
  }
  const unitRow = value.find((item) => isRecord(item) && item.unit === 'unidad')
  if (!isRecord(unitRow)) {
    return { unit: '', salePrice: '—' }
  }
  return {
    unit: 'unidad',
    salePrice: unitRow.salePrice === undefined || unitRow.salePrice === null ? '—' : String(unitRow.salePrice),
  }
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
