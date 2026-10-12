import { describe, expect, it } from 'vitest'
import { formatMoney, formatQuantity, parseQuantity, receiptTotal, saleExceedsStock, saleTotal } from './scan-ticket'

describe('scan ticket', () => {
  it('rounds money to 2 decimals and quantity to 4', () => {
    const line = {
      productId: 'p',
      factor: 1,
      quantity: 2,
      unitCost: 1.5,
      salePrice: 10.005,
      onHand: 2,
    }

    expect(saleTotal([line])).toBe(20.01)
    expect(formatMoney(saleTotal([line]))).toBe('20.01')
    expect(formatQuantity(1.23456)).toBe('1.2346')
    expect(parseQuantity('1,25')).toBe(1.25)
    expect(receiptTotal([{ ...line, quantity: 1, factor: 2, unitCost: 3.333 }])).toBe(6.67)
    expect(saleExceedsStock([{ ...line, quantity: 3 }])).toBe(true)
    expect(saleExceedsStock([line])).toBe(false)
  })
})
