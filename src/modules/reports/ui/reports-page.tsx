import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useSession } from '@/app/providers/session'
import { PageIntro, Panel } from '@/shared/ui/ops'
import { Skeleton, TableSkeleton } from '@/shared/ui/skeleton'
import { readFinancial, readSales, type FinancialReport, type SalesReport } from '../api'

type View = 'sales' | 'trial' | 'balance' | 'income'
const views: Array<{ key: View; label: string }> = [
  { key: 'sales', label: 'Ventas' }, { key: 'trial', label: 'Comprobación' },
  { key: 'balance', label: 'Balance general' }, { key: 'income', label: 'Resultados' },
]
const money = new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL', minimumFractionDigits: 2 })
const quantity = new Intl.NumberFormat('es-HN', { maximumFractionDigits: 4 })

export function ReportsPage() {
  const { companyId } = useSession()
  const today = localDay(new Date())
  const [draftFrom, setDraftFrom] = useState(`${today.slice(0, 7)}-01`)
  const [draftTo, setDraftTo] = useState(today)
  const [period, setPeriod] = useState({ from: draftFrom, to: draftTo })
  const [view, setView] = useState<View>('sales')
  const [dateError, setDateError] = useState('')
  const sales = useQuery({ queryKey: ['reports', 'sales', companyId, period.from, period.to],
    queryFn: () => readSales(companyId ?? '', period.from, period.to), enabled: Boolean(companyId) && view === 'sales' })
  const financial = useQuery({ queryKey: ['reports', 'financial', companyId, period.from, period.to],
    queryFn: () => readFinancial(companyId ?? '', period.from, period.to), enabled: Boolean(companyId) && view !== 'sales' })
  const current = view === 'sales' ? sales : financial

  function applyPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (draftFrom > draftTo) { setDateError('La fecha inicial debe ser anterior o igual a la final.'); return }
    setDateError('')
    setPeriod({ from: draftFrom, to: draftTo })
  }

  function exportView() {
    if (view === 'sales' && sales.data) exportSales(sales.data)
    if (view !== 'sales' && financial.data) exportFinancial(financial.data, view)
  }

  return <main className="ops-page reports-page">
    <PageIntro title="Reportes" description="Consulta ventas y estados contables de la empresa con cifras tomadas de movimientos confirmados y asientos registrados." />
    <Panel>
      <form className="report-filters" onSubmit={applyPeriod}>
        <label className="field">Desde<input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} required /></label>
        <label className="field">Hasta<input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} required /></label>
        <button type="submit" className="ui-button ui-button--primary">Aplicar período</button>
        <button type="button" className="ghost-button" onClick={exportView} disabled={!current.data}>Exportar CSV</button>
        <button type="button" className="ghost-button" onClick={() => window.print()} disabled={!current.data}>Imprimir</button>
      </form>
      {dateError ? <p role="alert" className="form-alert">{dateError}</p> : null}
      <div className="report-tabs" role="tablist" aria-label="Tipos de reporte">
        {views.map((item) => <button key={item.key} type="button" role="tab" aria-selected={view === item.key} onClick={() => setView(item.key)}>{item.label}</button>)}
      </div>
    </Panel>
    {current.isPending ? <ReportLoadingSkeleton /> : null}
    {current.isError ? <Panel><div className="table-load-error" role="alert"><p>{current.error instanceof Error ? current.error.message : 'No se pudo cargar el reporte.'}</p><button type="button" className="ghost-button" onClick={() => void current.refetch()}>{'Reintentar'}</button></div></Panel> : null}
    {view === 'sales' && sales.data ? <SalesView report={sales.data} /> : null}
    {view === 'trial' && financial.data ? <TrialView report={financial.data} /> : null}
    {view === 'balance' && financial.data ? <BalanceView report={financial.data} /> : null}
    {view === 'income' && financial.data ? <IncomeView report={financial.data} /> : null}
  </main>
}

function ReportLoadingSkeleton() {
  return <div className="report-loading" role="status" aria-label="Cargando reporte">
    <span className="sr-only">Cargando cifras y detalle del reporte…</span>
    <div className="report-metrics" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => <div className="report-metric" key={index}><Skeleton className="skeleton-line skeleton-line--short" /><Skeleton className="skeleton-line report-value-skeleton" /></div>)}
    </div>
    <div className="report-two-columns" aria-hidden="true">
      <Panel title="Resumen del período"><Skeleton className="skeleton-block report-chart-skeleton" /></Panel>
      <Panel title="Detalle"><Skeleton className="skeleton-line skeleton-line--wide" /><Skeleton className="skeleton-line skeleton-line--short" /></Panel>
    </div>
    <Panel title="Registros"><TableSkeleton columns={4} rows={4} label="Cargando filas del reporte…" /></Panel>
  </div>
}

