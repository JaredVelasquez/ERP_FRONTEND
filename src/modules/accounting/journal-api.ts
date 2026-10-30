import { authenticatedFetch } from '@/shared/api/http-client'
import { z } from 'zod'
import { appConfig } from '@/app/config/app-config'

const lineSchema = z.object({ accountCode: z.string(), debit: z.number(), credit: z.number() })
const entrySchema = z.object({
  id: z.string(), companyId: z.string(), occurredAt: z.string(), description: z.string(), idempotencyKey: z.string(),
  status: z.enum(['confirmed', 'voided']), createdBy: z.string(), reversalOf: z.string().nullable(), reversalId: z.string().nullable(),
  lines: z.array(lineSchema),
})

export type JournalEntry = z.infer<typeof entrySchema>
export type JournalLine = z.infer<typeof lineSchema>

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await authenticatedFetch(new URL(path, appConfig.gatewayUrl), { credentials: 'include', ...init })
  if (!response.ok) {
    const issue: unknown = await response.json().catch(() => null)
    const message = typeof issue === 'object' && issue !== null && 'message' in issue && typeof issue.message === 'string'
      ? issue.message : 'No se pudo completar la operación contable.'
    throw new Error(message)
  }
  return response.json()
}

export async function listJournalEntries(): Promise<JournalEntry[]> {
  const payload = z.object({ entries: z.array(entrySchema) }).parse(await request('/erp/accounting/journal-entries'))
  return payload.entries
}

export async function postJournalEntry(input: { occurredAt: string; description: string; idempotencyKey: string; lines: JournalLine[] }): Promise<JournalEntry> {
  const payload = z.object({ entry: entrySchema }).parse(await request('/erp/accounting/journal-entries', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
  }))
  return payload.entry
}

export async function voidJournalEntry(entryId: string): Promise<void> {
  await request(`/erp/accounting/journal-entries/${encodeURIComponent(entryId)}/void`, { method: 'POST' })
}
