import { authenticatedFetch } from '@/shared/api/http-client'
import { appConfig } from '@/app/config/app-config'
import type { AccountNode } from './account'

export async function listAccountTree(companyId: string): Promise<AccountNode[]> {
  const url = new URL('/erp/accounts', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  const response = await authenticatedFetch(url, { credentials: 'include' })
  if (!response.ok) {
    throw new Error('accounts')
  }
  return readNodes(await response.json())
}

export async function updateAccount(
  companyId: string,
  code: string,
  name: string,
  collection: boolean,
): Promise<void> {
  const url = new URL('/erp/accounts', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  const response = await authenticatedFetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, name, collection }),
  })
  if (!response.ok) {
    throw new Error('update-account')
  }
}

function readNodes(payload: unknown): AccountNode[] {
  if (!isRecord(payload) || !Array.isArray(payload.accounts)) {
    return []
  }
  return payload.accounts.flatMap(readNode)
}

function readNode(value: unknown): AccountNode[] {
  if (!isRecord(value) || typeof value.code !== 'string' || typeof value.name !== 'string') {
    return []
  }
  const children = Array.isArray(value.children) ? value.children.flatMap(readNode) : []
  return [{
    code: value.code,
    name: value.name,
    postable: value.postable === true,
    collection: value.collection === true,
    children,
  }]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