function SalesView({ report }: { report: SalesReport }) {
  const peak = Math.max(1, ...report.daily.map((day) => day.revenue))
  return <>
    <div className="report-metrics">
      <Metric label="Ventas netas" value={money.format(report.summary.revenue)} />
      <Metric label="Costo de ventas" value={money.format(report.summary.cost)} />
      <Metric label="Utilidad bruta" value={money.format(report.summary.grossProfit)} />
      <Metric label="Operaciones" value={quantity.format(report.summary.salesCount)} />
    </div>
    <div className="report-two-columns">
      <Panel title="Ventas por día">
        {report.daily.length === 0 ? <Empty /> : <div className="report-bars">{report.daily.map((day) => <div className="report-bar-row" key={day.date}>
          <time dateTime={day.date}>{day.date}</time><span className="report-bar-track"><span style={{ width: `${day.revenue / peak * 100}%` }} /></span>
          <strong>{money.format(day.revenue)}</strong>
        </div>)}</div>}
      </Panel>
      <Panel title="Resumen del período">
        <SummaryLine label="Venta promedio" value={money.format(report.summary.averageSale)} />
        <SummaryLine label="Margen bruto" value={`${quantity.format(report.summary.grossMarginPercent)} %`} />
        <SummaryLine label="Días con ventas" value={quantity.format(report.daily.length)} />
        <SummaryLine label="Unidades vendidas" value={quantity.format(report.products.reduce((total, product) => total + product.quantity, 0))} />
      </Panel>
    </div>
    <Panel title="Ventas por producto">
      {report.products.length === 0 ? <Empty /> : <div className="table-scroll"><table className="ui-table report-table"><thead><tr><th>Producto</th><th>Unidades base</th><th>Ventas</th><th>Costo</th><th>Utilidad</th></tr></thead><tbody>
        {report.products.map((row) => <tr key={row.productId}><td>{row.name}</td><td>{quantity.format(row.quantity)}</td><td>{money.format(row.revenue)}</td><td>{money.format(row.cost)}</td><td>{money.format(row.grossProfit)}</td></tr>)}
      </tbody></table></div>}
    </Panel>
  </>
}

function TrialView({ report }: { report: FinancialReport }) {
  const trial = report.trialBalance
  return <Panel title="Balance de comprobación">
    <p className="section-copy">Saldos al inicio, movimientos del período y saldos al cierre. Incluye los asientos de reversión de documentos anulados.</p>
    <p className={`report-balance-state ${trial.balanced ? 'report-balance-state--ok' : 'report-balance-state--alert'}`}>{trial.balanced ? 'Cuentas cuadradas' : 'Hay una diferencia entre débitos y créditos'}</p>
    <div className="table-scroll"><table className="ui-table report-table"><thead><tr><th>Cuenta</th><th>Saldo inicial D</th><th>Saldo inicial H</th><th>Débitos</th><th>Créditos</th><th>Saldo final D</th><th>Saldo final H</th></tr></thead><tbody>
      {trial.rows.map((row) => <tr key={row.code}><td><strong>{row.code}</strong><span className="report-account-name">{row.name}</span></td><td>{money.format(row.openingDebit)}</td><td>{money.format(row.openingCredit)}</td><td>{money.format(row.debit)}</td><td>{money.format(row.credit)}</td><td>{money.format(row.closingDebit)}</td><td>{money.format(row.closingCredit)}</td></tr>)}
    </tbody><tfoot><tr><th>Total</th><td>{money.format(trial.totals.openingDebit)}</td><td>{money.format(trial.totals.openingCredit)}</td><td>{money.format(trial.totals.debit)}</td><td>{money.format(trial.totals.credit)}</td><td>{money.format(trial.totals.closingDebit)}</td><td>{money.format(trial.totals.closingCredit)}</td></tr></tfoot></table></div>
  </Panel>
}

function BalanceView({ report }: { report: FinancialReport }) {
  const sheet = report.balanceSheet
  return <div className="report-two-columns">
    <Panel title={`Balance general al ${report.to}`}><StatementRows title="Activos" rows={sheet.assets.rows} total={sheet.assets.total} /></Panel>
    <Panel title="Pasivo y patrimonio">
      <StatementRows title="Pasivos" rows={sheet.liabilities.rows} total={sheet.liabilities.total} />
      <StatementRows title="Patrimonio" rows={sheet.equity.rows} total={sheet.equity.total} />
      <SummaryLine label="Resultado acumulado" value={money.format(sheet.retainedEarnings)} />
      <SummaryLine label="Patrimonio total" value={money.format(sheet.totalEquity)} />
      <SummaryLine label="Pasivo + patrimonio" value={money.format(sheet.liabilitiesAndEquity)} strong />
      <p className={`report-balance-state ${Math.abs(sheet.difference) < .01 ? 'report-balance-state--ok' : 'report-balance-state--alert'}`}>
        {Math.abs(sheet.difference) < .01 ? 'Balance cuadrado' : `Diferencia: ${money.format(sheet.difference)}`}
      </p>
    </Panel>
  </div>
}

