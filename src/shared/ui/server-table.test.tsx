import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ColumnSetting } from '@/shared/api/layouts'
import { tableMessages } from '@/shared/i18n/messages'
import { ServerTable, type PageQuery } from './server-table'

let stored: { tableKey: string; pageSize: number; columns: ColumnSetting[] }

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  stored = {
    tableKey: 'demo',
    pageSize: 25,
    columns: [
      { key: 'category', visible: true, sortOrder: 0 },
      { key: 'name', visible: true, sortOrder: 1 },
    ],
  }
  vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { pageSize: number; columns: ColumnSetting[] }
      stored = { tableKey: 'demo', pageSize: body.pageSize, columns: body.columns }
    }
    return { ok: true, json: async () => stored }
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('server table columns', () => {
  it('uses the saved order and does not offer Subir or Bajar', async () => {
    renderTable()
    const headers = await screen.findAllByRole('columnheader')
    expect(headers.map((header) => header.getAttribute('aria-label'))).toEqual(['Categoría', 'Nombre'])
    expect(screen.queryByRole('button', { name: tableMessages.up })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: tableMessages.down })).not.toBeInTheDocument()
  })

  it('sorts the current page from the header menu and closes with Escape', async () => {
    renderTable()
    fireEvent.click(await screen.findByRole('button', { name: `${tableMessages.columnOptions} Nombre` }))
    const menu = await screen.findByRole('menu')
    await waitFor(() => expect(document.activeElement).toHaveTextContent(tableMessages.hide))
    fireEvent.click(screen.getByRole('menuitem', { name: tableMessages.sortAsc }))
    await waitFor(() => expect(screen.getAllByRole('row')[1]).toHaveTextContent('Alfa'))
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toHaveAttribute('aria-sort', 'ascending')

    fireEvent.click(screen.getByRole('button', { name: `${tableMessages.columnOptions} Nombre` }))
    fireEvent.keyDown(await screen.findByRole('menu'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(menu).not.toBeInTheDocument()
  })

  it('asks the server to sort instead of reordering the current page', async () => {
    const load = vi.fn(async (query: PageQuery) => {
      if (query.sort?.column === 'name' && query.sort.direction === 'asc') {
        return pageOf([
          { id: '2', cells: { name: 'Alfa', category: 'A' } },
          { id: '1', cells: { name: 'Zeta', category: 'B' } },
        ])
      }
      return pageOf([
        { id: '1', cells: { name: 'Zeta', category: 'B' } },
        { id: '2', cells: { name: 'Alfa', category: 'A' } },
      ])
    })
    renderTable(load, true)
    await waitFor(() => expect(screen.getAllByRole('row')[1]).toHaveTextContent('Zeta'))
    fireEvent.click(await screen.findByRole('button', { name: `${tableMessages.columnOptions} Nombre` }))
    fireEvent.click(screen.getByRole('menuitem', { name: tableMessages.sortAsc }))
    await waitFor(() => expect(screen.getAllByRole('row')[1]).toHaveTextContent('Alfa'))
    expect(load).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 1,
      sort: { column: 'name', direction: 'asc' },
    }))
  })

  it('hides a column from the header and shows it again from Columnas', async () => {
    renderTable()
    fireEvent.click(await screen.findByRole('button', { name: `${tableMessages.columnOptions} Categoría` }))
    fireEvent.click(await screen.findByRole('menuitem', { name: tableMessages.hide }))
    await waitFor(() => expect(screen.queryByRole('columnheader', { name: 'Categoría' })).not.toBeInTheDocument())
    expect(stored.columns.find((column) => column.key === 'category')?.visible).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: tableMessages.columns }))
    fireEvent.click(await screen.findByRole('button', { name: tableMessages.show }))
    expect(await screen.findByRole('columnheader', { name: 'Categoría' })).toBeInTheDocument()
    expect(stored.columns.find((column) => column.key === 'category')?.visible).toBe(true)
  })
})

function renderTable(load: (query: PageQuery) => Promise<{ items: { id: string; cells: Record<string, string> }[]; page: number; pageSize: number; total: number }> = async () => pageOf([
  { id: '1', cells: { name: 'Zeta', category: 'B' } },
  { id: '2', cells: { name: 'Alfa', category: 'A' } },
]), remoteSort = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ServerTable
        tableKey="demo"
        companyId="company-1"
        columns={[
          { key: 'name', label: 'Nombre' },
          { key: 'category', label: 'Categoría' },
        ]}
        queryKey="demo-rows"
        empty="Vacío"
        remoteSort={remoteSort}
        load={load}
      />
    </QueryClientProvider>,
  )
}

function pageOf(items: { id: string; cells: Record<string, string> }[]) {
  return { items, page: 1, pageSize: 25, total: items.length }
}
