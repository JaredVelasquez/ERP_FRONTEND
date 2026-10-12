import { appConfig } from '@/app/config/app-config'

export interface DashboardSnapshot {
  salesAmount: number
  shrinkageCost: number
  inventoryQuantity: number
  inventoryValue: number
}

export async function loadDashboard(companyId: string): Promise<DashboardSnapshot> {
  const url = new URL('/erp/reports/dashboard', appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  url.searchParams.set('to', localDate())
  url.searchParams.set('days', '30')
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) {
    throw new Error('dashboard')
  }
  return readSnapshot(await response.json())
}

function readSnapshot(payload: unknown): DashboardSnapshot {
  if (!isRecord(payload)) {
    return { salesAmount: 0, shrinkageCost: 0, inventoryQuantity: 0, inventoryValue: 0 }
  }
  const inventory = isRecord(payload.inventory) ? payload.inventory : {}
  return {
    salesAmount: numberOf(payload.salesAmount),
    shrinkageCost: numberOf(payload.shrinkageCost),
    inventoryQuantity: numberOf(inventory.quantity),
    inventoryValue: numberOf(inventory.value),
  }
}

function localDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function numberOf(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }
  return parsed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
