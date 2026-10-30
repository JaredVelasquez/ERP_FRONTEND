import { authenticatedFetch } from '@/shared/api/http-client'
import { z } from 'zod'
import { appConfig } from '@/app/config/app-config'
import { APP_MODULES, type ModuleGrant } from '@/modules/access'

const grant = z.object({ module: z.enum(APP_MODULES), access: z.enum(['view', 'edit']) })
const companyUser = z.object({
  id: z.string(), email: z.string(), displayName: z.string(), role: z.enum(['owner', 'operator', 'platform-admin']),
  active: z.boolean(), grants: z.array(grant),
})
export type CompanyUser = z.infer<typeof companyUser>

export async function listCompanyUsers(): Promise<CompanyUser[]> {
  return z.array(companyUser).parse(await request('/identity/users'))
}

export async function createCompanyUser(input: { email: string; displayName: string; password: string; companyId: string }): Promise<void> {
  await request('/identity/users', 'POST', { ...input, role: 'operator' })
}

export async function setCompanyUserActive(userId: string, active: boolean): Promise<void> {
  await request(`/identity/users/${encodeURIComponent(userId)}/active`, 'PATCH', { active })
}

export async function setCompanyUserGrants(userId: string, companyId: string, grants: ModuleGrant[]): Promise<void> {
  await request(`/identity/users/${encodeURIComponent(userId)}/modules`, 'PUT', { companyId, grants })
}

export async function changeOwnPassword(userId: string, currentPassword: string, password: string): Promise<void> {
  await request(`/identity/users/${encodeURIComponent(userId)}/password`, 'PUT', { currentPassword, password })
}

const aiSettings = z.object({ provider: z.enum(['gemini', 'anthropic', 'openai']), model: z.string(), keyHint: z.string(), configured: z.boolean() })
export type AiSettings = z.infer<typeof aiSettings>

export async function readAiSettings(): Promise<AiSettings> {
  return aiSettings.parse(await request('/mcp/assistant/settings'))
}

export async function saveAiSettings(input: { provider: AiSettings['provider']; model: string; apiKey?: string }): Promise<AiSettings> {
  return aiSettings.parse(await request('/mcp/assistant/settings', 'PUT', input))
}

const paymentSettings = z.object({
  paymentMethods: z.array(z.object({
    id: z.string().uuid(), name: z.string(), kind: z.enum(['cash', 'card', 'bank-transfer', 'supplier-credit']),
    collectionAccountCode: z.string().nullable(), paymentAccountCode: z.string().nullable(), active: z.boolean(),
  })),
  bankAccounts: z.array(z.object({
    id: z.string().uuid(), bankName: z.string(), accountName: z.string(), maskedNumber: z.string(),
    currency: z.literal('HNL'), accountCode: z.string(), active: z.boolean(),
  })),
})
const paymentAccount = z.object({ code: z.string(), name: z.string(), kind: z.string(), postable: z.boolean(), collection: z.boolean() })
const paymentSettingsResponse = z.object({ settings: paymentSettings, accounts: z.array(paymentAccount) })
export type PaymentSettings = z.infer<typeof paymentSettings>
export type PaymentAccount = z.infer<typeof paymentAccount>

const companyControls = z.object({
  fiscalProfile: z.object({
    environment: z.enum(['sandbox', 'production']), taxRegime: z.enum(['not-confirmed', 'general', 'simplified']),
    legalName: z.string(), rtn: z.string(), address: z.string(), phone: z.string(), email: z.string(),
    emissionMode: z.enum(['sandbox', 'preprinted', 'auto-printer', 'electronic']), requireFiscalDocument: z.boolean(),
  }),
  establishments: z.array(z.object({ id: z.string().uuid(), code: z.string(), emissionPointCode: z.string(), name: z.string(), address: z.string(), active: z.boolean() })),
  precision: z.object({ quantityDigits: z.number().int(), unitCostDigits: z.number().int(), calculationDigits: z.number().int(), reportDigits: z.number().int(), documentDigits: z.number().int(), roundingMode: z.enum(['half-up', 'half-even']) }),
  costingMethod: z.enum(['PEPS', 'UEPS', 'FEFO', 'AVERAGE', 'SPECIFIC']),
  warehouses: z.array(z.object({ id: z.string().uuid(), code: z.string(), name: z.string(), active: z.boolean(), isDefault: z.boolean() })),
  periods: z.array(z.object({ id: z.string().uuid(), name: z.string(), startsOn: z.string(), endsOn: z.string(), status: z.enum(['open', 'closed']), closedAt: z.string().nullable(), reopenedAt: z.string().nullable(), reopenReason: z.string().nullable() })),
  bankStatementLines: z.array(z.object({ id: z.string().uuid(), bankAccountId: z.string().uuid(), transactionDate: z.string(), reference: z.string(), description: z.string(), amount: z.number(), status: z.enum(['open', 'matched', 'ignored']), matchedJournalEntryId: z.string().uuid().nullable() })),
  bankAccounts: z.array(z.object({ id: z.string().uuid(), label: z.string() })),
  reconciliation: z.object({ fiscalTotal: z.number(), salesTotal: z.number(), fiscalDifference: z.number(), openBankTotal: z.number() }),
})
export type CompanyControls = z.infer<typeof companyControls>

