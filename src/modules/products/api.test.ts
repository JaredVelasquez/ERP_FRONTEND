import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticatedFetch } from '@/shared/api/http-client'
import { createBarcodeSheet } from './api'

vi.mock('@/shared/api/http-client', () => ({ authenticatedFetch: vi.fn() }))

describe('createBarcodeSheet', () => {
  beforeEach(() => vi.resetAllMocks())

  it('sends one or more selected products and returns a PDF blob', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ pdfBase64: btoa('%PDF-smoke') }),
    } as Response)

    const result = await createBarcodeSheet('company-1', ['product-1', 'product-2'])

    expect(authenticatedFetch).toHaveBeenCalledWith(expect.stringContaining('/erp/barcode-sheets'), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ companyId: 'company-1', productIds: ['product-1', 'product-2'] }),
    }))
    expect(result.type).toBe('application/pdf')
    expect(await result.text()).toBe('%PDF-smoke')
  })

  it('rejects an invalid server response instead of downloading empty data', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue({ ok: true, json: async () => ({ pdfBase64: '' }) } as Response)
    await expect(createBarcodeSheet('company-1', ['product-1'])).rejects.toThrow('barcode-sheet-invalid')
  })
})
