import { authenticatedFetch } from '@/shared/api/http-client'
import { appConfig } from '@/app/config/app-config'
import type { PageResult } from '@/shared/ui/server-table'

export async function listVouchers(companyId: string, query: { page: number; pageSize: number; search: string }): Promise<PageResult> {
  const url = new URL('/erp/vouchers', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  url.searchParams.set('page', String(query.page))
  url.searchParams.set('pageSize', String(query.pageSize))
  url.searchParams.set('search', query.search)
  const response = await authenticatedFetch(url, { credentials: 'include' })
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
      status: voucherStatus(text(value.status)),
      hasVoucherFile: value.hasVoucherFile === true ? 'true' : 'false',
      hasBankReceipt: value.hasBankReceipt === true ? 'true' : 'false',
      files: [value.hasVoucherFile === true ? 'Comprobante' : '', value.hasBankReceipt === true ? 'Banco' : '']
        .filter(Boolean).join(' · ') || 'Sin archivos',
    },
  }]
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function voucherStatus(status: string): string {
  if (status === 'voided') return 'Anulado'
  if (status === 'confirmed') return 'Confirmado'
  return 'Borrador'
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
  const created = await authenticatedFetch(`${appConfig.gatewayUrl}/erp/vouchers`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(draft),
  })
  if (!created.ok) {
    throw new Error(await serverMessage(created))
  }
  const id = readVoucherId(await created.json())
  const confirmed = await authenticatedFetch(confirmUrl(draft.companyId, id), {
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
  const response = await authenticatedFetch(url, { credentials: 'include' })
  if (!response.ok) {
    throw new Error(await serverMessage(response))
  }
  const payload: unknown = await response.json()
  const pdfBase64 = readPdf(payload)
  savePdf(pdfBase64, `comprobante-${voucherId}.pdf`)
}

export async function fetchVoucherFile(companyId: string, voucherId: string, kind: 'voucher' | 'bank-receipt'): Promise<Blob> {
  const url = voucherFileUrl(companyId, voucherId, kind)
  const response = await authenticatedFetch(url, { credentials: 'include' })
  if (!response.ok) throw new Error(await serverMessage(response))
  return response.blob()
}

export async function uploadBankReceipt(companyId: string, voucherId: string, file: File): Promise<void> {
  const form = new FormData()
  form.append('file', file)
  const response = await authenticatedFetch(voucherFileUrl(companyId, voucherId, 'bank-receipt', true), {
    method: 'POST', credentials: 'include', body: form,
  })
  if (!response.ok) throw new Error(await serverMessage(response))
}

function voucherFileUrl(companyId: string, voucherId: string, kind: 'voucher' | 'bank-receipt', upload = false): URL {
  const path = upload
    ? `/erp/vouchers/${voucherId}/bank-receipt`
    : `/erp/vouchers/${voucherId}/files/${kind}`
  const url = new URL(path, appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  return url
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

export interface VoucherVoidRequest {
  id: string
  voucherId: string
  voucherReference: string
  amount: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  requestedBy: string
  requesterName: string
  requestedAt: string
  resolvedBy: string | null
  resolverName: string | null
  resolvedAt: string | null
  resolutionNote: string | null
}

export interface VoucherVoidQueue { canReview: boolean; requests: VoucherVoidRequest[] }

export async function requestVoucherVoid(voucherId: string, reason: string): Promise<VoucherVoidRequest> {
  const payload = await voucherRequest(`/erp/vouchers/${encodeURIComponent(voucherId)}/void-request`, 'POST', { reason })
  if (!isRecord(payload)) throw new Error('Respuesta inválida de solicitud de anulación.')
  return parseVoidRequest(payload.request)
}

export async function listVoucherVoidRequests(): Promise<VoucherVoidQueue> {
  const payload = await voucherRequest('/erp/vouchers/void-requests')
  if (!isRecord(payload) || !Array.isArray(payload.requests)) return { canReview: false, requests: [] }
  return { canReview: payload.canReview === true, requests: payload.requests.flatMap((item) => {
    try { return [parseVoidRequest(item)] } catch { return [] }
  }) }
}

export async function resolveVoucherVoidRequest(requestId: string, decision: 'approved' | 'rejected', note: string): Promise<void> {
  await voucherRequest(`/erp/vouchers/void-requests/${encodeURIComponent(requestId)}/resolve`, 'POST', { decision, note })
}

async function voucherRequest(path: string, method = 'GET', body?: unknown): Promise<unknown> {
  const response = await authenticatedFetch(new URL(path, appConfig.gatewayUrl), {
    method, credentials: 'include', headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await serverMessage(response))
  return response.json()
}

function parseVoidRequest(value: unknown): VoucherVoidRequest {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.voucherId !== 'string' ||
    typeof value.reason !== 'string' || !['pending', 'approved', 'rejected'].includes(String(value.status))) {
    throw new Error('Respuesta inválida de solicitudes de anulación.')
  }
  return value as unknown as VoucherVoidRequest
}
