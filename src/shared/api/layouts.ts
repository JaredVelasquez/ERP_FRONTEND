import { appConfig } from '@/app/config/app-config'

export interface ColumnSetting {
  key: string
  visible: boolean
  sortOrder: number
}

export interface WidgetSetting {
  key: string
  visible: boolean
  x: number
  y: number
  w: number
  h: number
}

export interface TableLayout {
  tableKey: string
  pageSize: number
  columns: ColumnSetting[]
}

export interface DashboardLayout {
  widgets: WidgetSetting[]
}

export interface UiPreferences {
  sidebarCollapsed: boolean
}

export async function readTableLayout(tableKey: string): Promise<TableLayout> {
  const response = await fetch(`${appConfig.gatewayUrl}/erp/layouts/tables/${encodeURIComponent(tableKey)}`, {
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error('layout')
  }
  return readTableLayoutBody(await response.json(), tableKey)
}

export async function saveTableLayout(tableKey: string, layout: { pageSize: number; columns: ColumnSetting[] }): Promise<TableLayout> {
  const response = await fetch(`${appConfig.gatewayUrl}/erp/layouts/tables/${encodeURIComponent(tableKey)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(layout),
  })
  if (!response.ok) {
    throw new Error('layout')
  }
  return readTableLayoutBody(await response.json(), tableKey)
}

export async function readDashboardLayout(): Promise<DashboardLayout> {
  const response = await fetch(`${appConfig.gatewayUrl}/erp/layouts/dashboard`, { credentials: 'include' })
  if (!response.ok) {
    throw new Error('layout')
  }
  return { widgets: readWidgets(await response.json()) }
}

export async function saveDashboardLayout(widgets: WidgetSetting[]): Promise<DashboardLayout> {
  const response = await fetch(`${appConfig.gatewayUrl}/erp/layouts/dashboard`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ widgets }),
  })
  if (!response.ok) {
    throw new Error('layout')
  }
  return { widgets: readWidgets(await response.json()) }
}

export async function readUiPreferences(): Promise<UiPreferences> {
  const response = await fetch(`${appConfig.gatewayUrl}/erp/preferences`, { credentials: 'include' })
  if (!response.ok) {
    throw new Error('preferences')
  }
  const payload: unknown = await response.json()
  if (!isRecord(payload) || typeof payload.sidebarCollapsed !== 'boolean') {
    return { sidebarCollapsed: false }
  }
  return { sidebarCollapsed: payload.sidebarCollapsed }
}

export async function saveUiPreferences(preferences: UiPreferences): Promise<UiPreferences> {
  const response = await fetch(`${appConfig.gatewayUrl}/erp/preferences`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(preferences),
  })
  if (!response.ok) {
    throw new Error('preferences')
  }
  const payload: unknown = await response.json()
  if (!isRecord(payload) || typeof payload.sidebarCollapsed !== 'boolean') {
    return preferences
  }
  return { sidebarCollapsed: payload.sidebarCollapsed }
}

function readTableLayoutBody(payload: unknown, tableKey: string): TableLayout {
  if (!isRecord(payload) || !Array.isArray(payload.columns)) {
    return { tableKey, pageSize: 25, columns: [] }
  }
  return {
    tableKey,
    pageSize: pageSizeOf(payload.pageSize),
    columns: payload.columns.flatMap(readColumn),
  }
}

function readWidgets(payload: unknown): WidgetSetting[] {
  if (!isRecord(payload) || !Array.isArray(payload.widgets)) {
    return []
  }
  return payload.widgets.flatMap(readWidget)
}

function readColumn(value: unknown): ColumnSetting[] {
  if (!isRecord(value) || typeof value.key !== 'string' || typeof value.visible !== 'boolean') {
    return []
  }
  return [{ key: value.key, visible: value.visible, sortOrder: numberOf(value.sortOrder) }]
}

function readWidget(value: unknown): WidgetSetting[] {
  if (!isRecord(value) || typeof value.key !== 'string' || typeof value.visible !== 'boolean') {
    return []
  }
  return [{
    key: value.key,
    visible: value.visible,
    x: numberOf(value.x),
    y: numberOf(value.y),
    w: numberOf(value.w),
    h: numberOf(value.h),
  }]
}

function pageSizeOf(value: unknown): number {
  const size = numberOf(value)
  if (size < 1) {
    return 25
  }
  if (size > 100) {
    return 100
  }
  return size
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
