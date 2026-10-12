import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { shellMessages } from '@/shared/i18n/messages'

export function PageIntro({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <header className="page-intro">
      <div>
        <Breadcrumb title={title} />
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  )
}

function Breadcrumb({ title }: { title: string }) {
  return (
    <nav className="crumbs" aria-label="Ruta">
      <Link to="/dashboard">{shellMessages.brand}</Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{title}</span>
    </nav>
  )
}

export function DevNote({ children }: { children: string }) {
  return <p className="dev-note">{children}</p>
}

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="panel">
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  )
}

export function DataTable({ columns, rows }: { columns: readonly string[]; rows: readonly (readonly string[])[] }) {
  return (
    <div className="table-scroll">
      <table className="ui-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join('|')}>
              {row.map((cell, index) => (
                <td key={`${row[0]}-${columns[index] ?? index}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
