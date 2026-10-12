import type { ColumnSetting } from '@/shared/api/layouts'

export interface ColumnSort {
  column: string
  direction: 'asc' | 'desc'
}

const MENU_WIDTH = 220
const MENU_HEIGHT = 176
const MENU_MARGIN = 8

export function reorderColumnSettings(
  columns: readonly ColumnSetting[],
  activeKey: string,
  overKey: string,
): ColumnSetting[] {
  const ordered = [...columns].sort((left, right) => left.sortOrder - right.sortOrder)
  const from = ordered.findIndex((column) => column.key === activeKey)
  const to = ordered.findIndex((column) => column.key === overKey)
  if (from < 0 || to < 0 || from === to) {
    return stampOrder(ordered)
  }
  return stampOrder(moveColumn(ordered, from, to))
}

export function withVisibility(columns: readonly ColumnSetting[], key: string, visible: boolean): ColumnSetting[] {
  const target = columns.find((column) => column.key === key)
  if (target === undefined || target.visible === visible) {
    return [...columns]
  }
  if (!visible && visibleCount(columns) <= 1) {
    return [...columns]
  }
  return columns.map((column) => applyVisibility(column, key, visible))
}

export function hiddenColumnSettings(columns: readonly ColumnSetting[]): ColumnSetting[] {
  return [...columns].filter((column) => !column.visible).sort((left, right) => left.sortOrder - right.sortOrder)
}

export function canHideColumn(columns: readonly ColumnSetting[]): boolean {
  return visibleCount(columns) > 1
}

export function sortTableRows<T extends { cells: Record<string, string> }>(
  rows: readonly T[],
  sort: ColumnSort | null,
): T[] {
  if (sort === null) {
    return [...rows]
  }
  const direction = sort.direction === 'asc' ? 1 : -1
  return [...rows].sort((left, right) => compareCells(left.cells[sort.column] ?? '', right.cells[sort.column] ?? '') * direction)
}

export function sameColumnLayout(left: readonly ColumnSetting[], right: readonly ColumnSetting[]): boolean {
  if (left.length !== right.length) {
    return false
  }
  return left.every((column, index) => matchesColumn(column, right[index]))
}

export function placeColumnMenu(x: number, y: number, viewportWidth: number, viewportHeight: number): { x: number; y: number } {
  return {
    x: clampAxis(x, viewportWidth, MENU_WIDTH),
    y: clampAxis(y, viewportHeight, MENU_HEIGHT),
  }
}

function moveColumn(columns: ColumnSetting[], from: number, to: number): ColumnSetting[] {
  const next = columns.slice()
  const [item] = next.splice(from, 1)
  if (item === undefined) {
    return columns
  }
  next.splice(to, 0, item)
  return next
}

function stampOrder(columns: readonly ColumnSetting[]): ColumnSetting[] {
  return columns.map((column, sortOrder) => ({ ...column, sortOrder }))
}

function applyVisibility(column: ColumnSetting, key: string, visible: boolean): ColumnSetting {
  if (column.key !== key) {
    return column
  }
  return { ...column, visible }
}

function visibleCount(columns: readonly ColumnSetting[]): number {
  return columns.filter((column) => column.visible).length
}

function compareCells(left: string, right: string): number {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (left !== '' && right !== '' && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber
  }
  return left.localeCompare(right, 'es', { numeric: true, sensitivity: 'base' })
}

function matchesColumn(column: ColumnSetting, other: ColumnSetting | undefined): boolean {
  if (other === undefined) {
    return false
  }
  return column.key === other.key && column.visible === other.visible && column.sortOrder === other.sortOrder
}

function clampAxis(value: number, viewport: number, size: number): number {
  const max = viewport - size - MENU_MARGIN
  if (max < MENU_MARGIN) {
    return MENU_MARGIN
  }
  if (value < MENU_MARGIN) {
    return MENU_MARGIN
  }
  if (value > max) {
    return max
  }
  return value
}
