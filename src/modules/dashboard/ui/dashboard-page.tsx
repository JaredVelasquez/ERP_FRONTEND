import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useSession } from '@/app/providers/session'
import { readDashboardLayout, saveDashboardLayout, type WidgetSetting } from '@/shared/api/layouts'
import { shellMessages, tableMessages } from '@/shared/i18n/messages'
import { PageIntro } from '@/shared/ui/ops'
import { loadDashboard, type DashboardSnapshot } from '../api'
import { dashboardMessages } from '../messages'

const widgetCopy = [
  { key: 'sales', title: 'Ventas', empty: 'Sin ventas en el periodo.' },
  { key: 'shrinkage', title: 'Mermas', empty: 'Sin mermas en el periodo.' },
  { key: 'inventory', title: 'Existencia', empty: 'Sin existencia.' },
  { key: 'activity', title: 'Movimientos', empty: 'Sin movimientos.' },
] as const

const metricKeys = ['sales', 'shrinkage', 'inventory'] as const

export function DashboardPage() {
  const { companyId } = useSession()
  const queryClient = useQueryClient()
  const enabled = companyId !== null && companyId !== ''
  const snapshot = useQuery({
    queryKey: ['dashboard', companyId],
    enabled,
    queryFn: () => loadDashboard(companyId ?? ''),
    retry: false,
  })
  const layout = useQuery({
    queryKey: ['dashboard-layout', companyId],
    enabled,
    queryFn: readDashboardLayout,
    retry: false,
  })
  const widgets = layout.data?.widgets ?? widgetCopy.map((widget, index) => ({
    key: widget.key,
    visible: true,
    x: 0,
    y: index,
    w: 1,
    h: 1,
  }))
  const visible = ordered(widgets).filter((widget) => widget.visible)
  const activityAt = visible.findIndex((widget) => widget.key === 'activity')
  const leading = activityAt < 0 ? visible : visible.slice(0, activityAt)
  const trailing = activityAt < 0 ? [] : visible.slice(activityAt + 1)
  const activity = activityAt < 0 ? null : visible[activityAt] ?? null
  const failed = snapshot.isError
  const data = snapshot.data ?? null

  async function persist(next: WidgetSetting[]) {
    const saved = await saveDashboardLayout(next)
    queryClient.setQueryData(['dashboard-layout', companyId], saved)
  }

  return (
    <div className="ops-page">
      <PageIntro title={dashboardMessages.title} description={dashboardMessages.description} />
      {snapshot.isFetching || layout.isFetching ? <p role="status">{shellMessages.loading}</p> : null}
      <MetricRow widgets={leading} all={widgets} snapshot={data} failed={failed} onPersist={persist} />
      <ChartRow widgets={widgets} />
      {activity ? (
        <ActivityTable
          actions={<WidgetActions widgets={widgets} widgetKey={activity.key} onPersist={persist} />}
        />
      ) : null}
      <MetricRow widgets={trailing} all={widgets} snapshot={data} failed={failed} onPersist={persist} />
      <HiddenWidgets widgets={widgets} onPersist={persist} />
    </div>
  )
}

function MetricRow({
  widgets,
  all,
  snapshot,
  failed,
  onPersist,
}: {
  widgets: readonly WidgetSetting[]
  all: readonly WidgetSetting[]
  snapshot: DashboardSnapshot | null
  failed: boolean
  onPersist: (next: WidgetSetting[]) => Promise<void>
}) {
  const metrics = widgets.filter((widget) => isMetric(widget.key))
  if (metrics.length === 0) {
    return null
  }
  return (
    <section className="kpi-row" aria-label={dashboardMessages.indicators}>
      {metrics.flatMap((widget) => kpiCards(widget, all, snapshot, failed, onPersist))}
    </section>
  )
}

function kpiCards(
  widget: WidgetSetting,
  all: readonly WidgetSetting[],
  snapshot: DashboardSnapshot | null,
  failed: boolean,
  onPersist: (next: WidgetSetting[]) => Promise<void>,
): ReactNode[] {
  const actions = <WidgetActions widgets={all} widgetKey={widget.key} onPersist={onPersist} />
  if (widget.key === 'inventory') {
    return [
      <KpiCard key="inventory-units" title={dashboardMessages.units} actions={actions}>
        {stockFigure(snapshot, failed, 'quantity')}
      </KpiCard>,
      <KpiCard key="inventory-value" title={dashboardMessages.value} actions={null}>
        {stockFigure(snapshot, failed, 'value')}
      </KpiCard>,
    ]
  }
  return [
    <KpiCard key={widget.key} title={titleOf(widget.key)} actions={actions}>
      {moneyFigure(widget.key === 'sales' ? snapshot?.salesAmount : snapshot?.shrinkageCost, failed, emptyOf(widget.key))}
    </KpiCard>,
  ]
}

function KpiCard({ title, actions, children }: { title: string; actions: ReactNode; children: ReactNode }) {
  return (
    <article className="kpi-card">
      <h2>{title}</h2>
      {children}
      {actions}
    </article>
  )
}

