import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import type { FieldReport } from '@/shared/hooks/use-field-set'

export const controlClass = 'ui-control'

const selectClass = `${controlClass} appearance-none pr-10`

const checkClass =
  'peer h-5 w-5 shrink-0 appearance-none rounded-md border border-[var(--border-strong)] bg-white outline-none checked:border-[var(--brand)] checked:bg-[var(--brand)] focus-visible:shadow-[0_0_0_3px_rgba(1,87,210,0.2)]'

export function FieldStack({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const span = wide ? 'span-2' : ''
  return <div className={`grid gap-1.5 ${span}`}>{children}</div>
}

export function FieldLabel({ htmlFor, id, children }: { htmlFor: string; id?: string; children: ReactNode }) {
  return (
    <label id={id} className="text-sm font-semibold text-[var(--text)]" htmlFor={htmlFor}>
      {children}
    </label>
  )
}

export function FieldHint({ children }: { children: string }) {
  return <p className="m-0 text-[0.82rem] leading-snug text-[var(--text-muted)]">{children}</p>
}

export function FieldError({ id, children }: { id?: string; children: string }) {
  return (
    <p id={id} className="m-0 text-[0.82rem] text-[#9f1239]" role="alert">
      {children}
    </p>
  )
}

function useReveal(reveal: number) {
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (reveal > 0) {
      setTouched(true)
    }
  }, [reveal])
  return { touched, markTouched: () => setTouched(true) }
}

function useReport(report: FieldReport | undefined, field: string, valid: boolean) {
  useEffect(() => {
    report?.(field, valid)
  }, [report, field, valid])
}

type TextFieldProps = {
  id: string
  name: string
  label: string
  hint?: string
  type?: 'text' | 'email' | 'password' | 'tel'
  inputMode?: 'decimal' | 'text' | 'tel' | 'numeric'
  autoComplete?: string
  required?: boolean
  requiredMessage?: string
  invalidMessage?: string
  validate?: (value: string) => string | null
  defaultValue?: string
  value?: string
  onValue?: (value: string) => void
  multiline?: boolean
  wide?: boolean
  field?: string
  report?: FieldReport
  reveal?: number
}

export function TextField({
  id,
  name,
  label,
  hint,
  type = 'text',
  inputMode,
  autoComplete,
  required = false,
  requiredMessage = 'Completa este campo.',
  invalidMessage = 'Revisa este dato.',
  validate,
  defaultValue = '',
  value,
  onValue,
  multiline = false,
  wide = false,
  field,
  report,
  reveal = 0,
}: TextFieldProps) {
  const [internal, setInternal] = useState(defaultValue)
  const current = value ?? internal
  const { touched, markTouched } = useReveal(reveal)
  const message = textIssue(current, { required, requiredMessage, invalidMessage, type, validate })
  useReport(report, field ?? name, message === null)
  const error = touched ? message : null
  const describedBy = error ? `${id}-error` : undefined

  function onChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const next = event.target.value
    if (value === undefined) {
      setInternal(next)
    }
    onValue?.(next)
  }

  const shared = {
    id,
    name,
    value: current,
    autoComplete,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    className: controlClass,
    onChange,
    onBlur: markTouched,
  }

  return (
    <FieldStack wide={wide || multiline}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      {multiline ? (
        <textarea {...shared} rows={4} className={`${controlClass} min-h-24 py-2.5`} />
      ) : (
        <input {...shared} type={type} inputMode={inputMode} />
      )}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </FieldStack>
  )
}

function textIssue(
  value: string,
  rules: {
    required: boolean
    requiredMessage: string
    invalidMessage: string
    type: string
    validate?: (value: string) => string | null
  },
): string | null {
  const trimmed = value.trim()
  if (rules.required && trimmed === '') {
    return rules.requiredMessage
  }
  if (rules.type === 'email' && trimmed !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return rules.invalidMessage
  }
  if (rules.validate) {
    return rules.validate(value)
  }
  return null
}

type SelectOption = { value: string; label: string }

type SelectFieldProps = {
  id: string
  name: string
  label: string
  hint?: string
  options: readonly SelectOption[]
  defaultValue?: string
  value?: string
  onValue?: (value: string) => void
  required?: boolean
  requiredMessage?: string
  wide?: boolean
  field?: string
  report?: FieldReport
  reveal?: number
}

