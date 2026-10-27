import { authenticatedFetch } from '@/shared/api/http-client'
import { z } from 'zod'
import { appConfig } from '@/app/config/app-config'

const priceRowSchema = z.object({
  productId: z.string(), presentationId: z.string(), name: z.string(),
  unit: z.string(), barcode: z.string(),
  referenceUnitCost: z.number().nullable(),
  minimumMarkupPercent: z.number().nullable(),
  suggestedSalePrice: z.number().nullable(),
  managementSalePrice: z.number().nullable(),
})

const proposalSchema = z.object({
  id: z.string(), companyId: z.string(), productId: z.string(), presentationId: z.string(),
  productName: z.string(), unit: z.string(), previousPrice: z.number().nullable(),
  proposedPrice: z.number(), reason: z.string(), proposedBy: z.string(),
  proposerName: z.string(), status: z.enum(['pending', 'approved', 'rejected']),
  proposedAt: z.string(), resolvedBy: z.string().nullable(),
  resolvedAt: z.string().nullable(), resolutionNote: z.string().nullable(),
})

const historySchema = z.object({
  id: z.string(), productName: z.string(), unit: z.string(),
  previousUnitCost: z.number().nullable(), nextUnitCost: z.number().nullable(),
  previousManagementSalePrice: z.number().nullable(), nextManagementSalePrice: z.number().nullable(),
  source: z.string(), sourceRow: z.number().nullable(), reason: z.string(),
  actorName: z.string(), changedAt: z.string(),
})

const settingsSchema = z.object({
  designatedApproverId: z.string().nullable(),
  approvers: z.array(z.object({ id: z.string(), name: z.string(), email: z.string() })),
  canApprove: z.boolean(), canConfigure: z.boolean(),
})

export type CommercialPriceRow = z.infer<typeof priceRowSchema>
export type PriceProposal = z.infer<typeof proposalSchema>
export type CommercialPriceChange = z.infer<typeof historySchema>
export type PriceSettings = z.infer<typeof settingsSchema>

export async function listCommercialPrices(query: { page: number; pageSize: number; search: string }) {
  const url = new URL('/erp/prices/catalog', appConfig.gatewayUrl)
  url.searchParams.set('page', String(query.page))
  url.searchParams.set('pageSize', String(query.pageSize))
  url.searchParams.set('search', query.search)
  const data: unknown = await request(url)
  return z.object({ items: z.array(priceRowSchema), page: z.number(), pageSize: z.number(), total: z.number() }).parse(data)
}

export async function listPriceProposals(page = 1, pageSize = 25): Promise<{ items: PriceProposal[]; hasMore: boolean }> {
  const url = new URL('/erp/prices/proposals', appConfig.gatewayUrl)
  url.searchParams.set('page', String(page))
  url.searchParams.set('pageSize', String(pageSize))
  url.searchParams.set('status', 'pending')
  const data: unknown = await request(url)
  return z.object({ items: z.array(proposalSchema), hasMore: z.boolean() }).parse(data)
}

export async function listCommercialPriceHistory(page = 1, pageSize = 25): Promise<{ items: CommercialPriceChange[]; hasMore: boolean }> {
  const url = new URL('/erp/prices/history', appConfig.gatewayUrl)
  url.searchParams.set('page', String(page))
  url.searchParams.set('pageSize', String(pageSize))
  const data: unknown = await request(url)
  return z.object({ items: z.array(historySchema), hasMore: z.boolean() }).parse(data)
}

export async function readPriceSettings(): Promise<PriceSettings> {
  const data: unknown = await request('/erp/prices/settings')
  return settingsSchema.parse(data)
}

export async function proposeSalePrice(input: { productId: string; unit: string; proposedPrice: number; reason: string }) {
  const data: unknown = await request('/erp/prices/proposals', 'POST', input)
  return z.object({ proposal: proposalSchema }).parse(data).proposal
}

export async function setDirectSalePrice(input: { productId: string; unit: string; price: number; reason: string }): Promise<void> {
  await request('/erp/prices/direct', 'POST', input)
}

export async function resolveSalePriceProposal(id: string, decision: 'approve' | 'reject', note: string) {
  const data: unknown = await request(`/erp/prices/proposals/${encodeURIComponent(id)}/${decision}`, 'POST', { note })
  return z.object({ proposal: proposalSchema }).parse(data).proposal
}

export async function designatePriceApprover(userId: string | null) {
  const data: unknown = await request('/erp/prices/settings', 'PUT', { designatedApproverId: userId })
  return z.object({ designatedApproverId: z.string().nullable() }).parse(data)
}

async function request(path: string | URL, method = 'GET', body?: unknown): Promise<unknown> {
  const url = path instanceof URL ? path : new URL(path, appConfig.gatewayUrl)
  const response = await authenticatedFetch(url, {
    method, credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const issue: unknown = await response.json().catch(() => null)
    if (isRecord(issue) && typeof issue.message === 'string') {
      throw new Error(issue.message)
    }
    throw new Error('No se pudo completar la operaciÃ³n de precios.')
  }
  return response.json()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
