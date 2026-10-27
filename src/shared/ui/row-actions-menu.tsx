import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface RowAction {
  label: string
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

export function RowActionsMenu({ label, actions }: { label: string; actions: RowAction[] }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, right: 0 })
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
    const close = (event: PointerEvent) => {
      if (menu.current?.contains(event.target as Node) || trigger.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    const onScroll = () => {
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect || rect.bottom <= 0 || rect.top >= window.innerHeight) {
        setOpen(false)
        return
      }
      setPosition({
        top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - actions.length * 42 - 20)),
        right: Math.max(8, window.innerWidth - rect.right),
      })
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  function toggle() {
    if (open) { setOpen(false); return }
    positionAtTrigger()
    setOpen(true)
  }

  function positionAtTrigger() {
    const rect = trigger.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({ top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - actions.length * 42 - 20)), right: Math.max(8, window.innerWidth - rect.right) })
  }

  return <>
    <button ref={trigger} type="button" className="row-actions-trigger" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); toggle() }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" /></svg>
    </button>
    {open ? createPortal(<div ref={menu} className="row-actions-menu" role="menu" aria-label={label} style={position} onKeyDown={(event) => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      const index = items.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length
      items[next]?.focus()
    }}>
      {actions.map((action) => <button key={action.label} type="button" role="menuitem" className={action.danger ? 'row-actions-danger' : ''} disabled={action.disabled}
        onClick={() => { setOpen(false); action.onSelect() }}>{action.label}</button>)}
    </div>, document.body) : null}
  </>
}
