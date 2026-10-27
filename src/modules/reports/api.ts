import { authenticatedFetch } from '@/shared/api/http-client'
import { z } from 'zod'
import { appConfig } from '@/app/config/app-config'

const money = z.number()
const statementRow = z.object({ code: z.string(), name: z.string(), amount: money })
const section = z.object({ rows: z.array(statementRow), total: money })
const balanceRow = z.object({ code: z.string(), name: z.string(), kind: z.string(),
  openingDebit: money, openingCredit: money, debit: money, credit: money, closingDebit: money, closingCredit: money })

const financialSchema = z.object({
  from: z.string(), to: z.string(),
  trialBalance: z.object({ rows: z.array(balanceRow), totals: balanceRow.omit({ code: true, name: true, kind: true }), balanced: z.boolean() }),
  incomeStatement: z.object({ revenue: section, cost: section, expense: section, grossProfit: money, netIncome: money }),
  balanceSheet: z.object({ assets: section, liabilities: section, equity: section, retainedEarnings: money,
    totalEquity: money, liabilitiesAndEquity: money, difference: money }),
})

const salesSchema = z.object({
  from: z.string(), to: z.string(),
  summary: z.object({ revenue: money, cost: money, grossProfit: money, grossMarginPercent: money, salesCount: z.number(), averageSale: money }),
  daily: z.array(z.object({ date: z.string(), revenue: money, cost: money, grossProfit: money, salesCount: z.number() })),
  products: z.array(z.object({ productId: z.string(), name: z.string(), quantity: z.number(), revenue: money, cost: money, grossProfit: money })),
})

export type FinancialReport = z.infer<typeof financialSchema>
export type SalesReport = z.infer<typeof salesSchema>

async function read(path: 'sales' | 'financial', companyId: string, from: string, to: string): Promise<unknown> {
  const url = new URL(`/erp/reports/${path}`, appConfig.gatewayUrl)
  url.searchParams.set('companyId', companyId)
  url.searchParams.set('from', from)
  url.searchParams.set('to', to)
  const response = await authenticatedFetch(url, { credentials: 'include' })
  if (!response.ok) {
    const issue: unknown = await response.json().catch(() => null)
    const message = typeof issue === 'object' && issue !== null && 'message' in issue && typeof issue.message === 'string'
      ? issue.message : 'No se pudo cargar el reporte.'
    throw new Error(message)
  }
  return response.json()
}

export async function readSales(companyId: string, from: string, to: string): Promise<SalesReport> {
  return salesSchema.parse(await read('sales', companyId, from, to))
}

export async function readFinancial(companyId: string, from: string, to: string): Promise<FinancialReport> {
  return financialSchema.parse(await read('financial', companyId, from, to))
}
