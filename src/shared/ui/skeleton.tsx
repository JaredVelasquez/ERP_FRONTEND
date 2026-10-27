import type { CSSProperties } from 'react'

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`ui-skeleton ${className}`.trim()} aria-hidden="true" />
}

export function TableSkeleton({
  columns = 5,
  rows = 5,
  label = 'Cargando registros…',
}: {
  columns?: number
  rows?: number
  label?: string
}) {
  const gridStyle = { '--skeleton-columns': Math.max(1, columns) } as CSSProperties
  return (
    <div className="table-skeleton" role="status">
      <div className="table-skeleton-grid table-skeleton-head" style={gridStyle} aria-hidden="true">
        {Array.from({ length: Math.max(1, columns) }, (_, index) => <Skeleton key={index} className="skeleton-line skeleton-line--short" />)}
      </div>
      {Array.from({ length: Math.max(1, rows) }, (_, row) => (
        <div className="table-skeleton-grid table-skeleton-row" style={gridStyle} key={row} aria-hidden="true">
          {Array.from({ length: Math.max(1, columns) }, (_, column) => <Skeleton key={column} className={`skeleton-line${column === 0 ? ' skeleton-line--wide' : ''}`} />)}
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function ListSkeleton({
  rows = 4,
  label = 'Cargando contenido…',
}: {
  rows?: number
  label?: string
}) {
  return (
    <div className="list-skeleton" role="status">
      {Array.from({ length: Math.max(1, rows) }, (_, index) => (
        <div className="list-skeleton-row" key={index} aria-hidden="true">
          <Skeleton className="skeleton-line skeleton-line--wide" />
          <Skeleton className="skeleton-line skeleton-line--short" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function PageLoadingSkeleton() {
  return (
    <div className="page-loading-skeleton" role="status">
      <span className="sr-only">Cargando sección…</span>
      <div className="page-loading-heading" aria-hidden="true">
        <Skeleton className="skeleton-line skeleton-line--short" />
        <Skeleton className="skeleton-line skeleton-title" />
        <Skeleton className="skeleton-line skeleton-line--wide" />
      </div>
      <div className="page-loading-panel" aria-hidden="true">
        <Skeleton className="skeleton-line skeleton-line--short" />
        <div className="page-loading-grid">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="skeleton-block" />)}
        </div>
        <Skeleton className="skeleton-block skeleton-block--large" />
      </div>
    </div>
  )
}