function ChartRow({ widgets }: { widgets: readonly WidgetSetting[] }) {
  const sales = widgets.find((widget) => widget.key === 'sales')
  const inventory = widgets.find((widget) => widget.key === 'inventory')
  const cards = [
    sales?.visible ? { key: 'sales', title: 'Ventas' } : null,
    inventory?.visible ? { key: 'inventory', title: 'Existencia' } : null,
  ].filter((card) => card !== null)
  if (cards.length === 0) {
    return null
  }
  return (
    <section className="chart-row" aria-label={dashboardMessages.series}>
      {cards.map((card) => (
        <article key={card.key} className="panel chart-card">
          <h2>{card.title}</h2>
          <p className="chart-empty">{dashboardMessages.noSeries}</p>
        </article>
      ))}
    </section>
  )
}

function ActivityTable({ actions }: { actions: ReactNode }) {
  return (
    <article className="panel">
      <header className="panel-head">
        <h2>{dashboardMessages.activity}</h2>
        {actions}
      </header>
      <div className="table-scroll">
        <table className="ui-table">
          <thead>
            <tr>
              {dashboardMessages.columns.map((column) => (
                <th key={column} scope="col">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="empty-cell" colSpan={dashboardMessages.columns.length}>{emptyOf('activity')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  )
}

function HiddenWidgets({
  widgets,
  onPersist,
}: {
  widgets: readonly WidgetSetting[]
  onPersist: (next: WidgetSetting[]) => Promise<void>
}) {
  const hidden = widgets.filter((widget) => !widget.visible)
  if (hidden.length === 0) {
    return null
  }
  return (
    <section className="panel">
      <h2>Widgets</h2>
      <div className="pager">
        {hidden.map((widget) => (
          <button key={widget.key} type="button" className="ghost-button" onClick={() => { void onPersist(toggleWidget(widgets, widget.key)) }}>
            Mostrar {titleOf(widget.key)}
          </button>
        ))}
      </div>
    </section>
  )
}

function WidgetActions({
  widgets,
  widgetKey,
  onPersist,
}: {
  widgets: readonly WidgetSetting[]
  widgetKey: string
  onPersist: (next: WidgetSetting[]) => Promise<void>
}) {
  return (
    <div className="widget-actions">
      <button type="button" className="ghost-button" onClick={() => { void onPersist(moveWidget(widgets, widgetKey, -1)) }}>
        {tableMessages.up}
      </button>
      <button type="button" className="ghost-button" onClick={() => { void onPersist(moveWidget(widgets, widgetKey, 1)) }}>
        {tableMessages.down}
      </button>
      <button type="button" className="ghost-button" onClick={() => { void onPersist(toggleWidget(widgets, widgetKey)) }}>
        Ocultar
      </button>
    </div>
  )
}

function moneyFigure(amount: number | undefined, failed: boolean, empty: string) {
  if (amount === undefined && !failed) {
    return null
  }
  if (failed || amount === undefined || amount === 0) {
    return <p className="empty-row">{empty}</p>
  }
  return (
    <>
      <strong className="kpi-value">{money(amount)}</strong>
      <p className="kpi-delta">{dashboardMessages.noComparison}</p>
    </>
  )
}

function stockFigure(snapshot: DashboardSnapshot | null, failed: boolean, part: 'quantity' | 'value') {
  if (snapshot === null && !failed) {
    return null
  }
  if (failed || snapshot === null || (snapshot.inventoryQuantity === 0 && snapshot.inventoryValue === 0)) {
    return <p className="empty-row">{emptyOf('inventory')}</p>
  }
  if (part === 'quantity') {
    return (
      <>
        <strong className="kpi-value">{snapshot.inventoryQuantity}</strong>
        <p className="kpi-delta">{dashboardMessages.noComparison}</p>
      </>
    )
  }
  if (snapshot.inventoryValue === 0) {
    return <p className="empty-row">{emptyOf('inventory')}</p>
  }
  return (
    <>
      <strong className="kpi-value">{money(snapshot.inventoryValue)}</strong>
      <p className="kpi-delta">{dashboardMessages.noComparison}</p>
    </>
  )
}

function ordered(widgets: readonly WidgetSetting[]): WidgetSetting[] {
  return [...widgets].sort((left, right) => left.y - right.y)
}

function isMetric(key: string): boolean {
  return metricKeys.some((metric) => metric === key)
}

function moveWidget(widgets: readonly WidgetSetting[], key: string, direction: -1 | 1): WidgetSetting[] {
  const next = ordered(widgets)
  const index = next.findIndex((widget) => widget.key === key)
  const target = index + direction
  if (index < 0 || target < 0 || target >= next.length) {
    return next.map((widget, y) => ({ ...widget, y }))
  }
  const copy = next.slice()
  const [item] = copy.splice(index, 1)
  if (item === undefined) {
    return next.map((widget, y) => ({ ...widget, y }))
  }
  copy.splice(target, 0, item)
  return copy.map((widget, y) => ({ ...widget, y }))
}

function toggleWidget(widgets: readonly WidgetSetting[], key: string): WidgetSetting[] {
  return widgets.map((widget) => {
    if (widget.key !== key) {
      return widget
    }
    return { ...widget, visible: !widget.visible }
  })
}

function titleOf(key: string): string {
  return widgetCopy.find((widget) => widget.key === key)?.title ?? key
}

function emptyOf(key: string): string {
  return widgetCopy.find((widget) => widget.key === key)?.empty ?? 'Sin datos.'
}

function money(amount: number): string {
  return new Intl.NumberFormat('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}
