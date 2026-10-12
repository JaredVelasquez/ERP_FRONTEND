import { appConfig } from '@/app/config/app-config'
import { CASH_ACCOUNT, type CardPresentation } from './domain/scan-ticket'

export interface StockCard {
  productId: string
  name: string
  internalBarcode: string
  baseQuantity: number
  resolvedUnit: string | null
  presentations: CardPresentation[]
}

export interface PostedLine {
  accountCode: string
  debit: number
  credit: number
}

export type LookupResult = StockCard | 'unknown' | 'failed'

export async function searchByName(companyId: string, name: string): Promise<Array<{ name: string; barcode: string }>> {
  const url = new URL('/erp/products', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  url.searchParams.set('page', '1')
  url.searchParams.set('pageSize', '8')
  url.searchParams.set('search', '')
  url.searchParams.set('name', name)
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) {
    return []
  }
  return readNameHits(await response.json())
}

export async function lookupCode(companyId: string, code: string): Promise<LookupResult> {
  const url = new URL('/erp/stock-cards', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  url.searchParams.set('code', code)
  const response = await fetch(url, { credentials: 'include' })
  if (response.status === 400) {
    const message = await readMessage(response)
    if (message === 'Product was not found') {
      return 'unknown'
    }
    return 'failed'
  }
  if (!response.ok) {
    return 'failed'
  }
  return readCard(await response.json())
}

export async function seedChart(companyId: string): Promise<boolean> {
  const url = new URL('/erp/accounts', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  const response = await fetch(url, { credentials: 'include' })
  return response.ok
}

export async function confirmMovement(input: {
  companyId: string
  type: 'purchase' | 'sale'
  lines: Array<{
    productId: string
    presentationFactor: number
    quantity: number
    unitCost: number | null
    saleAmount: number | null
  }>
}): Promise<{ journal: PostedLine[] } | { error: string }> {
  const response = await fetch(`${appConfig.gatewayUrl}/erp/inventory-documents/confirm`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      companyId: input.companyId,
      type: input.type,
      idempotencyKey: crypto.randomUUID(),
      receivedAt: new Date().toISOString(),
      paymentAccountCode: input.type === 'purchase' ? CASH_ACCOUNT : null,
      collectionAccountCode: input.type === 'sale' ? CASH_ACCOUNT : null,
      lines: input.lines.map((line) => ({
        ...line,
        selectedLayerId: null,
        expiresOn: null,
      })),
    }),
  })
  if (!response.ok) {
    return { error: await readMessage(response) }
  }
  return { journal: readJournal(await response.json()) }
}

function readNameHits(payload: unknown): Array<{ name: string; barcode: string }> {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return []
  }
  return payload.items.flatMap(readNameHit)
}

function readNameHit(value: unknown): Array<{ name: string; barcode: string }> {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.internalBarcode !== 'string') {
    return []
  }
  if (value.internalBarcode === '') {
    return []
  }
  return [{ name: value.name, barcode: value.internalBarcode }]
}

function readCard(payload: unknown): LookupResult {
  if (!isRecord(payload) || !isRecord(payload.card)) {
    return 'failed'
  }
  const card = payload.card
  if (typeof card.productId !== 'string' || typeof card.name !== 'string') {
    return 'failed'
  }
  return {
    productId: card.productId,
    name: card.name,
    internalBarcode: typeof card.internalBarcode === 'string' ? card.internalBarcode : '',
    baseQuantity: numberOf(card.baseQuantity),
    resolvedUnit: typeof card.resolvedUnit === 'string' ? card.resolvedUnit : null,
    presentations: Array.isArray(card.presentations) ? card.presentations.flatMap(readPresentation) : [],
  }
}

function readPresentation(value: unknown): CardPresentation[] {
  if (!isRecord(value) || typeof value.unit !== 'string') {
    return []
  }
  return [{
    unit: value.unit,
    factor: numberOf(value.factor),
    salePrice: value.salePrice === null || value.salePrice === undefined ? null : numberOf(value.salePrice),
  }]
}

function readJournal(payload: unknown): PostedLine[] {
  if (!isRecord(payload) || !isRecord(payload.document) || !Array.isArray(payload.document.journal)) {
    return []
  }
  return payload.document.journal.flatMap(readPostedLine)
}

function readPostedLine(value: unknown): PostedLine[] {
  if (!isRecord(value) || typeof value.accountCode !== 'string') {
    return []
  }
  return [{ accountCode: value.accountCode, debit: numberOf(value.debit), credit: numberOf(value.credit) }]
}

async function readMessage(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => null)
  if (!isRecord(payload) || typeof payload.message !== 'string') {
    return ''
  }
  return payload.message
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