export async function readCompanyControls(): Promise<CompanyControls> {
  return companyControls.parse(await request('/erp/company-controls'))
}

export async function readWarehouses(): Promise<CompanyControls['warehouses']> {
  const value = await request('/erp/company-controls/warehouses')
  return z.object({ warehouses: companyControls.shape.warehouses }).parse(value).warehouses
}

export async function saveCompanyControls(input: Pick<CompanyControls, 'fiscalProfile' | 'precision' | 'costingMethod'> & { costingChangeReason: string }): Promise<void> {
  await request('/erp/company-controls', 'PUT', input)
}

export async function createWarehouse(input: { code: string; name: string }): Promise<void> {
  await request('/erp/company-controls/warehouses', 'POST', input)
}

export async function setDefaultWarehouse(id: string): Promise<void> {
  await request(`/erp/company-controls/warehouses/${encodeURIComponent(id)}/default`, 'PUT', {})
}

export async function renameWarehouse(id: string, name: string): Promise<void> {
  await request(`/erp/company-controls/warehouses/${encodeURIComponent(id)}`, 'PUT', { name })
}

export async function setWarehouseActive(id: string, active: boolean): Promise<void> {
  await request(`/erp/company-controls/warehouses/${encodeURIComponent(id)}/active`, 'PUT', { active })
}

export async function createAccountingPeriod(input: { name: string; startsOn: string; endsOn: string }): Promise<void> {
  await request('/erp/company-controls/periods', 'POST', input)
}

export async function setAccountingPeriodStatus(id: string, status: 'open' | 'closed', reason?: string): Promise<void> {
  await request(`/erp/company-controls/periods/${encodeURIComponent(id)}/status`, 'PUT', { status, reason })
}

export async function importBankStatementLine(input: { bankAccountId: string; transactionDate: string; reference: string; description: string; amount: number }): Promise<void> {
  await request('/erp/company-controls/bank-lines', 'POST', input)
}

export async function setBankStatementLineStatus(id: string, status: 'open' | 'matched' | 'ignored', journalEntryId?: string): Promise<void> {
  await request(`/erp/company-controls/bank-lines/${encodeURIComponent(id)}/status`, 'PUT', { status, journalEntryId })
}

export async function readPaymentSettings(companyId: string): Promise<{ settings: PaymentSettings; accounts: PaymentAccount[] }> {
  const url = new URL('/erp/payment-settings', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  const response = await authenticatedFetch(url, { credentials: 'include' })
  if (!response.ok) throw new Error('No se pudo cargar la configuración de pagos.')
  return paymentSettingsResponse.parse(await response.json())
}

export async function savePaymentSettings(companyId: string, settings: PaymentSettings): Promise<void> {
  const url = new URL('/erp/payment-settings', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  const response = await authenticatedFetch(url, {
    method: 'PUT', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(settings),
  })
  if (!response.ok) {
    const issue: unknown = await response.json().catch(() => null)
    throw new Error(typeof issue === 'object' && issue !== null && 'message' in issue && typeof issue.message === 'string' ? issue.message : 'No se pudo guardar la configuración de pagos.')
  }
}

async function request(path: string, method = 'GET', body?: unknown): Promise<unknown> {
  const response = await authenticatedFetch(new URL(path, appConfig.gatewayUrl), {
    method, credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const issue: unknown = await response.json().catch(() => null)
    throw new Error(typeof issue === 'object' && issue !== null && 'message' in issue && typeof issue.message === 'string'
      ? issue.message : 'No se pudo completar la operación.')
  }
  return response.json()
}

export interface VoucherVoidApproverSettings {
  designatedApproverId: string | null
  approvers: Array<{ id: string; name: string; email: string }>
}

export async function readVoucherVoidApproverSettings(): Promise<VoucherVoidApproverSettings> {
  const value = await request('/erp/vouchers/void-approval-settings')
  if (typeof value !== 'object' || value === null) throw new Error('No se pudo leer la configuración de anulaciones.')
  const record = value as Record<string, unknown>
  if (!Array.isArray(record.approvers)) throw new Error('Configuración inválida.')
  return { designatedApproverId: typeof record.designatedApproverId === 'string' ? record.designatedApproverId : null,
    approvers: record.approvers as VoucherVoidApproverSettings['approvers'] }
}

export async function designateVoucherVoidApprover(userId: string | null): Promise<void> {
  await request('/erp/vouchers/void-approval-settings', 'POST', { userId })
}
