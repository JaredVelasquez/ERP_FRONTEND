import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadRecentMovements } from './api'

describe('recent dashboard movements', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('requests the chosen page and maps rows for the configurable table', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ id: 'document-12345678', documentType: 'sale', status: 'confirmed', createdAt: '2026-10-20T00:00:00.000Z' }],
      page: 2,
      pageSize: 10,
      total: 17,
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await loadRecentMovements('company-1', { page: 2, pageSize: 10, search: 'venta' })

    expect(fetchMock.mock.calls[0]?.[0]).toBeInstanceOf(URL)
    const url = fetchMock.mock.calls[0]?.[0] as URL
    expect(url.searchParams.get('companyId')).toBe('company-1')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('pageSize')).toBe('10')
    expect(url.searchParams.get('search')).toBe('venta')
    expect(result.total).toBe(17)
    expect(result.items[0]?.cells.movement).toBe('Venta')
    expect(result.items[0]?.cells.status).toBe('Confirmado')
    expect(result.items[0]?.cells.reference).toBe('document')
  })
})