export function SelectField({
  id,
  name,
  label,
  hint,
  options,
  defaultValue = '',
  value,
  onValue,
  required = false,
  requiredMessage = 'Elige una opción.',
  wide = false,
  field,
  report,
  reveal = 0,
}: SelectFieldProps) {
  const [internal, setInternal] = useState(defaultValue)
  const current = value ?? internal
  const { touched, markTouched } = useReveal(reveal)
  const message = required && current.trim() === '' ? requiredMessage : null
  useReport(report, field ?? name, message === null)
  const error = touched ? message : null

  return (
    <FieldStack wide={wide}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <div className="relative">
        <select
          id={id}
          name={name}
          value={current}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={selectClass}
          onChange={(event) => {
            if (value === undefined) {
              setInternal(event.target.value)
            }
            onValue?.(event.target.value)
          }}
          onBlur={markTouched}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
            className="pointer-events-none absolute right-3.5 top-1/2 h-2 w-2 -translate-y-[60%] rotate-45 border-b-2 border-r-2 border-[var(--text)]"
        />
      </div>
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </FieldStack>
  )
}

type SearchFieldProps = {
  id: string
  name?: string
  label: string
  hint?: string
  value: string
  onValue: (value: string) => void
}

export function SearchField({ id, name = 'search', label, hint, value, onValue }: SearchFieldProps) {
  return (
    <FieldStack>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <input
        id={id}
        name={name}
        type="text"
        value={value}
        autoComplete="off"
        className={controlClass}
        onChange={(event) => onValue(event.target.value)}
      />
    </FieldStack>
  )
}

type CheckFieldProps = {
  name: string
  label: string
  required?: boolean
  requiredMessage?: string
  field?: string
  report?: FieldReport
  reveal?: number
  defaultChecked?: boolean
  wide?: boolean
}

export function CheckField({
  name,
  label,
  required = false,
  requiredMessage = 'Marca esta casilla para continuar.',
  field,
  report,
  reveal = 0,
  defaultChecked = false,
  wide = false,
}: CheckFieldProps) {
  const [checked, setChecked] = useState(defaultChecked)
  const { touched, markTouched } = useReveal(reveal)
  const message = required && !checked ? requiredMessage : null
  useReport(report, field ?? name, message === null)
  const error = touched ? message : null
  const inputId = `${name}-check`

  return (
    <FieldStack wide={wide}>
      <label className="flex min-h-11 items-start gap-3 py-1 text-sm leading-snug text-[#1c2430]">
        <span className="relative mt-0.5 inline-flex shrink-0">
          <input
            id={inputId}
            name={name}
            type="checkbox"
            checked={checked}
            aria-invalid={error ? true : undefined}
            className={checkClass}
            onChange={(event) => setChecked(event.target.checked)}
            onBlur={markTouched}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-[7px] top-[3px] hidden h-2.5 w-1.5 rotate-45 border-b-2 border-r-2 border-white peer-checked:block"
          />
        </span>
        {label}
      </label>
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldStack>
  )
}

type FileFieldProps = {
  id: string
  name: string
  label: string
  hint?: string
  emptyLabel: string
  required?: boolean
  requiredMessage?: string
  accept?: string
  field?: string
  report?: FieldReport
  reveal?: number
}

export function FileField({
  id,
  name,
  label,
  hint,
  emptyLabel,
  required = false,
  requiredMessage = 'Elige un archivo.',
  accept,
  field,
  report,
  reveal = 0,
}: FileFieldProps) {
  const [fileName, setFileName] = useState('')
  const { touched, markTouched } = useReveal(reveal)
  const message = required && fileName === '' ? requiredMessage : null
  useReport(report, field ?? name, message === null)
  const error = touched ? message : null

  return (
    <FieldStack>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      <div className="relative focus-within:[&>div]:border-[#0157D2] focus-within:[&>div]:shadow-[0_0_0_3px_rgba(1,87,210,0.2)]">
        <input
          id={id}
          name={name}
          type="file"
          accept={accept}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')}
          onBlur={markTouched}
        />
        <div className={`${controlClass} flex items-center`} aria-hidden="true">
          {fileName === '' ? emptyLabel : fileName}
        </div>
      </div>
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </FieldStack>
  )
}
