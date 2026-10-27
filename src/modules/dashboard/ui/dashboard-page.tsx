import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useSession } from '@/app/providers/session'
import { readDashboardLayout, saveDashboardLayout, type DashboardChartType, type WidgetSetting } from '@/shared/api/layouts'
import { tableMessages } from '@/shared/i18n/messages'
import { Button } from '@/shared/ui/button'
import { PageIntro, Panel } from '@/shared/ui/ops'
import { ServerTable } from '@/shared/ui/server-table'
import { Skeleton } from '@/shared/ui/skeleton'
import { loadDashboard, loadRecentMovements, type DashboardSnapshot } from '../api'
import { dashboardMessages } from '../messages'
import { DashboardChart, type ChartPoint } from './dashboard-chart'
import { DashboardWidgetFrame } from './dashboard-widget-frame'
import { dashboardWidgets, defaultDashboardLayout, orderedWidgets, reorderedWidgets, updateWidget } from './dashboard-layout'

export function DashboardPage() {
  const { companyId, grants, role } = useSession()
  const queryClient = useQueryClient()
  const enabled = companyId !== null && companyId !== ''
  const canCustomize = role === 'owner' || grants?.some((grant) => grant.module === 'dashboard' && grant.access === 'edit') === true
  const [editMode, setEditMode] = useState(false)
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
  const save = useMutation({
    mutationFn: saveDashboardLayout,
    onSuccess: (saved) => queryClient.setQueryData(['dashboard-layout', companyId], saved),
  })
  const widgets = orderedWidgets(layout.data?.widgets ?? defaultDashboardLayout())
  const visible = widgets.filter((widget) => widget.visible)
  const hidden = widgets.filter((widget) => !widget.visible)
  const data = snapshot.data ?? null
  const failed = snapshot.isError && snapshot.data === undefined
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function persist(next: WidgetSetting[]) {
    save.mutate(next)
  }

  function onDragEnd(event: DragEndEvent) {
    if (!canCustomize || !editMode || typeof event.over?.id !== 'string' || typeof event.active.id !== 'string') {
      return
    }
    persist(reorderedWidgets(widgets, event.active.id, event.over.id))
  }

  function resizeWidget(key: string, size: 'w' | 'h', value: number) {
    const next = size === 'w'
      ? updateWidget(widgets, key, { w: value })
      : updateWidget(widgets, key, { h: value })
    persist(next)
  }

  function setChartType(key: string, chartType: DashboardChartType) {
    persist(updateWidget(widgets, key, { chartType }))
  }

  function setWidgetVisible(key: string, isVisible: boolean) {
    persist(updateWidget(widgets, key, { visible: isVisible }))
  }

  return (
    <div className="ops-page dashboard-page">
      <PageIntro
        title={dashboardMessages.title}
        description={dashboardMessages.description}
        action={canCustomize ? <Button type="button" variant={editMode ? 'primary' : 'quiet'} disabled={layout.isPending || save.isPending} onClick={() => setEditMode((current) => !current)}>{editMode ? 'Terminar personalización' : 'Personalizar tablero'}</Button> : undefined}
      />
      {snapshot.isFetching && !snapshot.isPending ? <p className="table-refresh-status" role="status">Actualizando indicadores…</p> : null}
      {snapshot.isError ? <div className="table-load-error" role="alert"><p>No se pudieron cargar los indicadores. Puedes volver a intentarlo.</p><button type="button" className="ghost-button" onClick={() => void snapshot.refetch()} disabled={snapshot.isFetching}>{tableMessages.retry}</button></div> : null}
      {layout.isError ? <div className="table-load-error" role="alert"><p>No se pudo cargar la distribución guardada. Se muestra la distribución inicial.</p><button type="button" className="ghost-button" onClick={() => void layout.refetch()} disabled={layout.isFetching}>{tableMessages.retry}</button></div> : null}
      {editMode ? <p className="dashboard-edit-hint">Usa el control de arrastre para ordenar. Ajusta el ancho y el alto de cada panel; los cambios se guardan automáticamente.</p> : null}
      {save.isError ? <div className="table-load-error" role="alert"><p>No se pudo guardar la personalización. Vuelve a intentarlo.</p><button type="button" className="ghost-button" onClick={() => save.reset()}>Cerrar</button></div> : null}
      {save.isPending ? <p className="table-refresh-status" role="status">Guardando distribución…</p> : null}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={visible.map((widget) => widget.key)} strategy={rectSortingStrategy}>
          <section className="dashboard-widget-grid" aria-label="Indicadores y gráficos del tablero">
            {visible.map((widget) => <DashboardWidgetFrame
              key={widget.key}
              widget={widget}
              editMode={canCustomize && editMode}
              saving={save.isPending}
              onResize={resizeWidget}
              onChartType={setChartType}
              onHide={(key) => setWidgetVisible(key, false)}
            >
              {widgetContent(widget, data, failed, companyId)}
            </DashboardWidgetFrame>)}
          </section>
        </SortableContext>
      </DndContext>
      {canCustomize && editMode && hidden.length > 0 ? <Panel title="Paneles ocultos">
        <div className="dashboard-hidden-widgets">{hidden.map((widget) => <Button key={widget.key} type="button" variant="quiet" disabled={save.isPending} onClick={() => setWidgetVisible(widget.key, true)}>Agregar {titleOf(widget.key)}</Button>)}</div>
      </Panel> : null}
      <QuickActions />
    </div>
  )
}

