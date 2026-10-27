import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { useSession } from '@/app/providers/session'
import { Button } from '@/shared/ui/button'
import { PageIntro } from '@/shared/ui/ops'
import { ServerTable } from '@/shared/ui/server-table'
import { ListSkeleton } from '@/shared/ui/skeleton'
import {
  listCommercialPriceHistory, listCommercialPrices,
  listPriceProposals, proposeSalePrice, readPriceSettings, resolveSalePriceProposal, setDirectSalePrice,
  type CommercialPriceRow, type PriceProposal,
} from '../api'
import { priceMessages as copy } from '../messages'

const money = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
const date = (value: string) => new Intl.DateTimeFormat('es-HN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export function PricesPage() {
  const { companyId } = useSession()
  const queryClient = useQueryClient()
  const proposalDialog = useRef<HTMLDialogElement>(null)
  const resolutionDialog = useRef<HTMLDialogElement>(null)
  const catalogRows = useRef(new Map<string, CommercialPriceRow>())
  const proposalRows = useRef(new Map<string, PriceProposal>())
  const [selected, setSelected] = useState<CommercialPriceRow | null>(null)
  const [resolving, setResolving] = useState<{ proposal: PriceProposal; decision: 'approve' | 'reject' } | null>(null)
  const [proposedAmount, setProposedAmount] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const enabled = companyId !== null && companyId !== ''
  const settings = useQuery({ queryKey: ['price-settings', companyId], queryFn: readPriceSettings, enabled })

  function openProposal(row: CommercialPriceRow) {
    setSelected(row)
    setProposedAmount(row.managementSalePrice === null ? '' : String(row.managementSalePrice))
    setNotice('')
    proposalDialog.current?.showModal()
  }

  async function onPropose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selected === null) return
    const form = new FormData(event.currentTarget)
    const proposedPrice = Number(proposedAmount.replace(',', '.'))
    const reason = String(form.get('reason') ?? '').trim()
    if (!Number.isFinite(proposedPrice) || proposedPrice < 0 || reason === '') {
      setNotice(copy.invalid)
      return
    }
    setBusy(true)
    try {
      if (settings.data?.canApprove) {
        await setDirectSalePrice({ productId: selected.productId, unit: selected.unit, price: proposedPrice, reason })
      } else {
        await proposeSalePrice({ productId: selected.productId, unit: selected.unit, proposedPrice, reason })
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['price-proposals', companyId] }),
        queryClient.invalidateQueries({ queryKey: ['commercial-prices', companyId] }),
        queryClient.invalidateQueries({ queryKey: ['commercial-price-history', companyId] }),
      ])
      proposalDialog.current?.close()
      setNotice(settings.data?.canApprove ? 'Precio actualizado en todas las unidades existentes de esta presentación.' : copy.saved)
    } catch (error) {
      setNotice(messageOf(error))
    } finally {
      setBusy(false)
    }
  }

  function openResolution(proposal: PriceProposal) {
    setResolving({ proposal, decision: 'approve' })
    setNotice('')
    resolutionDialog.current?.showModal()
  }

  async function onResolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (resolving === null) return
    const note = String(new FormData(event.currentTarget).get('note') ?? '').trim()
    if (resolving.decision === 'reject' && note === '') {
      setNotice(copy.rejectionHint)
      return
    }
    setBusy(true)
    try {
      await resolveSalePriceProposal(resolving.proposal.id, resolving.decision, note)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['price-proposals', companyId] }),
        queryClient.invalidateQueries({ queryKey: ['commercial-prices', companyId] }),
        queryClient.invalidateQueries({ queryKey: ['commercial-price-history', companyId] }),
      ])
      resolutionDialog.current?.close()
      setNotice(copy.resolved)
    } catch (error) {
      setNotice(messageOf(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ops-page prices-page">
      <PageIntro title={copy.title} description={copy.description} />
      {notice ? <p className="dev-note" role="status">{notice}</p> : null}
      {settings.isPending ? <ListSkeleton rows={1} label="Comprobando permisos de precios…" /> : null}
      {settings.isError ? <div className="table-load-error" role="alert"><p>No se pudieron verificar tus permisos para cambiar precios.</p><button type="button" className="ghost-button" onClick={() => void settings.refetch()}>Reintentar</button></div> : null}
      <ServerTable tableKey="commercial-prices" companyId={companyId} queryKey="commercial-prices"
        columns={[{ key: 'product', label: 'Producto' }, { key: 'unit', label: 'Presentación' },
          { key: 'cost', label: 'Costo unitario' }, { key: 'markup', label: 'Recargo mínimo' },
          { key: 'suggested', label: 'Precio sugerido' }, { key: 'management', label: 'Precio de gerencia' },
          { key: 'actions', label: 'Acción' }]}
        empty={copy.empty} searchHint={copy.search} rowActionLabel={settings.data?.canApprove ? 'Cambiar precio' : copy.propose}
        load={async ({ page, pageSize, search }) => {
          const result = await listCommercialPrices({ page, pageSize, search })
          catalogRows.current = new Map(result.items.map((row) => [row.presentationId, row]))
          return { ...result, items: result.items.map((row) => ({ id: row.presentationId, cells: {
            product: row.name, unit: `${row.unit} · ${row.barcode}`, cost: money(row.referenceUnitCost),
            markup: row.minimumMarkupPercent === null ? '—' : `${row.minimumMarkupPercent}%`,
            suggested: money(row.suggestedSalePrice), management: money(row.managementSalePrice), actions: '',
          } })) }
        }} onRowAction={(id) => { const row = catalogRows.current.get(id); if (row) openProposal(row) }} />

      <h2 className="section-heading">{copy.pendingTitle}</h2>
      <ServerTable tableKey="price-proposals" companyId={companyId} queryKey="price-proposals"
        searchable={false} unknownTotal empty={copy.noPending} rowActionLabel="Resolver"
        columns={[{ key: 'product', label: 'Producto' }, { key: 'unit', label: 'Presentación' },
          { key: 'previous', label: 'Precio anterior' }, { key: 'proposed', label: 'Precio propuesto' },
          { key: 'proposer', label: 'Propuesto por' }, { key: 'date', label: 'Fecha' },
          ...(settings.data?.canApprove ? [{ key: 'actions', label: 'Acción' }] : [])]}
        load={async ({ page, pageSize }) => {
          const result = await listPriceProposals(page, pageSize)
          proposalRows.current = new Map(result.items.map((row) => [row.id, row]))
          return { page, pageSize, total: (page - 1) * pageSize + result.items.length, hasMore: result.hasMore,
            items: result.items.map((row) => ({ id: row.id, cells: {
              product: row.productName, unit: `${row.unit} · ${row.reason}`, previous: money(row.previousPrice),
              proposed: money(row.proposedPrice), proposer: row.proposerName, date: date(row.proposedAt), actions: '',
            } })) }
        }} onRowAction={settings.data?.canApprove ? (id) => { const row = proposalRows.current.get(id); if (row) openResolution(row) } : undefined} />

      <h2 className="section-heading">{copy.historyTitle}</h2>
      <ServerTable tableKey="commercial-price-history" companyId={companyId} queryKey="commercial-price-history"
        searchable={false} unknownTotal empty={copy.historyEmpty}
        columns={[{ key: 'product', label: 'Producto' }, { key: 'unit', label: 'Presentación' },
          { key: 'cost', label: 'Costo anterior → nuevo' }, { key: 'price', label: 'Precio anterior → nuevo' },
          { key: 'source', label: 'Origen' }, { key: 'actor', label: 'Registrado por' }, { key: 'date', label: 'Fecha' }]}
        load={async ({ page, pageSize }) => {
          const result = await listCommercialPriceHistory(page, pageSize)
          return { page, pageSize, total: (page - 1) * pageSize + result.items.length, hasMore: result.hasMore,
            items: result.items.map((row) => ({ id: row.id, cells: {
              product: row.productName, unit: row.unit, cost: `${money(row.previousUnitCost)} → ${money(row.nextUnitCost)}`,
              price: `${money(row.previousManagementSalePrice)} → ${money(row.nextManagementSalePrice)}`,
              source: row.source === 'michelle-price-workbook' ? `${copy.sourceWorkbook} · ${row.sourceRow}` : row.source === 'direct-management' ? 'Cambio de gerencia' : copy.sourceApproval,
              actor: row.actorName, date: date(row.changedAt),
            } })) }
        }} />

      <dialog ref={proposalDialog} className="dialog price-dialog" aria-labelledby="price-proposal-title">
        <form onSubmit={(event) => { void onPropose(event) }}>
          <h2 id="price-proposal-title">{settings.data?.canApprove ? 'Cambiar precio de venta' : copy.proposalTitle}</h2>
          <p>{selected?.name} · {selected?.unit}</p>
          <p className="price-help">{copy.previous}: {money(selected?.managementSalePrice ?? null)} · {copy.columns[3]}: {money(selected?.suggestedSalePrice ?? null)}</p>
          <label className="field" htmlFor="proposed-price"><span>{copy.proposedPrice}</span><input id="proposed-price" name="proposedPrice" inputMode="decimal" value={proposedAmount} onChange={(event) => setProposedAmount(event.target.value)} required /></label>
          {selected?.suggestedSalePrice !== null && Number(proposedAmount.replace(',', '.')) < (selected?.suggestedSalePrice ?? 0) ? <p className="price-warning">{copy.belowSuggested}</p> : null}
          <label className="field" htmlFor="proposal-reason"><span>{copy.reason}</span><textarea id="proposal-reason" name="reason" rows={3} required placeholder={copy.reasonHint} /></label>
          <div className="dialog-actions"><Button variant="quiet" onClick={() => proposalDialog.current?.close()}>{copy.cancel}</Button><Button type="submit" disabled={busy}>{settings.data?.canApprove ? 'Aplicar cambio' : copy.send}</Button></div>
        </form>
      </dialog>

      <dialog ref={resolutionDialog} className="dialog price-dialog" aria-labelledby="price-resolution-title">
        <form onSubmit={(event) => { void onResolve(event) }}>
          <h2 id="price-resolution-title">{copy.resolutionTitle}</h2>
          <p>{resolving?.proposal.productName}: {money(resolving?.proposal.previousPrice ?? null)} → {money(resolving?.proposal.proposedPrice ?? null)}</p>
          <label className="field" htmlFor="resolution-decision"><span>Decisión</span><select id="resolution-decision" value={resolving?.decision ?? 'approve'} onChange={(event) => setResolving((current) => current ? { ...current, decision: event.target.value as 'approve' | 'reject' } : null)}><option value="approve">Aprobar</option><option value="reject">Rechazar</option></select></label>
          <label className="field" htmlFor="resolution-note"><span>{copy.resolutionNote}</span><textarea id="resolution-note" name="note" rows={3} required={resolving?.decision === 'reject'} placeholder={resolving?.decision === 'reject' ? copy.rejectionHint : ''} /></label>
          <div className="dialog-actions"><Button variant="quiet" onClick={() => resolutionDialog.current?.close()}>{copy.cancel}</Button><Button type="submit" disabled={busy}>{resolving?.decision === 'approve' ? copy.approve : copy.reject}</Button></div>
        </form>
      </dialog>
    </div>
  )
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : copy.loadError
}
