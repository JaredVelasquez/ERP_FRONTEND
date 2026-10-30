import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '@/app/providers/session'
import { confirmMovement, lookupCode, searchByName, seedChart, type StockCard } from '../api'
import { scanMessages } from '../messages'
import { ScanPage } from './scan-page'

vi.mock('../api', () => ({
  confirmMovement: vi.fn(),
  lookupCode: vi.fn(),
  searchByName: vi.fn(),
  seedChart: vi.fn(),
}))

vi.mock('@/shared/ui/ops', () => ({
  PageIntro: ({ title }: { title: string }) => <h1>{title}</h1>,
  Panel: ({ title, children }: { title?: string; children: ReactNode }) => <section><h2>{title}</h2>{children}</section>,
}))

const multiPresentationCard: StockCard = {
  productId: 'product-1', name: 'Refresco', internalBarcode: '10001', baseQuantity: 48,
  resolvedUnit: null,
  presentations: [
    { unit: 'Lata 355 ml', factor: 1, salePrice: 20, purchasable: true, sellable: true },
    { unit: 'Caja 12 latas', factor: 12, salePrice: 220, purchasable: true, sellable: true },
  ],
}

const singlePresentationCard: StockCard = {
  productId: 'product-2', name: 'Agua', internalBarcode: '20002', baseQuantity: 24,
  resolvedUnit: 'Botella', presentations: [{ unit: 'Botella', factor: 1, salePrice: 18, purchasable: true, sellable: true }],
}

describe('scan movement page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(seedChart).mockResolvedValue(true)
    vi.mocked(confirmMovement).mockResolvedValue({ journal: [] })
    vi.mocked(searchByName).mockResolvedValue([])
  })

  it('requires a presentation choice before adding a product that has multiple presentations', async () => {
    vi.mocked(lookupCode).mockResolvedValue(multiPresentationCard)
    renderScanPage()

    await scanCode('10001')

    expect(await screen.findByRole('group', { name: scanMessages.choosePresentation })).toBeInTheDocument()
    expect(screen.queryByLabelText(scanMessages.quantity)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Caja 12 latas/ }))

    expect(screen.getByLabelText(scanMessages.quantity)).toBeInTheDocument()
    expect(document.querySelector('.scan-lines')?.textContent).toContain('Caja 12 latas')
    expect(screen.queryByRole('group', { name: scanMessages.choosePresentation })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: scanMessages.confirmOut }))

    await waitFor(() => expect(confirmMovement).toHaveBeenCalledTimes(1))
    expect(vi.mocked(confirmMovement).mock.calls[0]?.[0].lines).toEqual([
      expect.objectContaining({ productId: 'product-1', presentationUnit: 'Caja 12 latas', presentationFactor: 12, quantity: 1, saleAmount: 220 }),
    ])
  })

  it('adds one and multiple scanned products into one confirmed sale', async () => {
    vi.mocked(lookupCode)
      .mockResolvedValueOnce(singlePresentationCard)
      .mockResolvedValueOnce({ ...singlePresentationCard, productId: 'product-3', name: 'Jugo', internalBarcode: '30003' })
    renderScanPage()

    await scanCode('20002')
    await scanCode('30003')
    fireEvent.click(screen.getByRole('button', { name: scanMessages.confirmOut }))

    await waitFor(() => expect(confirmMovement).toHaveBeenCalledTimes(1))
    const submitted = vi.mocked(confirmMovement).mock.calls[0]?.[0]
    expect(submitted?.lines).toEqual([
      expect.objectContaining({ productId: 'product-2', presentationUnit: 'Botella', presentationFactor: 1, quantity: 1, saleAmount: 18 }),
      expect.objectContaining({ productId: 'product-3', presentationUnit: 'Botella', presentationFactor: 1, quantity: 1, saleAmount: 18 }),
    ])
  })

  it('automatically adds the only sellable presentation and skips unavailable presentation choices', async () => {
    vi.mocked(lookupCode).mockResolvedValue({
      ...singlePresentationCard,
      presentations: [
        { unit: 'Unidad', factor: 1, salePrice: 18, purchasable: true, sellable: true },
        { unit: 'Paquete', factor: 6, salePrice: null, purchasable: true, sellable: false },
      ],
      resolvedUnit: null,
    })
    renderScanPage()

    await scanCode('20002')

    expect(screen.getByLabelText(scanMessages.quantity)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: scanMessages.choosePresentation })).not.toBeInTheDocument()
  })

  it('keeps Enter in the quantity field from submitting another barcode lookup', async () => {
    vi.mocked(lookupCode).mockResolvedValue(singlePresentationCard)
    renderScanPage()

    await scanCode('20002')
    fireEvent.keyDown(screen.getByLabelText(scanMessages.quantity), { key: 'Enter', code: 'Enter' })

    expect(lookupCode).toHaveBeenCalledTimes(1)
    expect(confirmMovement).not.toHaveBeenCalled()
  })

  it('shows an unknown code without submitting a movement', async () => {
    vi.mocked(lookupCode).mockResolvedValue('unknown')
    vi.mocked(searchByName).mockResolvedValue([])
    renderScanPage()

    await scanCode('not-a-product')

    expect(await screen.findByText(scanMessages.unknown)).toBeInTheDocument()
    expect(confirmMovement).not.toHaveBeenCalled()
  })
})

function renderScanPage(): void {
  render(<SessionProvider grants={[]} companyId="company-1"><ScanPage /></SessionProvider>)
}

async function scanCode(code: string): Promise<void> {
  const expectedLookupCalls = vi.mocked(lookupCode).mock.calls.length + 1
  fireEvent.change(screen.getByLabelText(scanMessages.code), { target: { value: code } })
  fireEvent.submit(screen.getByRole('button', { name: scanMessages.add }).closest('form') as HTMLFormElement)
  await waitFor(() => expect(lookupCode).toHaveBeenCalledTimes(expectedLookupCalls))
  await waitFor(() => {
    const presentationPicker = screen.queryByRole('group', { name: scanMessages.choosePresentation })
    const quantityInputs = screen.queryAllByLabelText(scanMessages.quantity)
    const unknownNotice = screen.queryByText(scanMessages.unknown)
    expect(Boolean(presentationPicker) || quantityInputs.length >= expectedLookupCalls || Boolean(unknownNotice)).toBe(true)
  })
}