function widgetContent(widget: WidgetSetting, snapshot: DashboardSnapshot | null, failed: boolean, companyId: string | null): ReactNode {
  if (widget.key === 'sales') {
    return <MetricPanel title="Ventas de los últimos 30 días">{moneyFigure(snapshot?.salesAmount, failed, 'Sin ventas en el periodo.')}</MetricPanel>
  }
  if (widget.key === 'shrinkage') {
    return <MetricPanel title="Costo de mermas">{moneyFigure(snapshot?.shrinkageCost, failed, 'Sin mermas en el periodo.')}</MetricPanel>
  }
  if (widget.key === 'inventory') {
    return <InventoryPanel snapshot={snapshot} failed={failed} />
  }
  if (widget.key === 'sales-chart') {
    return <ChartPanel title="Ventas por día" chartTitle="Ventas diarias" points={salesPoints(snapshot)} snapshot={snapshot} failed={failed} chartType={widget.chartType} formatValue={money} />
  }
  if (widget.key === 'movement-chart') {
    return <ChartPanel title="Actividad diaria" chartTitle="Movimientos diarios" points={movementPoints(snapshot)} snapshot={snapshot} failed={failed} chartType={widget.chartType} formatValue={count} />
  }
  if (widget.key === 'activity') {
    return <ServerTable
      tableKey="dashboard-activity"
      companyId={companyId}
      columns={[
        { key: 'date', label: 'Fecha' },
        { key: 'movement', label: 'Movimiento' },
        { key: 'status', label: 'Estado' },
        { key: 'reference', label: 'Referencia' },
      ]}
      queryKey="dashboard-recent"
      title={dashboardMessages.activity}
      empty="No hay movimientos para mostrar."
      searchHint="Busca por tipo o referencia"
      load={(query) => loadRecentMovements(companyId ?? '', query)}
    />
  }
  return null
}

function ChartPanel({
  title,
  chartTitle,
  points,
  snapshot,
  failed,
  chartType,
  formatValue,
}: {
  title: string
  chartTitle: string
  points: readonly ChartPoint[]
  snapshot: DashboardSnapshot | null
  failed: boolean
  chartType: DashboardChartType
  formatValue: (value: number) => string
}) {
  if (snapshot === null && !failed) {
    return <Panel title={title}><Skeleton className="skeleton-block dashboard-chart-skeleton" /></Panel>
  }
  if (failed) {
    return <Panel title={title}><p className="empty-row">No se pudo cargar este gráfico.</p></Panel>
  }
  return <Panel title={title}><DashboardChart title={chartTitle} points={points} type={chartType} formatValue={formatValue} /></Panel>
}

function salesPoints(snapshot: DashboardSnapshot | null): ChartPoint[] {
  return (snapshot?.daily ?? []).map((day) => ({ date: day.date, value: day.salesAmount }))
}

function movementPoints(snapshot: DashboardSnapshot | null): ChartPoint[] {
  return (snapshot?.daily ?? []).map((day) => ({ date: day.date, value: day.movementCount }))
}

function MetricPanel({ title, children }: { title: string; children: ReactNode }) {
  return <Panel title={title}><div className="dashboard-metric-content">{children}</div></Panel>
}

function InventoryPanel({ snapshot, failed }: { snapshot: DashboardSnapshot | null; failed: boolean }) {
  return <Panel title="Existencia actual"><div className="dashboard-inventory-metrics">
    <MetricValue label="Unidades en inventario" value={snapshot === null && !failed ? null : failed ? null : count(snapshot?.inventoryQuantity ?? 0)} failed={failed} />
    <MetricValue label="Valor del inventario" value={snapshot === null && !failed ? null : failed ? null : money(snapshot?.inventoryValue ?? 0)} failed={failed} />
  </div></Panel>
}

function MetricValue({ label, value, failed }: { label: string; value: string | null; failed: boolean }) {
  if (value === null && failed) {
    return <div className="dashboard-metric-value"><span>{label}</span><p className="empty-row">Indicador no disponible.</p></div>
  }
  if (value === null) {
    return <div className="dashboard-metric-value"><span>{label}</span><Skeleton className="skeleton-line dashboard-value-skeleton" /></div>
  }
  return <div className="dashboard-metric-value"><span>{label}</span><strong>{value}</strong></div>
}

function moneyFigure(amount: number | undefined, failed: boolean, empty: string) {
  if (amount === undefined && !failed) {
    return <Skeleton className="skeleton-line dashboard-value-skeleton" />
  }
  if (failed) {
    return <p className="empty-row">Indicador no disponible.</p>
  }
  if (amount === undefined || amount === 0) {
    return <p className="empty-row">{empty}</p>
  }
  return <strong className="kpi-value">{money(amount)}</strong>
}

function QuickActions() {
  const actions = [
    { to: '/scan', mark: '01', title: 'Registrar movimiento', detail: 'Escanea productos para entradas o salidas.' },
    { to: '/prices', mark: '02', title: 'Revisar precios', detail: 'Consulta propuestas y precios vigentes.' },
    { to: '/documents', mark: '03', title: 'Crear comprobante', detail: 'Registra y firma un comprobante.' },
  ] as const
  return <section className="dashboard-actions" aria-label="Acciones frecuentes">
    <div className="dashboard-actions-heading"><span>OPERACIÓN</span><h2>¿Qué necesitas hacer?</h2></div>
    {actions.map((action) => <Link key={action.to} to={action.to} className="dashboard-action"><span className="dashboard-action-mark">{action.mark}</span><strong>{action.title}</strong><small>{action.detail}</small><span className="dashboard-action-arrow" aria-hidden="true">↗</span></Link>)}
  </section>
}

function titleOf(key: string): string {
  return dashboardWidgets.find((definition) => definition.key === key)?.title ?? key
}

function money(amount: number): string {
  return new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

function count(amount: number): string {
  return new Intl.NumberFormat('es-HN', { maximumFractionDigits: 0 }).format(amount)
}
