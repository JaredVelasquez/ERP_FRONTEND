import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useSession } from '@/app/providers/session'
import { PageIntro, Panel } from '@/shared/ui/ops'
import { confirmMovement, lookupCode, searchByName, seedChart, type PostedLine, type StockCard } from '../api'
import {
  formatMoney,
  formatQuantity,
  missingReceiptCost,
  money,
  parseMoney,
  parseQuantity,
  pricedUnit,
  receiptTotal,
  saleExceedsStock,
  saleTotal,
  type PricedLine,
} from '../domain/scan-ticket'
import { scanMessages } from '../messages'

type ScanMode = 'ingreso' | 'salida'

interface DraftLine {
  key: string
  productId: string
  name: string
  code: string
  unit: string
  factor: number
  quantityText: string
  unitCostText: string
  salePrice: number | null
  onHand: number
}

export function ScanPage() {
  const { companyId } = useSession()
  const codeRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<ScanMode>('salida')
  const [code, setCode] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [posted, setPosted] = useState<string[]>([])
  const [choices, setChoices] = useState<Array<{ name: string; barcode: string }>>([])
  const priced = lines.flatMap(toPriced)
  const totalsReady = priced.length === lines.length

  async function onScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextCode = code.trim()
    if (nextCode === '' || companyId === null || companyId === '') {
      return
    }
    setPosted([])
    setChoices([])
    const card = await lookupCode(companyId, nextCode)
    if (card === 'failed') {
      setNotice(scanMessages.lookupFailed)
      return
    }
    if (card !== 'unknown') {
      addFound(card, nextCode)
      return
    }
    const hits = await searchByName(companyId, nextCode)
    if (hits.length === 0) {
      setNotice(scanMessages.unknown)
      return
    }
    setChoices(hits)
    setNotice(scanMessages.pick)
  }

  function addFound(card: StockCard, nextCode: string) {
    const unit = pricedUnit(card)
    if (mode === 'salida' && unit.salePrice === null) {
      setNotice(scanMessages.noPrice)
      return
    }
    setLines((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        productId: card.productId,
        name: card.name,
        code: nextCode,
        unit: unit.unit,
        factor: unit.factor,
        quantityText: '1.0000',
        unitCostText: '',
        salePrice: unit.salePrice,
        onHand: card.baseQuantity,
      },
    ])
    setNotice(null)
    setCode('')
    setChoices([])
    codeRef.current?.focus()
  }

  async function pick(barcode: string) {
    if (companyId === null || companyId === '') {
      return
    }
    const card = await lookupCode(companyId, barcode)
    if (card === 'unknown' || card === 'failed') {
      setNotice(scanMessages.unknown)
      return
    }
    addFound(card, barcode)
  }

  async function onConfirm() {
    if (companyId === null || companyId === '' || lines.length === 0) {
      return
    }
    if (!totalsReady) {
      setNotice(scanMessages.badQuantity)
      return
    }
    if (mode === 'salida' && saleExceedsStock(priced)) {
      setNotice(scanMessages.negative)
      return
    }
    if (mode === 'ingreso' && missingReceiptCost(priced)) {
      setNotice(scanMessages.cost)
      return
    }
    const seeded = await seedChart(companyId)
    if (!seeded) {
      setNotice(scanMessages.chart)
      return
    }
    const result = await confirmMovement({
      companyId,
      type: mode === 'ingreso' ? 'purchase' : 'sale',
      lines: priced.map((line) => ({
        productId: line.productId,
        presentationFactor: line.factor,
        quantity: line.quantity,
        unitCost: mode === 'ingreso' ? line.unitCost : null,
        saleAmount: mode === 'salida' ? money((line.salePrice ?? 0) * line.quantity) : null,
      })),
    })
    if ('error' in result) {
      setNotice(noticeFor(result.error))
      return
    }
    setLines([])
    setNotice(mode === 'ingreso' ? scanMessages.postedIn : scanMessages.postedOut)
    setPosted(postedNotes(result.journal))
    codeRef.current?.focus()
  }

  function keepQuantity(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return
    }
    event.preventDefault()
  }

  const total = mode === 'salida' ? saleTotal(priced) : receiptTotal(priced)
  const totalReady = totalsReady && (mode === 'salida' || !missingReceiptCost(priced))

  return (
    <div className="ops-page scan-page">
      <PageIntro title={scanMessages.title} description={scanMessages.description} />
      <div className="scan-modes" role="group" aria-label={scanMessages.title}>
        <button type="button" className={mode === 'salida' ? 'primary-button' : 'ghost-button'} aria-pressed={mode === 'salida'} onClick={() => switchMode(setMode, setLines, 'salida')}>
          {scanMessages.salida}
        </button>
        <button type="button" className={mode === 'ingreso' ? 'primary-button' : 'ghost-button'} aria-pressed={mode === 'ingreso'} onClick={() => switchMode(setMode, setLines, 'ingreso')}>
          {scanMessages.ingreso}
        </button>
      </div>
      <Panel>
        <form className="toolbar" onSubmit={(event) => { void onScan(event) }}>
          <div className="field">
            <label htmlFor="scan-code">{scanMessages.code}</label>
            <input id="scan-code" ref={codeRef} value={code} autoComplete="off" autoFocus onChange={(event) => setCode(event.target.value)} />
          </div>
          <button type="submit" className="primary-button">{scanMessages.add}</button>
        </form>
        {choices.length > 0 ? (
          <ul className="choice-list">
            {choices.map((choice) => (
              <li key={choice.barcode}>
                <button type="button" className="ghost-button" onClick={() => { void pick(choice.barcode) }}>
                  {choice.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
      <Panel>
        {lines.length === 0 ? <p className="empty-row">{scanMessages.empty}</p> : null}
        <ul className="scan-lines">
          {lines.map((line) => (
            <li key={line.key}>
              <div>
                <strong>{line.name}</strong>
                <span>{line.unit} · {formatQuantity(line.factor)} · {scanMessages.onHand} {formatQuantity(line.onHand)}</span>
              </div>
              <label>
                {scanMessages.quantity}
                <input
                  value={line.quantityText}
                  inputMode="decimal"
                  onKeyDown={keepQuantity}
                  onChange={(event) => updateLine(setLines, line.key, { quantityText: event.target.value })}
                  onBlur={() => blurQuantity(setLines, line)}
                />
              </label>
              {mode === 'ingreso' ? (
                <label>
                  {scanMessages.unitCost}
                  <input
                    value={line.unitCostText}
                    inputMode="decimal"
                    onKeyDown={keepQuantity}
                    onChange={(event) => updateLine(setLines, line.key, { unitCostText: event.target.value })}
                    onBlur={() => blurCost(setLines, line)}
                  />
                </label>
              ) : (
                <span>{formatMoney(line.salePrice ?? 0)}</span>
              )}
              <button type="button" className="ghost-button" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>
                {scanMessages.remove}
              </button>
            </li>
          ))}
        </ul>
        <p className="scan-total">
          <span>{mode === 'salida' ? scanMessages.charge : scanMessages.costTotal}</span>
          <strong>{totalReady ? formatMoney(total) : '—'}</strong>
        </p>
        <button type="button" className="primary-button" onClick={() => { void onConfirm() }}>
          {mode === 'ingreso' ? scanMessages.confirmIn : scanMessages.confirmOut}
        </button>
        {posted.map((note) => <p key={note}>{note}</p>)}
        {notice ? <p role="status">{notice}</p> : null}
      </Panel>
    </div>
  )
}

function switchMode(setMode: (mode: ScanMode) => void, setLines: (lines: DraftLine[]) => void, mode: ScanMode): void {
  setMode(mode)
  setLines([])
}

function updateLine(setLines: (update: (lines: DraftLine[]) => DraftLine[]) => void, key: string, patch: Partial<DraftLine>): void {
  setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line))
}

function blurQuantity(setLines: (update: (lines: DraftLine[]) => DraftLine[]) => void, line: DraftLine): void {
  const parsed = parseQuantity(line.quantityText)
  if (parsed === null) {
    return
  }
  updateLine(setLines, line.key, { quantityText: formatQuantity(parsed) })
}

function blurCost(setLines: (update: (lines: DraftLine[]) => DraftLine[]) => void, line: DraftLine): void {
  const parsed = parseMoney(line.unitCostText)
  if (parsed === null) {
    return
  }
  updateLine(setLines, line.key, { unitCostText: formatMoney(parsed) })
}

function toPriced(line: DraftLine): PricedLine[] {
  const parsed = parseQuantity(line.quantityText)
  if (parsed === null) {
    return []
  }
  const unitCost = line.unitCostText.trim() === '' ? null : parseMoney(line.unitCostText)
  if (line.unitCostText.trim() !== '' && unitCost === null) {
    return []
  }
  return [{
    productId: line.productId,
    factor: line.factor,
    quantity: parsed,
    unitCost,
    salePrice: line.salePrice,
    onHand: line.onHand,
  }]
}

function noticeFor(message: string): string {
  if (message === 'Insufficient stock') {
    return scanMessages.negative
  }
  if (message === 'Chart is not seeded') {
    return scanMessages.chart
  }
  if (message === 'Company was not found') {
    return scanMessages.company
  }
  return scanMessages.failed
}

function postedNotes(journal: readonly PostedLine[]): string[] {
  const codes = new Set(journal.map((line) => line.accountCode))
  const notes: string[] = []
  if (codes.has('4.01.01.001')) {
    notes.push(scanMessages.salesEntry)
  }
  if (codes.has('5.01.01.001')) {
    notes.push(scanMessages.costEntry)
  }
  if (codes.has('1.01.02.001') && !codes.has('4.01.01.001')) {
    notes.push(scanMessages.receiptEntry)
  }
  return notes
}
