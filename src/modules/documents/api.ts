import { appConfig } from '@/app/config/app-config'
import type { PageResult } from '@/shared/ui/server-table'

export async function listVouchers(companyId: string, query: { page: number; pageSize: number; search: string }): Promise<PageResult> {
  const url = new URL('/erp/vouchers', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  url.searchParams.set('page', String(query.page))
  url.searchParams.set('pageSize', String(query.pageSize))
  url.searchParams.set('search', query.search)
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) {
    throw new Error('vouchers')
  }
  return readVouchers(await response.json())
}

function readVouchers(payload: unknown): PageResult {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return { items: [], page: 1, pageSize: 25, total: 0 }
  }
  return {
    items: payload.items.flatMap(readVoucher),
    page: numberOf(payload.page),
    pageSize: numberOf(payload.pageSize),
    total: numberOf(payload.total),
  }
}

function readVoucher(value: unknown): PageResult['items'] {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return []
  }
  return [{
    id: value.id,
    cells: {
      reference: text(value.reference),
      holder: text(value.holder),
      amount: text(value.amount),
      occurredOn: text(value.occurredOn),
    },
  }]
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function numberOf(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }
  return parsed
}

export interface VoucherDraft {
  companyId: string
  serviceType: string
  serviceNote: string
  amount: number
  currency: 'HNL' | 'USD'
  reference: string
  holder: string
  institution: string
  dni: string
  phone: string
  occurredOn: string
  acceptedDeclaration: boolean
  signature: string
  bankReference: string
  moneyMovementId: string | null
}

export async function saveSignedVoucher(draft: VoucherDraft): Promise<{ id: string }> {
  const created = await fetch(`${appConfig.gatewayUrl}/erp/vouchers`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(draft),
  })
  if (!created.ok) {
    throw new Error(await serverMessage(created))
  }
  const id = readVoucherId(await created.json())
  const confirmed = await fetch(confirmUrl(draft.companyId, id), {
    method: 'POST',
    credentials: 'include',
  })
  if (!confirmed.ok) {
    throw new Error(await serverMessage(confirmed))
  }
  return { id }
}

export async function downloadVoucherPdf(companyId: string, voucherId: string): Promise<void> {
  const url = new URL(`/erp/vouchers/${voucherId}/pdf`, appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) {
    throw new Error(await serverMessage(response))
  }
  const payload: unknown = await response.json()
  const pdfBase64 = readPdf(payload)
  savePdf(pdfBase64, `comprobante-${voucherId}.pdf`)
}

function confirmUrl(companyId: string, voucherId: string): string {
  const url = new URL(`/erp/vouchers/${voucherId}/confirm`, appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  return url.toString()
}

function readVoucherId(payload: unknown): string {
  const voucher = isRecord(payload) ? payload.voucher : null
  if (!isRecord(voucher) || typeof voucher.id !== 'string' || voucher.id.trim() === '') {
    throw new Error('No se pudo guardar el comprobante.')
  }
  return voucher.id
}

function readPdf(payload: unknown): string {
  if (!isRecord(payload) || typeof payload.pdfBase64 !== 'string' || payload.pdfBase64.trim() === '') {
    throw new Error('No se pudo descargar el PDF.')
  }
  return payload.pdfBase64
}

async function serverMessage(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => null)
  if (!isRecord(payload) || typeof payload.message !== 'string' || payload.message.trim() === '') {
    return 'No se pudo guardar el comprobante.'
  }
  return payload.message
}

function savePdf(pdfBase64: string, fileName: string): void {
  const bytes = Uint8Array.from(atob(pdfBase64), (char) => char.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
