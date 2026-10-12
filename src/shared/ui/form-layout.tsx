import type { FormEvent, ReactNode, RefObject } from 'react'

export function Form({ onSubmit, children }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: ReactNode }) {
  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      {children}
    </form>
  )
}

export function FormSection({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <fieldset className="m-0 grid gap-3 border-0 p-0">
      <legend className="p-0 text-[0.95rem] font-semibold text-[#1c2430]">{title}</legend>
      {hint ? <p className="m-0 text-[0.82rem] leading-snug text-[#5c6778]">{hint}</p> : null}
      <div className="form-grid">{children}</div>
    </fieldset>
  )
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2">{children}</div>
}

export function FormNotice({ children, tone = 'ok' }: { children: string; tone?: 'ok' | 'error' }) {
  const color = tone === 'error' ? 'text-[#9f1239]' : 'text-[#5c6778]'
  return (
    <p className={`m-0 text-sm ${color}`} role="status">
      {children}
    </p>
  )
}

export function FormDialog({
  dialogRef,
  title,
  titleId,
  onClose,
  children,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>
  title: string
  titleId: string
  onClose?: () => void
  children: ReactNode
}) {
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="w-[min(720px,calc(100vw-2rem))] rounded-[10px] border border-[#e6e8ee] bg-white p-0 text-[#1c2430] backdrop:bg-[#071633]/40"
      onClose={onClose}
    >
      <div className="grid gap-4 p-5">
        <h2 id={titleId} className="m-0 text-lg font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  )
}
