import { authenticatedFetch } from '@/shared/api/http-client'
import { appConfig } from '@/app/config/app-config'

export interface CatalogProduct {
  id: string
  name: string
  itemType: 'product' | 'service'
  taxCategoryCode: string
  active: boolean
  presentations: CatalogPresentation[]
  category: string
  supplier: string
  barcode: string
  presentation: string
  factor: string
  salePrice: string
  stock: string
  costingMethod: ProductCostingMethod | null
}

export interface CatalogPresentation {
  unit: string
  factor: number
  sellable: boolean
  purchasable: boolean
  salePrice: number | null
  referenceUnitCost: number | null
}

export interface CatalogPage {
  items: CatalogProduct[]
  page: number
  pageSize: number
  total: number
}

export type ProductCostingMethod = 'PEPS' | 'UEPS' | 'FEFO' | 'AVERAGE' | 'SPECIFIC'

export async function createCatalogProduct(input: { companyId: string; name: string; itemType: 'product' | 'service'; unit: string; factor: number; salePrice: number | null; costingMethod: ProductCostingMethod | null }): Promise<void> {
  const response = await authenticatedFetch(`${appConfig.gatewayUrl}/erp/products`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      companyId: input.companyId,
      name: input.name.trim(),
      itemType: input.itemType,
      category: '',
      baseUnit: 'unidad',
      tracksExpiry: false,
      costingMethod: input.itemType === 'service' ? null : input.costingMethod,
      marginPercent: null,
      taxCategoryCode: 'none',
      presentations: [{ unit: input.unit.trim() || (input.itemType === 'service' ? 'servicio' : 'unidad'), factor: input.factor, purchasable: input.itemType === 'product', sellable: input.salePrice !== null, salePrice: input.salePrice, manufacturerBarcode: null }],
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
  itemType?: 'product' | 'service' | 'all'
}): Promise<CatalogPage> {
  const url = new URL('/erp/products', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  url.searchParams.set('page', String(query.page))
  url.searchParams.set('pageSize', String(query.pageSize))
  url.searchParams.set('search', query.search)
  url.searchParams.set('sort', query.sort)
  url.searchParams.set('itemType', query.itemType ?? 'product')
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
  const presentations = readPresentations(value.presentations)
  const presentation = productPresentation(presentations[0] ?? emptyPresentation())
  return [
    {
      id: typeof value.id === 'string' ? value.id : value.name,
      name: value.name,
      itemType: value.itemType === 'service' ? 'service' : 'product',
      taxCategoryCode: typeof value.taxCategoryCode === 'string' ? value.taxCategoryCode : 'none',
      active: value.active !== false,
      presentations,
      category: typeof value.category === 'string' ? value.category : '',
      supplier: typeof value.supplier === 'string' ? value.supplier : '',
      barcode: typeof value.internalBarcode === 'string' ? value.internalBarcode : '',
      presentation: presentation.unit,
      factor: presentation.factor,
      salePrice: presentation.salePrice,
      stock: '0',
      costingMethod: readCostingMethod(value.costingMethod),
    },
  ]
}

function readCostingMethod(value: unknown): ProductCostingMethod | null {
  return value === 'PEPS' || value === 'UEPS' || value === 'FEFO' || value === 'AVERAGE' || value === 'SPECIFIC' ? value : null
}

export async function setProductCostingMethod(productId: string, costingMethod: ProductCostingMethod | null, reason: string): Promise<void> {
  const response = await authenticatedFetch(`${appConfig.gatewayUrl}/erp/products/${encodeURIComponent(productId)}/costing-method`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ costingMethod, reason }),
  })
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    throw new Error(isRecord(payload) && typeof payload.message === 'string' ? payload.message : 'No se pudo cambiar el método de costeo.')
  }
}

function numberOf(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return parsed
}

function readPresentations(value: unknown): CatalogPresentation[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => isRecord(row) && typeof row.unit === 'string' ? [{
    unit: row.unit,
    factor: numberOf(row.factor, 1),
    sellable: row.sellable === true,
    purchasable: row.purchasable === true,
    salePrice: nullableNumber(row.salePrice),
    referenceUnitCost: nullableNumber(row.referenceUnitCost),
  }] : [])
}

function emptyPresentation(): CatalogPresentation {
  return { unit: '', factor: 1, sellable: false, purchasable: false, salePrice: null, referenceUnitCost: null }
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function productPresentation(value: CatalogPresentation): { unit: string; factor: string; salePrice: string } {
  return {
    unit: value.unit,
    factor: String(value.factor),
    salePrice: value.salePrice === null ? '—' : String(value.salePrice),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
