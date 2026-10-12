import { appConfig } from '@/app/config/app-config'

export interface CatalogProduct {
  id: string
  name: string
  category: string
  supplier: string
  barcode: string
  presentation: string
  factor: string
  salePrice: string
  stock: string
}

export interface CatalogPage {
  items: CatalogProduct[]
  page: number
  pageSize: number
  total: number
}

export async function listCatalog(companyId: string, query: {
  page: number
  pageSize: number
  search: string
  sort: string
}): Promise<CatalogPage> {
  const url = new URL('/erp/products', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  url.searchParams.set('page', String(query.page))
  url.searchParams.set('pageSize', String(query.pageSize))
  url.searchParams.set('search', query.search)
  url.searchParams.set('sort', query.sort)
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) {
    throw new Error('products')
  }
  return readPage(await response.json())
}

function readPage(payload: unknown): CatalogPage {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return { items: [], page: 1, pageSize: 25, total: 0 }
  }
  return {
    items: payload.items.flatMap(readProduct),
    page: numberOf(payload.page, 1),
    pageSize: numberOf(payload.pageSize, 25),
    total: numberOf(payload.total, 0),
  }
}

function readProduct(value: unknown): CatalogProduct[] {
  if (!isRecord(value) || typeof value.name !== 'string') {
    return []
  }
  const presentation = firstPresentation(value.presentations)
  return [
    {
      id: typeof value.id === 'string' ? value.id : value.name,
      name: value.name,
      category: typeof value.category === 'string' ? value.category : '',
      supplier: typeof value.supplier === 'string' ? value.supplier : '',
      barcode: typeof value.internalBarcode === 'string' ? value.internalBarcode : '',
      presentation: presentation.unit,
      factor: presentation.factor,
      salePrice: presentation.salePrice,
      stock: '0',
    },
  ]
}

function numberOf(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return parsed
}

function firstPresentation(value: unknown): { unit: string; factor: string; salePrice: string } {
  if (!Array.isArray(value)) {
    return { unit: '', factor: '', salePrice: '' }
  }
  const unitRow = value.find((item) => isRecord(item) && item.unit === 'unidad')
  const row = isRecord(unitRow) ? unitRow : value.find((item) => isRecord(item))
  if (!isRecord(row)) {
    return { unit: '', factor: '', salePrice: '' }
  }
  return {
    unit: typeof row.unit === 'string' ? row.unit : '',
    factor: row.factor === undefined || row.factor === null ? '' : String(row.factor),
    salePrice: row.salePrice === undefined || row.salePrice === null ? '—' : String(row.salePrice),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
