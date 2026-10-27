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

async function request(path: string, method = 'GET', body?: unknown): Promise<unknown> {
  const response = await authenticatedFetch(new URL(path, appConfig.gatewayUrl), {
    method, credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const issue: unknown = await response.json().catch(() => null)
    throw new Error(typeof issue === 'object' && issue !== null && 'message' in issue && typeof issue.message === 'string'
      ? issue.message : 'No se pudo completar la operaciÃ³n.')
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
