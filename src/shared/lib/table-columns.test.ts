import { describe, expect, it } from 'vitest'
import type { ColumnSetting } from '@/shared/api/layouts'
import {
  canHideColumn,
  hiddenColumnSettings,
  placeColumnMenu,
  reorderColumnSettings,
  sortTableRows,
  withVisibility,
} from './table-columns'

const columns: ColumnSetting[] = [
  { key: 'name', visible: true, sortOrder: 0 },
  { key: 'category', visible: true, sortOrder: 1 },
  { key: 'supplier', visible: false, sortOrder: 2 },
]

describe('table columns', () => {
  it('moves a column to the drop position and renumbers the order', () => {
    expect(reorderColumnSettings(columns, 'supplier', 'name').map((column) => column.key)).toEqual([
      'supplier',
      'name',
      'category',
    ])
  })

  it('keeps the order when the column is dropped on itself', () => {
    expect(reorderColumnSettings(columns, 'name', 'name').map((column) => column.sortOrder)).toEqual([0, 1, 2])
  })

  it('hides a column and refuses to hide the last visible one', () => {
    const hidden = withVisibility(columns, 'category', false)
    expect(hidden.find((column) => column.key === 'category')?.visible).toBe(false)
    expect(canHideColumn(hidden)).toBe(false)
    expect(withVisibility(hidden, 'name', false)).toEqual(hidden)
    expect(hiddenColumnSettings(hidden).map((column) => column.key)).toEqual(['category', 'supplier'])
  })

  it('sorts the current page by text and by number', () => {
    const rows = [
      { cells: { name: 'Zeta', factor: '10' } },
      { cells: { name: 'Alfa', factor: '2' } },
    ]
    expect(sortTableRows(rows, { column: 'name', direction: 'asc' }).map((row) => row.cells.name)).toEqual(['Alfa', 'Zeta'])
    expect(sortTableRows(rows, { column: 'factor', direction: 'asc' }).map((row) => row.cells.factor)).toEqual(['2', '10'])
    expect(sortTableRows(rows, null).map((row) => row.cells.name)).toEqual(['Zeta', 'Alfa'])
  })

  it('keeps the column menu inside the viewport', () => {
    expect(placeColumnMenu(900, 700, 1000, 800)).toEqual({ x: 772, y: 616 })
    expect(placeColumnMenu(-20, 4, 1000, 800)).toEqual({ x: 8, y: 8 })
  })
})
