import type { DashboardChartType, WidgetSetting } from '@/shared/api/layouts'

export const dashboardWidgets = [
  { key: 'sales', title: 'Ventas', empty: 'Sin ventas en el periodo.', width: 1, height: 1, kind: 'metric' },
  { key: 'shrinkage', title: 'Mermas', empty: 'Sin mermas en el periodo.', width: 1, height: 1, kind: 'metric' },
  { key: 'inventory', title: 'Existencia', empty: 'Sin existencia.', width: 2, height: 1, kind: 'metric' },
  { key: 'sales-chart', title: 'Ventas por día', empty: 'Sin ventas para graficar.', width: 4, height: 2, kind: 'chart' },
  { key: 'movement-chart', title: 'Actividad diaria', empty: 'Sin movimientos para graficar.', width: 4, height: 2, kind: 'chart' },
  { key: 'activity', title: 'Movimientos recientes', empty: 'Sin movimientos.', width: 4, height: 1, kind: 'table' },
] as const

export type DashboardWidgetKey = (typeof dashboardWidgets)[number]['key']

export function defaultDashboardLayout(): WidgetSetting[] {
  return dashboardWidgets.map((definition, index) => ({
    key: definition.key,
    visible: true,
    x: 0,
    y: index,
    w: definition.width,
    h: definition.height,
    chartType: 'bar',
  }))
}

export function orderedWidgets(widgets: readonly WidgetSetting[]): WidgetSetting[] {
  return [...widgets].sort((left, right) => left.y - right.y || left.key.localeCompare(right.key))
}

export function reorderedWidgets(widgets: readonly WidgetSetting[], activeKey: string, overKey: string): WidgetSetting[] {
  const ordered = orderedWidgets(widgets)
  const fromIndex = ordered.findIndex((widget) => widget.key === activeKey)
  const toIndex = ordered.findIndex((widget) => widget.key === overKey)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return ordered.map((widget, index) => ({ ...widget, x: 0, y: index }))
  }
  const next = ordered.slice()
  const [moved] = next.splice(fromIndex, 1)
  if (moved === undefined) {
    return ordered.map((widget, index) => ({ ...widget, x: 0, y: index }))
  }
  next.splice(toIndex, 0, moved)
  return next.map((widget, index) => ({ ...widget, x: 0, y: index }))
}

export function updateWidget(
  widgets: readonly WidgetSetting[],
  key: string,
  change: Partial<Pick<WidgetSetting, 'visible' | 'w' | 'h' | 'chartType'>>,
): WidgetSetting[] {
  return widgets.map((widget) => widget.key === key ? { ...widget, ...change } : widget)
}

export function definitionOf(key: string) {
  return dashboardWidgets.find((definition) => definition.key === key)
}

export function chartTypeLabel(type: DashboardChartType): string {
  const labels: Record<DashboardChartType, string> = { bar: 'Columnas', line: 'Línea', area: 'Área' }
  return labels[type]
}
