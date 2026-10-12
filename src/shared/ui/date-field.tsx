import { useEffect, useId, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import type { FieldReport } from '@/shared/hooks/use-field-set'
import { controlClass, FieldError, FieldHint, FieldLabel, FieldStack } from '@/shared/ui/fields'

type DateFieldProps = {
  id: string
  name: string
  label: string
  hint?: string
  defaultValue?: string
  required?: boolean
  requiredMessage?: string
  emptyLabel?: string
  field?: string
  report?: FieldReport
  reveal?: number
}

export function DateField({
  id,
  name,
  label,
  hint,
  defaultValue = '',
  required = false,
  requiredMessage = 'Elige una fecha.',
  emptyLabel = 'dd/mm/aaaa',
  field,
  report,
  reveal = 0,
}: DateFieldProps) {
  const [value, setValue] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [touched, setTouched] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const popupId = useId()
  const selected = parseIso(value)
  const message = required && value.trim() === '' ? requiredMessage : null

  useEffect(() => {
    if (reveal > 0) {
      setTouched(true)
    }
  }, [reveal])

  useEffect(() => {
    report?.(field ?? name, message === null)
  }, [report, field, name, message])

  useEffect(() => {
    if (!open) {
      return
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setTouched(true)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const error = touched && !open ? message : null
  const shown = value === '' ? emptyLabel : toDisplay(value)

  function pick(date: Date | undefined) {
    if (!date) {
      return
    }
    setValue(toIso(date))
    setOpen(false)
    setTouched(true)
  }

  function onKeyDown(event: { key: string; preventDefault: () => void; stopPropagation: () => void }) {
    if (event.key !== 'Escape') {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    setOpen(false)
    setTouched(true)
  }

  return (
    <FieldStack>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <div className="relative" ref={rootRef} onKeyDown={onKeyDown}>
        <input type="hidden" name={name} value={value} />
        <button
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={popupId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${controlClass} flex items-center justify-between text-left`}
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return
            }
            setOpen((current) => !current)
          }}
          onClick={(event) => {
            if (event.detail !== 0) {
              return
            }
            setOpen((current) => !current)
          }}
          onBlur={() => {
            if (!open) {
              setTouched(true)
            }
          }}
        >
          <span className={value === '' ? 'text-[#5c6778]' : ''}>{shown}</span>
          <span aria-hidden="true" className="h-2 w-2 rotate-45 border-b-2 border-r-2 border-[#1c2430]" />
        </button>
        {open ? (
          <div
            id={popupId}
            role="dialog"
            aria-label={label}
            className="absolute z-30 mt-1 rounded-lg border border-[#e6e8ee] bg-white p-3 shadow-[0_8px_24px_rgba(7,22,51,0.12)] [--rdp-accent-background-color:#e8f0fc] [--rdp-accent-color:#0157D2]"
          >
            <DayPicker mode="single" locale={es} selected={selected} defaultMonth={selected} onSelect={pick} />
          </div>
        ) : null}
      </div>
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </FieldStack>
  )
}

function parseIso(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return undefined
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined
  }
  return date
}

function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function toDisplay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return ''
  }
  return `${match[3]}/${match[2]}/${match[1]}`
}
