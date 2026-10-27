import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { voucherMessages } from '../messages'
import { VoucherForm } from './voucher-form'

describe('voucher form', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('asks for a bank reference and does not call the API', () => {
    render(<VoucherForm />)

    expect(screen.getByRole('heading', { name: voucherMessages.formTitle })).toBeInTheDocument()
    expect(screen.getByText(voucherMessages.formSubtitle)).toBeInTheDocument()
    for (const service of voucherMessages.services) {
      expect(screen.getByRole('option', { name: service.label })).toBeInTheDocument()
    }
    expect(screen.getByLabelText(voucherMessages.account)).toBeInTheDocument()
    expect(screen.getByLabelText(voucherMessages.holder)).toBeInTheDocument()
    expect(screen.getByLabelText(voucherMessages.institution)).toBeInTheDocument()
    expect(screen.getByLabelText(voucherMessages.dni)).toBeInTheDocument()
    expect(screen.getByLabelText(voucherMessages.phone)).toBeInTheDocument()
    expect(screen.getByLabelText(voucherMessages.amount)).toBeInTheDocument()
    expect(screen.getByLabelText(voucherMessages.currency)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Lempiras' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Dólares' })).toBeInTheDocument()
    expect(screen.getByLabelText(voucherMessages.declaration)).toBeInTheDocument()
    expect(screen.getByLabelText(voucherMessages.bankReference)).toBeInTheDocument()
    expect(screen.getByLabelText(voucherMessages.moneyMovement)).toBeInTheDocument()
    expect(screen.getByLabelText(voucherMessages.signature)).toBeInTheDocument()
    expect(screen.queryByText('La firma quedó en este equipo. No se envió y no se creó un asiento.')).not.toBeInTheDocument()

    fireEvent.submit(screen.getByRole('button', { name: voucherMessages.sign }))

    expect(screen.getByText(voucherMessages.issues['bank-reference'])).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('posts the signed voucher and offers the PDF', async () => {
    stubCanvas()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/confirm')) {
          return { ok: true, json: async () => ({ voucher: { id: 'voucher-9' } }) }
        }
        return { ok: true, json: async () => ({ voucher: { id: 'voucher-9' } }) }
      }),
    )
    render(<VoucherForm companyId="company-1" />)
    fillRequiredVoucherFields()
    fireEvent.change(screen.getByLabelText(voucherMessages.bankReference), { target: { value: '23123' } })
    fireEvent.click(screen.getByLabelText(voucherMessages.declaration))
    drawSignature()
    fireEvent.submit(screen.getByRole('button', { name: voucherMessages.sign }))

    expect(await screen.findByRole('button', { name: voucherMessages.download })).toBeInTheDocument()
    expect(screen.getByText(voucherMessages.saved)).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/erp/vouchers',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: expect.stringContaining('"bankReference":"23123"'),
      }),
    )
    const body = JSON.parse(String((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body))
    expect(body.moneyMovementId).toBeNull()
    expect(body.serviceNote).toBe('')
    expect(body.serviceType).toBe('deposito-cuenta')
    expect(body.signature.startsWith('data:image/')).toBe(true)
    expect(body.occurredOn).toBe(todayLocalDate())
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/erp/vouchers/voucher-9/confirm?companyId=company-1',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
  })

  it('shows the server message when saving fails', async () => {
    stubCanvas()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ message: 'The declaration must be accepted' }),
      })),
    )
    render(<VoucherForm companyId="company-1" />)
    fillRequiredVoucherFields()
    fireEvent.change(screen.getByLabelText(voucherMessages.bankReference), { target: { value: '23123' } })
    fireEvent.click(screen.getByLabelText(voucherMessages.declaration))
    drawSignature()
    fireEvent.submit(screen.getByRole('button', { name: voucherMessages.sign }))

    expect(await screen.findByText('The declaration must be accepted')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: voucherMessages.download })).not.toBeInTheDocument()
  })
})

function stubCanvas() {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    clearRect() {},
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,abc'
}

function drawSignature() {
  const canvas = screen.getByLabelText(voucherMessages.signature)
  canvas.setPointerCapture = () => undefined
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 640, height: 200, right: 640, bottom: 200, x: 0, y: 0, toJSON() { return {} } }) as DOMRect
  fireEvent.pointerDown(canvas, { clientX: 8, clientY: 8, pointerId: 1 })
  fireEvent.pointerUp(canvas, { clientX: 24, clientY: 16, pointerId: 1 })
}

function fillRequiredVoucherFields(): void {
  const values = [
    [voucherMessages.amount, '1500'],
    [voucherMessages.account, '001-123'],
    [voucherMessages.holder, 'Michelle'],
    [voucherMessages.institution, 'Ficohsa'],
    [voucherMessages.dni, '0801199012345'],
    [voucherMessages.phone, '99990000'],
  ] as const
  for (const [label, value] of values) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
}

function todayLocalDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
