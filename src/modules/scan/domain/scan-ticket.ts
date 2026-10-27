export interface CardPresentation {
  unit: string
  factor: number
  salePrice: number | null
}

export interface PricedLine {
  productId: string
  unit?: string
  factor: number
  quantity: number
  unitCost: number | null
  salePrice: number | null
  onHand: number
}

export const CASH_ACCOUNT = '1.01.01.001'

export function money(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

export function quantity(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 10000) / 10000
}

export function formatMoney(amount: number): string {
  return money(amount).toFixed(2)
}

export function formatQuantity(amount: number): string {
  return quantity(amount).toFixed(4)
}

export function parseQuantity(text: string): number | null {
  const parsed = Number(text.trim().replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return quantity(parsed)
}

export function parseMoney(text: string): number | null {
  const parsed = Number(text.trim().replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }
  return money(parsed)
}

export function pricedUnit(input: {
  resolvedUnit: string | null
  presentations: readonly CardPresentation[]
}): { unit: string; factor: number; salePrice: number | null } {
  const resolved = input.presentations.find((item) => item.unit === input.resolvedUnit)
  if (input.resolvedUnit !== null && resolved !== undefined) {
    return { unit: resolved.unit, factor: resolved.factor, salePrice: resolved.salePrice }
  }
  const basePriced = input.presentations.find((item) => item.factor === 1 && item.salePrice !== null && item.salePrice > 0)
  if (basePriced !== undefined) {
    return { unit: basePriced.unit, factor: basePriced.factor, salePrice: basePriced.salePrice }
  }
  const priced = input.presentations.find((item) => item.salePrice !== null && item.salePrice > 0)
  if (priced !== undefined) {
    return { unit: priced.unit, factor: priced.factor, salePrice: priced.salePrice }
  }
  const base = input.presentations.find((item) => item.factor === 1)
  if (base !== undefined) {
    return { unit: base.unit, factor: base.factor, salePrice: base.salePrice }
  }
  const first = input.presentations[0]
  if (first === undefined) {
    return { unit: 'unidad', factor: 1, salePrice: null }
  }
  return { unit: first.unit, factor: first.factor, salePrice: first.salePrice }
}

export function saleTotal(lines: readonly PricedLine[]): number {
  return lines.reduce((total, line) => money(total + (line.salePrice ?? 0) * line.quantity), 0)
}

export function receiptTotal(lines: readonly PricedLine[]): number {
  return lines.reduce((total, line) => money(total + (line.unitCost ?? 0) * line.quantity * line.factor), 0)
}

export function saleExceedsStock(lines: readonly PricedLine[]): boolean {
  const demand = new Map<string, { quantity: number; onHand: number }>()
  for (const line of lines) {
    const current = demand.get(line.productId) ?? { quantity: 0, onHand: line.onHand }
    const next = quantity(current.quantity + line.quantity * line.factor)
    demand.set(line.productId, { quantity: next, onHand: current.onHand })
    if (next > current.onHand) {
      return true
    }
  }
  return false
}

export function missingReceiptCost(lines: readonly PricedLine[]): boolean {
  for (const line of lines) {
    if (line.unitCost === null || line.unitCost < 0) {
      return true
    }
  }
  return false
}
