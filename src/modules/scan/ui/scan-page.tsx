import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useSession } from '@/app/providers/session'
import { PageIntro, Panel } from '@/shared/ui/ops'
import { ListSkeleton } from '@/shared/ui/skeleton'
import { confirmMovement, lookupCode, searchByName, seedChart, type PostedLine, type ProductSearchHit, type StockCard } from '../api'
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
  type CardPresentation,
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
  const [choices, setChoices] = useState<ProductSearchHit[]>([])
  const [presentationChoice, setPresentationChoice] = useState<{ card: StockCard; code: string } | null>(null)
  const [posting, setPosting] = useState(false)
  const [looking, setLooking] = useState(false)
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
    setPresentationChoice(null)
    setNotice(null)
    setLooking(true)
    try {
      await findProduct(companyId, nextCode)
    } finally {
      setLooking(false)
    }
  }

  async function findProduct(activeCompanyId: string, nextCode: string) {
    let card: StockCard | 'unknown' | 'failed'
    try {
      card = await lookupCode(activeCompanyId, nextCode)
    } catch {
      setNotice(scanMessages.lookupFailed)
      return
    }
    if (card === 'failed') {
      setNotice(scanMessages.lookupFailed)
      return
    }
    if (card !== 'unknown') {
      addFound(card, nextCode)
      return
    }
    let hits: ProductSearchHit[]
    try {
      hits = await searchByName(activeCompanyId, nextCode)
    } catch {
      setNotice(scanMessages.lookupFailed)
      return
    }
    if (hits.length === 0) {
      setNotice(scanMessages.unknown)
      return
    }
    setChoices(hits)
    setNotice(scanMessages.pick)
  }

  function addFound(card: StockCard, nextCode: string) {
    if (card.presentations.length > 1) {
      setPresentationChoice({ card, code: nextCode })
      setNotice(scanMessages.choosePresentation)
      return
    }
    addSelected(card, nextCode, pricedUnit(card))
  }

  function addSelected(card: StockCard, nextCode: string, presentation: CardPresentation) {
    if (mode === 'salida' && presentation.salePrice === null) {
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
        unit: presentation.unit,
        factor: presentation.factor,
        quantityText: '1.0000',
        unitCostText: '',
        salePrice: presentation.salePrice,
        onHand: card.baseQuantity,
      },
    ])
    setNotice(null)
    setCode('')
    setChoices([])
    setPresentationChoice(null)
    codeRef.current?.focus()
  }

  function selectPresentation(presentation: CardPresentation) {
    if (!presentationChoice) {
      return
    }
    addSelected(presentationChoice.card, presentationChoice.code, presentation)
  }

  async function pick(barcode: string) {
    if (companyId === null || companyId === '') {
      return
    }
    setLooking(true)
    try {
      const card = await lookupCode(companyId, barcode)
      if (card === 'unknown' || card === 'failed') {
        setNotice(scanMessages.unknown)
        return
      }
      addFound(card, barcode)
    } catch {
      setNotice(scanMessages.lookupFailed)
    } finally {
      setLooking(false)
    }
  }

  async function onConfirm() {
    if (companyId === null || companyId === '' || lines.length === 0 || posting) {
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
    setPosting(true)
    try {
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
        presentationUnit: line.unit,
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
    } catch {
      setNotice(scanMessages.failed)
    } finally {
      setPosting(false)
    }
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
        <button type="button" className={mode === 'salida' ? 'primary-button' : 'ghost-button'} aria-pressed={mode === 'salida'} onClick={() => switchMode(setMode, setLines, setPresentationChoice, 'salida')}>
          {scanMessages.salida}
        </button>
        <button type="button" className={mode === 'ingreso' ? 'primary-button' : 'ghost-button'} aria-pressed={mode === 'ingreso'} onClick={() => switchMode(setMode, setLines, setPresentationChoice, 'ingreso')}>
          {scanMessages.ingreso}
        </button>
      </div>
      <div className="scan-workspace">
      <Panel title="Buscar producto">
        <form className="toolbar" onSubmit={(event) => { void onScan(event) }}>
          <div className="field">
            <label htmlFor="scan-code">{scanMessages.code}</label>
            <input id="scan-code" ref={codeRef} value={code} autoComplete="off" autoFocus onChange={(event) => { setCode(event.target.value); setChoices([]); setPresentationChoice(null); setNotice(null) }} />
          </div>
          <button type="submit" className="primary-button" disabled={looking}>{looking ? 'Buscando…' : scanMessages.add}</button>
        </form>
        {looking ? <ListSkeleton rows={3} label="Buscando coincidencias de producto…" /> : null}
        {choices.length > 0 ? (
          <ul className="choice-list">
            {choices.map((choice) => (
              <li key={choice.barcode}>
                <button type="button" className="ghost-button" onClick={() => { void pick(choice.barcode) }}>
                  <strong>{choice.name}</strong>
                  <small>{choice.supplier ? `Proveedor: ${choice.supplier} · ` : 'Proveedor: sin asignar · '}Código: {choice.barcode}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {presentationChoice ? (
          <div className="scan-presentation-choice" role="group" aria-label={scanMessages.choosePresentation}>
            <p><strong>{presentationChoice.card.name}</strong> · {scanMessages.choosePresentation}</p>
            <div className="scan-presentation-options">
              {presentationChoice.card.presentations.map((presentation) => (
                <button
                  key={`${presentation.unit}-${presentation.factor}`}
                  type="button"
                  className="ghost-button"
                  disabled={mode === 'salida' && presentation.salePrice === null}
                  onClick={() => selectPresentation(presentation)}
                >
                  <strong>{presentation.unit}</strong>
                  <small>{formatQuantity(presentation.factor)} · {presentation.salePrice === null ? scanMessages.noPrice : formatMoney(presentation.salePrice)}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Panel>
      <Panel title={mode === 'salida' ? 'Venta actual' : 'Ingreso actual'}>
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
        <button type="button" className="primary-button" disabled={lines.length === 0 || !totalReady || posting} onClick={() => { void onConfirm() }}>
          {posting ? 'Registrando…' : mode === 'ingreso' ? scanMessages.confirmIn : scanMessages.confirmOut}
        </button>
        {posted.map((note) => <p key={note}>{note}</p>)}
        {notice ? <p role="status">{notice}</p> : null}
      </Panel>
      </div>
    </div>
  )
}

function switchMode(setMode: (mode: ScanMode) => void, setLines: (lines: DraftLine[]) => void, setPresentationChoice: (choice: { card: StockCard; code: string } | null) => void, mode: ScanMode): void {
  setMode(mode)
  setLines([])
  setPresentationChoice(null)
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
    unit: line.unit,
    factor: line.factor,
    quantity: parsed,
    unitCost,
    salePrice: line.salePrice,
    onHand: line.onHand,
  }]
}

function noticeFor(message: string): string {
  if (message === 'Sale price changed; refresh the ticket') {
    return scanMessages.priceChanged
  }
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
