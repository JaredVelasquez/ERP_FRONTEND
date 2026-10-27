import { useSortable } from '@dnd-kit/sortable'
import type { CSSProperties, ReactNode } from 'react'
import type { DashboardChartType, WidgetSetting } from '@/shared/api/layouts'
import { chartTypeLabel, definitionOf } from './dashboard-layout'

export function DashboardWidgetFrame({
  widget,
  editMode,
  saving,
  onResize,
  onChartType,
  onHide,
  children,
}: {
  widget: WidgetSetting
  editMode: boolean
  saving: boolean
  onResize: (key: string, size: 'w' | 'h', value: number) => void
  onChartType: (key: string, value: DashboardChartType) => void
  onHide: (key: string) => void
  children: ReactNode
}) {
  const sortable = useSortable({ id: widget.key, disabled: !editMode || saving })
  const definition = definitionOf(widget.key)
  const style: CSSProperties = {
    transform: sortable.transform === null ? undefined : `translate3d(${sortable.transform.x}px, ${sortable.transform.y}px, 0) scaleX(${sortable.transform.scaleX}) scaleY(${sortable.transform.scaleY})`,
    transition: sortable.transition,
    opacity: sortable.isDragging ? .45 : 1,
  }

  return (
    <article ref={sortable.setNodeRef} style={style} className={`dashboard-widget dashboard-widget--width-${widget.w} dashboard-widget--height-${widget.h}${sortable.isDragging ? ' dashboard-widget--dragging' : ''}`}>
      {editMode ? <header className="dashboard-widget-editor">
        <button
          type="button"
          className="dashboard-drag-handle"
          aria-label={`Mover ${definition?.title ?? 'panel'}`}
          title="Arrastra para cambiar el orden"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
            <circle cx="6" cy="5" r="1.2" fill="currentColor" />
            <circle cx="14" cy="5" r="1.2" fill="currentColor" />
            <circle cx="6" cy="10" r="1.2" fill="currentColor" />
            <circle cx="14" cy="10" r="1.2" fill="currentColor" />
            <circle cx="6" cy="15" r="1.2" fill="currentColor" />
            <circle cx="14" cy="15" r="1.2" fill="currentColor" />
          </svg>
        </button>
        <strong>{definition?.title ?? widget.key}</strong>
        <label className="dashboard-size-control">
          <span>Ancho</span>
          <select aria-label={`Ancho de ${definition?.title ?? 'panel'}`} value={widget.w} disabled={saving} onChange={(event) => onResize(widget.key, 'w', Number(event.currentTarget.value))}>
            {[1, 2, 3, 4].map((width) => <option key={width} value={width}>{width} {width === 1 ? 'columna' : 'columnas'}</option>)}
          </select>
        </label>
        <label className="dashboard-size-control">
          <span>Alto</span>
          <select aria-label={`Alto de ${definition?.title ?? 'panel'}`} value={widget.h} disabled={saving} onChange={(event) => onResize(widget.key, 'h', Number(event.currentTarget.value))}>
            {[1, 2, 3].map((height) => <option key={height} value={height}>{height} {height === 1 ? 'nivel' : 'niveles'}</option>)}
          </select>
        </label>
        {definition?.kind === 'chart' ? <label className="dashboard-size-control dashboard-chart-type-control">
          <span>Gráfico</span>
          <select aria-label={`Tipo de gráfico para ${definition.title}`} value={widget.chartType} disabled={saving} onChange={(event) => onChartType(widget.key, event.currentTarget.value as DashboardChartType)}>
            {(['bar', 'line', 'area'] as const).map((type) => <option key={type} value={type}>{chartTypeLabel(type)}</option>)}
          </select>
        </label> : null}
        <button type="button" className="dashboard-widget-hide" disabled={saving} onClick={() => onHide(widget.key)}>Ocultar</button>
      </header> : null}
      {children}
    </article>
  )
}
