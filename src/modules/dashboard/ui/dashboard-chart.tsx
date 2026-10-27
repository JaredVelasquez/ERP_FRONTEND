import type { DashboardChartType } from '@/shared/api/layouts'

export interface ChartPoint {
  date: string
  value: number
}

export function DashboardChart({
  title,
  points,
  type,
  formatValue,
}: {
  title: string
  points: readonly ChartPoint[]
  type: DashboardChartType
  formatValue: (value: number) => string
}) {
  const maximum = Math.max(...points.map((point) => point.value), 0)
  const scaleMaximum = maximum > 0 ? maximum : 1
  const plotted = points.map((point, index) => ({
    ...point,
    x: chartX(index, points.length),
    y: chartY(point.value, scaleMaximum),
  }))
  const line = plotted.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const area = `${line} L ${chartX(points.length - 1, points.length)} 190 L ${chartX(0, points.length)} 190 Z`

  if (points.length === 0 || maximum === 0) {
    return <div className="dashboard-chart-empty">Sin datos en el período seleccionado.</div>
  }

  return (
    <div className={`dashboard-chart dashboard-chart--${type}`}>
      <svg viewBox="0 0 760 232" role="img" aria-label={title} preserveAspectRatio="none">
        <title>{title}</title>
        {[0, 1, 2, 3].map((step) => {
          const y = 22 + step * 56
          return <line key={step} x1="54" x2="744" y1={y} y2={y} className="dashboard-chart-grid-line" />
        })}
        <text x="0" y="26" className="dashboard-chart-axis-label">{formatValue(maximum)}</text>
        <text x="0" y="190" className="dashboard-chart-axis-label">0</text>
        {type === 'bar' ? <BarMarks points={plotted} maximum={scaleMaximum} formatValue={formatValue} /> : null}
        {type === 'area' ? <path d={area} className="dashboard-chart-area" /> : null}
        {type !== 'bar' ? <path d={line} className="dashboard-chart-line" /> : null}
        {plotted.map((point, index) => <circle key={`${point.date}-${index}`} cx={point.x} cy={point.y} r="3.5" className="dashboard-chart-point"><title>{`${formatDate(point.date)} · ${formatValue(point.value)}`}</title></circle>)}
        {dateTicks(plotted).map((point) => <text key={point.date} x={point.x} y="222" textAnchor="middle" className="dashboard-chart-axis-label">{formatDate(point.date)}</text>)}
      </svg>
      <p className="dashboard-chart-caption">{points.length} días · {formatValue(points.reduce((sum, point) => sum + point.value, 0))} acumulados</p>
    </div>
  )
}

function BarMarks({ points, maximum, formatValue }: { points: Array<ChartPoint & { x: number; y: number }>; maximum: number; formatValue: (value: number) => string }) {
  const barWidth = Math.min(18, 650 / points.length)
  return <g className="dashboard-chart-bars">{points.map((point, index) => {
    const height = Math.max(2, 168 * point.value / maximum)
    return <rect key={`${point.date}-${index}`} x={point.x - barWidth / 2} y={190 - height} width={barWidth} height={height} rx="3" className="dashboard-chart-bar"><title>{`${formatDate(point.date)} · ${formatValue(point.value)}`}</title></rect>
  })}</g>
}

function chartX(index: number, count: number): number {
  return count < 2 ? 399 : 58 + index * (682 / (count - 1))
}

function chartY(value: number, maximum: number): number {
  return 190 - value / maximum * 168
}

function dateTicks(points: Array<ChartPoint & { x: number; y: number }>) {
  const step = Math.max(1, Math.ceil(points.length / 6))
  return points.filter((_, index) => index % step === 0 || index === points.length - 1)
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`)
  return new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(date)
}
