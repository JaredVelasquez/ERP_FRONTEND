import { z } from 'zod'
import { appConfig } from '@/app/config/app-config'
import { authenticatedFetch } from '@/shared/api/http-client'

const fiscalLineSchema = z.object({
  productId: z.string(),
  description: z.string(),
  quantity: z.number(),
  unitCost: z.number(),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
})

const eligibleSaleSchema = z.object({
  id: z.string(),
  occurredAt: z.string(),
  subtotal: z.number(),
  taxRate: z.number(),
  taxTotal: z.number(),
  total: z.number(),
  lineCount: z.number().int().nonnegative(),
  lines: z.array(fiscalLineSchema),
})

const fiscalDocumentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  sourceSaleDocumentId: z.string(),
  documentNumber: z.string(),
  status: z.enum(['issued', 'voided']),
  authorizationId: z.string(),
  authorizationCode: z.literal('DEV-NOT-VALID'),
  authorizationNumber: z.number().int(),
  issuedAt: z.string(),
  taxCode: z.literal('DEV-TAX'),
  taxRate: z.number(),
  subtotal: z.number(),
  taxTotal: z.number(),
  total: z.number(),
  issuer: z.object({ name: z.string(), taxId: z.string(), address: z.string(), environment: z.literal('sandbox'), legallyValid: z.literal(false) }),
  lines: z.array(fiscalLineSchema),
  templateId: z.string(),
  templateVersion: z.number().int(),
  rendererVersion: z.string(),
  snapshotHash: z.string(),
})

export type EligibleSandboxSale = z.infer<typeof eligibleSaleSchema>
export type SandboxFiscalDocument = z.infer<typeof fiscalDocumentSchema>

export async function listEligibleSandboxSales(): Promise<EligibleSandboxSale[]> {
  const payload = await request('/erp/fiscal/sandbox/documents/eligible-sales')
  const parsed = z.object({ sales: z.array(eligibleSaleSchema) }).safeParse(payload)
  if (!parsed.success) {
    console.error('Invalid eligible-sales response contract:', parsed.error)
    throw new Error('El servicio fiscal necesita actualizarse. Reinicia el backend ERP y vuelve a cargar esta pantalla.')
  }
  return parsed.data.sales
}

export async function listSandboxFiscalDocuments(): Promise<SandboxFiscalDocument[]> {
  const payload = await request('/erp/fiscal/sandbox/documents')
  return z.object({ documents: z.array(fiscalDocumentSchema) }).parse(payload).documents
}

export async function issueSandboxFiscalDocument(sourceSaleDocumentId: string): Promise<SandboxFiscalDocument> {
  const payload = await request('/erp/fiscal/sandbox/documents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sourceSaleDocumentId, idempotencyKey: crypto.randomUUID() }),
  })
  return z.object({ document: fiscalDocumentSchema }).parse(payload).document
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await authenticatedFetch(new URL(path, appConfig.gatewayUrl), { ...init, credentials: 'include' })
  if (!response.ok) throw new Error(await responseError(response))
  return response.json() as Promise<unknown>
}

async function responseError(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => null)
  if (isRecord(payload) && typeof payload.message === 'string') return payload.message
  return `No se pudieron cargar los documentos (${response.status}).`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