function IncomeView({ report }: { report: FinancialReport }) {
  const income = report.incomeStatement
  return <Panel title="Estado de resultados">
    <p className="section-copy">Del {report.from} al {report.to}</p>
    <div className="report-income-statement">
      <StatementRows title="Ingresos" rows={income.revenue.rows} total={income.revenue.total} />
      <StatementRows title="Costo de ventas" rows={income.cost.rows} total={income.cost.total} />
      <SummaryLine label="Utilidad bruta" value={money.format(income.grossProfit)} strong />
      <StatementRows title="Gastos" rows={income.expense.rows} total={income.expense.total} />
      <SummaryLine label="Utilidad neta" value={money.format(income.netIncome)} strong />
    </div>
  </Panel>
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="report-metric"><span>{label}</span><strong>{value}</strong></div> }
function Empty() { return <p className="empty-row">No hay movimientos en este período.</p> }
function SummaryLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className={`report-summary-line${strong ? ' report-summary-line--strong' : ''}`}><span>{label}</span><strong>{value}</strong></div> }
function StatementRows({ title, rows, total }: { title: string; rows: Array<{ code: string; name: string; amount: number }>; total: number }) { return <div className="report-statement"><h3>{title}</h3>{rows.length === 0 ? <p className="muted">Sin saldo</p> : rows.map((row) => <SummaryLine key={row.code} label={`${row.code} · ${row.name}`} value={money.format(row.amount)} />)}<SummaryLine label={`Total ${title.toLowerCase()}`} value={money.format(total)} strong /></div> }

function localDay(date: Date): string { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}` }
function exportSales(report: SalesReport) { downloadCsv(`ventas-${report.from}-${report.to}.csv`, [
  ['Ventas netas', report.summary.revenue], ['Costo de ventas', report.summary.cost], ['Utilidad bruta', report.summary.grossProfit], ['Operaciones', report.summary.salesCount], ['Margen bruto %', report.summary.grossMarginPercent],
  [], ['Ventas por día'], ['Fecha', 'Ventas', 'Costo', 'Utilidad', 'Operaciones'],
  ...report.daily.map((row) => [row.date, row.revenue, row.cost, row.grossProfit, row.salesCount]),
  [], ['Ventas por producto'], ['Producto', 'Unidades base', 'Ventas', 'Costo', 'Utilidad'],
  ...report.products.map((row) => [row.name, row.quantity, row.revenue, row.cost, row.grossProfit]),
]) }
function exportFinancial(report: FinancialReport, view: Exclude<View, 'sales'>) {
  if (view === 'trial') { downloadCsv(`comprobacion-${report.to}.csv`, [['Código', 'Cuenta', 'Inicial D', 'Inicial H', 'Débitos', 'Créditos', 'Final D', 'Final H'], ...report.trialBalance.rows.map((row) => [row.code, row.name, row.openingDebit, row.openingCredit, row.debit, row.credit, row.closingDebit, row.closingCredit]), ['Total', '', ...['openingDebit', 'openingCredit', 'debit', 'credit', 'closingDebit', 'closingCredit'].map((key) => report.trialBalance.totals[key as keyof typeof report.trialBalance.totals])]]); return }
  if (view === 'income') { const s = report.incomeStatement; downloadCsv(`resultados-${report.from}-${report.to}.csv`, [['Sección', 'Código', 'Cuenta', 'Monto'], ...s.revenue.rows.map((r) => ['Ingresos', r.code, r.name, r.amount]), ['Total ingresos', '', '', s.revenue.total], ...s.cost.rows.map((r) => ['Costo', r.code, r.name, r.amount]), ['Total costo', '', '', s.cost.total], ['Utilidad bruta', '', '', s.grossProfit], ...s.expense.rows.map((r) => ['Gastos', r.code, r.name, r.amount]), ['Total gastos', '', '', s.expense.total], ['Utilidad neta', '', '', s.netIncome]]); return }
  const b = report.balanceSheet; downloadCsv(`balance-${report.to}.csv`, [['Sección', 'Código', 'Cuenta', 'Monto'], ...b.assets.rows.map((r) => ['Activo', r.code, r.name, r.amount]), ['Total activos', '', '', b.assets.total], ...b.liabilities.rows.map((r) => ['Pasivo', r.code, r.name, r.amount]), ['Total pasivos', '', '', b.liabilities.total], ...b.equity.rows.map((r) => ['Patrimonio', r.code, r.name, r.amount]), ['Resultado acumulado', '', '', b.retainedEarnings], ['Patrimonio total', '', '', b.totalEquity], ['Pasivo + patrimonio', '', '', b.liabilitiesAndEquity], ['Diferencia', '', '', b.difference]])
}
function downloadCsv(name: string, rows: Array<Array<string | number>>) {
  const content = '\ufeff' + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url)
}
