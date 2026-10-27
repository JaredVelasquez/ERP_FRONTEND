import { authenticatedFetch } from '@/shared/api/http-client'
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

export async function createCatalogProduct(input: { companyId: string; name: string; unit: string; factor: number; salePrice: number | null }): Promise<void> {
  const response = await authenticatedFetch(`${appConfig.gatewayUrl}/erp/products`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      companyId: input.companyId,
      name: input.name.trim(),
      category: '',
      baseUnit: 'unidad',
      tracksExpiry: false,
      costingMethod: null,
      marginPercent: null,
      taxCategoryCode: 'none',
      presentations: [{ unit: input.unit.trim() || 'unidad', factor: input.factor, purchasable: true, sellable: input.salePrice !== null, salePrice: input.salePrice, manufacturerBarcode: null }],
    }),
  })
  if (!response.ok) {
    throw new Error(response.status === 403 ? 'Solo gerencia o la persona aprobadora puede crear un producto con precio inicial.' : 'No se pudo guardar el producto.')
  }
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
  const response = await authenticatedFetch(url, { credentials: 'include' })
  if (!response.ok) {
    throw new Error('products')
  }
  return readPage(await response.json())
}

export async function createBarcodeSheet(companyId: string, productIds: readonly string[]): Promise<Blob> {
  const response = await authenticatedFetch(`${appConfig.gatewayUrl}/erp/barcode-sheets`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ companyId, productIds }),
  })
  if (!response.ok) throw new Error('barcode-sheet')
  const payload: unknown = await response.json()
  if (!isRecord(payload) || typeof payload.pdfBase64 !== 'string' || payload.pdfBase64.length === 0) {
    throw new Error('barcode-sheet-invalid')
  }
  const binary = window.atob(payload.pdfBase64)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new Blob([bytes], { type: 'application/pdf' })
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
    salePrice: row.salePrice === undefined || row.salePrice === null ? 'â€”' : String(row.salePrice),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
