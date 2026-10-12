import { appConfig } from '@/app/config/app-config'
import { APP_MODULES, type ModuleGrant } from '@/modules/access'
import { loginRequestSchema, loginResponseSchema } from '@/shared/api/erp-client'

export interface SignedSession {
  role: 'platform-admin' | 'owner' | 'operator'
  companyId: string
  companyName: string
  grants: ModuleGrant[]
  logoUrl: string | null
}

export async function loginWithPassword(input: {
  email: string
  password: string
  companyId: string
}): Promise<SignedSession> {
  const companyId = input.companyId.trim()
  const body = loginRequestSchema.parse({
    email: input.email.trim(),
    password: input.password,
    ...(companyId === '' ? {} : { companyId }),
  })
  const response = await fetch(`${appConfig.gatewayUrl}/identity/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error('Login failed')
  }
  const payload: unknown = await response.json()
  const parsed = loginResponseSchema.parse(payload)
  return {
    role: parsed.role,
    companyId: readText(payload, 'companyId'),
    companyName: readText(payload, 'companyName'),
    grants: readGrants(parsed.grants),
    logoUrl: null,
  }
}

export async function readCurrentSession(): Promise<SignedSession | null> {
  const response = await fetch(`${appConfig.gatewayUrl}/erp/session`, { credentials: 'include' })
  if (!response.ok) {
    return null
  }
  return readSignedSession(await response.json())
}

function readSignedSession(payload: unknown): SignedSession | null {
  if (!isRecord(payload) || !Array.isArray(payload.grants)) {
    return null
  }
  const role = payload.role
  if (role !== 'platform-admin' && role !== 'owner' && role !== 'operator') {
    return null
  }
  return {
    role,
    companyId: readText(payload, 'companyId'),
    companyName: readText(payload, 'companyName'),
    grants: readGrants(payload.grants.flatMap(readGrant)),
    logoUrl: readLogo(payload),
  }
}

function readGrant(value: unknown): { module: string; access: 'view' | 'edit' }[] {
  if (!isRecord(value) || typeof value.module !== 'string') {
    return []
  }
  if (value.access !== 'view' && value.access !== 'edit') {
    return []
  }
  return [{ module: value.module, access: value.access }]
}

function readLogo(payload: unknown): string | null {
  const value = readText(payload, 'logoUrl')
  if (value === '') {
    return null
  }
  return value
}

function readText(payload: unknown, field: string): string {
  if (!isRecord(payload)) {
    return ''
  }
  const value = payload[field]
  if (typeof value !== 'string') {
    return ''
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readGrants(grants: readonly { module: string; access: 'view' | 'edit' }[]): ModuleGrant[] {
  return grants.flatMap((grant) => {
    const module = APP_MODULES.find((item) => item === grant.module)
    if (module === undefined) {
      return []
    }
    return [{ module, access: grant.access }]
  })
}
