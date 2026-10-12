import type { ReactNode } from 'react'

type OfflineSectionProps = {
  title: string
  note: string
  children?: ReactNode
}

export function OfflineSection({ title, note, children }: OfflineSectionProps) {
  return (
    <section className="w-full max-w-3xl rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-stone-700" role="status">
        {note}
      </p>
      {children}
    </section>
  )
}
