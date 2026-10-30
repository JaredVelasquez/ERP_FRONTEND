import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
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
  receiptTotal,
  saleExceedsStock,
  saleTotal,
  type CardPresentation,
  type PricedLine,
} from '../domain/scan-ticket'
import { scanMessages } from '../messages'
import { IconAction } from '@/shared/ui/icon-action'
import { ItemPickerResults } from '@/shared/ui/item-picker-results'
import { readWarehouses } from '@/modules/settings/api'

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

const legacyCashMethod = { id: 'legacy-cash', name: 'Efectivo', collectionAccountCode: '1.01.01.001', paymentAccountCode: '1.01.01.001', active: true } as const

export function ScanPage({ embedded = false, initialMode = 'salida', paymentMethods, onMovementPosted }: { embedded?: boolean; initialMode?: ScanMode; paymentMethods?: readonly { id: string; name: string; collectionAccountCode: string | null; paymentAccountCode: string | null; active: boolean }[]; onMovementPosted?: (document: { id: string; type: string }, prepareInvoice: boolean) => void }) {
  const { companyId } = useSession()
  const codeRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<ScanMode>(initialMode)
  const [code, setCode] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [posted, setPosted] = useState<string[]>([])
  const [choices, setChoices] = useState<ProductSearchHit[]>([])
  const [presentationChoice, setPresentationChoice] = useState<{ card: StockCard; code: string } | null>(null)
  const [posting, setPosting] = useState(false)
  const [looking, setLooking] = useState(false)
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('')
  const [saleCompletion, setSaleCompletion] = useState<'sale-only' | 'invoice'>('sale-only')
  const [warehouses, setWarehouses] = useState<Awaited<ReturnType<typeof readWarehouses>>>([])
  useEffect(() => { if (!companyId) return; void readWarehouses().then(setWarehouses).catch(() => setWarehouses([])) }, [companyId])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('')
  const availableWarehouses = warehouses.filter((warehouse) => warehouse.active)
  const activeWarehouseId = availableWarehouses.some((warehouse) => warehouse.id === selectedWarehouseId)
    ? selectedWarehouseId
    : availableWarehouses.find((warehouse) => warehouse.isDefault)?.id ?? availableWarehouses[0]?.id
  const effectivePaymentMethods = paymentMethods ?? [legacyCashMethod]
  const availablePaymentMethods = effectivePaymentMethods.filter((method) => method.active && (mode === 'salida' ? method.collectionAccountCode !== null : method.paymentAccountCode !== null))
  const selectedPaymentMethod = availablePaymentMethods.find((method) => method.id === selectedPaymentMethodId) ?? availablePaymentMethods[0] ?? null
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
      card = await lookupCode(activeCompanyId, nextCode, activeWarehouseId)
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
    const eligible = eligiblePresentations(card, mode)
    if (eligible.length === 0) {
      setNotice(mode === 'salida' ? scanMessages.noPrice : scanMessages.notPurchasable)
      return
    }
    const eligibleCard = { ...card, presentations: eligible }
    const resolved = eligible.find((presentation) => presentation.unit === card.resolvedUnit)
    if (resolved !== undefined) {
      addSelected(eligibleCard, nextCode, resolved)
      return
    }
    if (eligible.length > 1) {
      setPresentationChoice({ card: eligibleCard, code: nextCode })
      setNotice(scanMessages.choosePresentation)
      return
    }
    const selected = eligible[0]
    if (selected === undefined) {
      return
    }
    addSelected(eligibleCard, nextCode, selected)
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
    if (selectedPaymentMethod === null) {
      setNotice('Configura un método de pago para este tipo de movimiento.')
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
      warehouseId: activeWarehouseId,
      type: mode === 'ingreso' ? 'purchase' : 'sale',
        collectionAccountCode: mode === 'salida' ? selectedPaymentMethod.collectionAccountCode : null,
        paymentAccountCode: mode === 'ingreso' ? selectedPaymentMethod.paymentAccountCode : null,
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
      onMovementPosted?.({ id: result.id ?? '', type: result.type ?? (mode === 'salida' ? 'sale' : 'purchase') }, mode === 'salida' && saleCompletion === 'invoice')
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
    <div className={embedded ? 'scan-page scan-page--embedded' : 'ops-page scan-page'}>
      {embedded ? null : <PageIntro title={scanMessages.title} description={scanMessages.description} />}
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
          <IconAction type="submit" icon={looking ? 'refresh' : 'search'} label={looking ? 'Buscando productos' : scanMessages.add} variant="primary" disabled={looking} />
        </form>
        {looking ? <ListSkeleton rows={3} label="Buscando coincidencias de producto…" /> : null}
        {choices.length > 0 ? <ItemPickerResults options={choices.map((choice) => ({ id: choice.barcode, name: choice.name, details: `${choice.supplier ? `Proveedor: ${choice.supplier}` : 'Proveedor: sin asignar'} · Código: ${choice.barcode}` }))} onSelect={(barcode) => { void pick(barcode) }} /> : null}
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
        {mode === 'salida' ? <fieldset className="scan-sale-completion"><legend>Al confirmar la venta</legend><label><input type="radio" name="saleCompletion" checked={saleCompletion === 'sale-only'} onChange={() => setSaleCompletion('sale-only')} /> Guardar sin factura</label><label><input type="radio" name="saleCompletion" checked={saleCompletion === 'invoice'} onChange={() => setSaleCompletion('invoice')} /> Preparar factura ahora</label></fieldset> : null}
        <label className="field scan-payment-method">Bodega
          <select value={activeWarehouseId ?? ''} onChange={(event) => setSelectedWarehouseId(event.target.value)} disabled={availableWarehouses.length < 2}>
            {availableWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} · {warehouse.name}</option>)}
          </select>
        </label>
        <label className="field scan-payment-method">{mode === 'salida' ? 'Método de cobro' : 'Método de pago de la compra'}
          <select value={selectedPaymentMethod?.id ?? ''} onChange={(event) => setSelectedPaymentMethodId(event.target.value)} disabled={availablePaymentMethods.length === 0}>
            {availablePaymentMethods.length === 0 ? <option value="">Configura un método de pago</option> : null}
            {availablePaymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
          </select>
        </label>
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
              <IconAction icon="remove" label={`${scanMessages.remove} ${line.name}`} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} />
            </li>
          ))}
        </ul>
        <div className="scan-ticket-footer">
          <p className="scan-total">
            <span>{mode === 'salida' ? scanMessages.charge : scanMessages.costTotal}</span>
            <strong>{totalReady ? formatMoney(total) : '—'}</strong>
          </p>
          <IconAction icon="confirm" label={posting ? 'Registrando movimiento' : mode === 'ingreso' ? scanMessages.confirmIn : scanMessages.confirmOut} variant="primary" disabled={lines.length === 0 || !totalReady || posting} onClick={() => { void onConfirm() }} />
        </div>
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

function eligiblePresentations(card: StockCard, mode: ScanMode): CardPresentation[] {
  return card.presentations.filter((presentation) => {
    if (mode === 'ingreso') {
      return presentation.purchasable
    }
    return presentation.sellable && presentation.salePrice !== null && presentation.salePrice > 0
  })
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
