import { z } from 'zod'
import { appConfig } from '@/app/config/app-config'
import { authenticatedFetch } from '@/shared/api/http-client'
import type { TemplateCanvasData } from './types'

export const documentTypes = [
  { value: 'invoice', label: 'Factura' }, { value: 'proforma', label: 'Proforma' }, { value: 'quotation', label: 'Cotización' },
  { value: 'requisition', label: 'Requisición' }, { value: 'purchase_request', label: 'Solicitud de compra' },
  { value: 'purchase_order', label: 'Orden de compra' }, { value: 'warehouse_transfer', label: 'Traslado entre bodegas' },
  { value: 'credit_note', label: 'Nota de crédito' }, { value: 'debit_note', label: 'Nota de débito' },
  { value: 'withholding', label: 'Retención' },
] as const
export type DocumentType = (typeof documentTypes)[number]['value']

const templateSchema = z.object({
  id: z.string(), companyId: z.string(), documentType: z.string(), templateKey: z.string(), name: z.string(),
  version: z.number(), status: z.enum(['draft', 'published', 'archived']), pageSize: z.enum(['A4', 'LETTER']),
  orientation: z.enum(['portrait', 'landscape']), marginMm: z.number(), accentColor: z.string(), includeLogo: z.boolean(),
  headerText: z.string(), footerText: z.string(), createdBy: z.string(), createdAt: z.string(), publishedAt: z.string().nullable(),
  layoutDefinition: z.unknown().nullable().optional(),
})
const documentSchema = z.object({
  id: z.string(), companyId: z.string(), documentType: z.string(), documentNumber: z.string(), status: z.string(),
  idempotencyKey: z.string(), templateId: z.string(), templateVersion: z.number(), snapshotHash: z.string(),
  createdBy: z.string(), createdAt: z.string(), snapshot: z.object({
    documentType: z.string(), documentNumber: z.string(), issuedAt: z.string(), companyName: z.string(), companyLogoUrl: z.string().nullable(),
    recipientName: z.string(), recipientReference: z.string(), notes: z.string(),
    details: z.object({ department: z.string(), requestedBy: z.string(), requiredDate: z.string(), deliveryDate: z.string(), relatedDocumentNumber: z.string(), relatedDocumentId: z.string().nullable(), reason: z.string(), originWarehouse: z.string(), destinationWarehouse: z.string(), withholdingRate: z.number().nullable() }),
    lines: z.array(z.object({ productId: z.string().optional(), itemType: z.enum(['product', 'service']).optional(), description: z.string(), presentationUnit: z.string().optional(), quantity: z.number(), unitPrice: z.number(), amount: z.number(), taxCategoryCode: z.string().optional(), taxRate: z.number().optional(), taxAmount: z.number().optional() })),
    subtotal: z.number(), taxRate: z.number(), taxTotal: z.number(), total: z.number(),
    template: z.object({ id: z.string(), version: z.number(), pageSize: z.enum(['A4', 'LETTER']), orientation: z.enum(['portrait', 'landscape']), marginMm: z.number(), accentColor: z.string(), includeLogo: z.boolean(), headerText: z.string(), footerText: z.string(), layoutDefinition: z.unknown().nullable().optional() }),
    environment: z.literal('sandbox'), legallyValid: z.literal(false),
  }),
})
export type DocumentTemplate = z.infer<typeof templateSchema>
export type BusinessDocument = z.infer<typeof documentSchema>

export async function listTemplates(): Promise<DocumentTemplate[]> {
  const data = await request('/erp/document-templates')
  return z.object({ templates: z.array(templateSchema) }).parse(data).templates
}
export async function createTemplate(input: Omit<DocumentTemplate, 'id' | 'companyId' | 'version' | 'status' | 'createdBy' | 'createdAt' | 'publishedAt'>): Promise<DocumentTemplate> {
  const data = await request('/erp/document-templates', { method: 'POST', body: JSON.stringify(input) })
  return z.object({ template: templateSchema }).parse(data).template
}
export async function createVisualTemplate(input: Omit<DocumentTemplate, 'id' | 'companyId' | 'version' | 'status' | 'createdBy' | 'createdAt' | 'publishedAt'> & { layoutDefinition: TemplateCanvasData | null }): Promise<DocumentTemplate> {
  const data = await request('/erp/document-templates', { method: 'POST', body: JSON.stringify(input) })
  return z.object({ template: templateSchema }).parse(data).template
}
export async function publishTemplate(id: string): Promise<void> {
  await request(`/erp/document-templates/${encodeURIComponent(id)}/publish`, { method: 'POST' })
}
export async function listBusinessDocuments(): Promise<BusinessDocument[]> {
  const data = await request('/erp/business-documents')
  return z.object({ documents: z.array(documentSchema) }).parse(data).documents
}
export async function createBusinessDocument(input: { idempotencyKey: string; templateId: string; documentType: DocumentType; recipientName: string; recipientReference: string; details: { department?: string; requestedBy?: string; requiredDate?: string; deliveryDate?: string; relatedDocumentNumber?: string; reason?: string; originWarehouse?: string; destinationWarehouse?: string; withholdingRate?: number | null }; notes: string; lines: { productId: string; presentationUnit: string; quantity: number }[] }): Promise<BusinessDocument> {
  const data = await request('/erp/business-documents', { method: 'POST', body: JSON.stringify(input) })
  return z.object({ document: documentSchema }).parse(data).document
}
async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await authenticatedFetch(new URL(path, appConfig.gatewayUrl), {
    ...init, credentials: 'include', headers: init?.body ? { 'content-type': 'application/json', ...init.headers } : init?.headers,
  })
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    if (typeof payload === 'object' && payload !== null && 'message' in payload && typeof payload.message === 'string') throw new Error(payload.message)
    throw new Error(`No se pudo completar la operación (${response.status}).`)
  }
  return response.json() as Promise<unknown>
}
