import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/app/providers/session'
import { Button } from '@/shared/ui/button'
import { Panel } from '@/shared/ui/ops'
import { ItemPickerResults } from '@/shared/ui/item-picker-results'
import { listWarehouses, readStockCardForTransfer, searchProductsByName, transferStock, type ProductSearchHit, type TransferStockCard } from '../api'

export function WarehouseTransferPanel() {
  const { companyId, grants } = useSession()
  const client = useQueryClient()
  const canEdit = grants?.some((grant) => grant.module === 'inventory' && grant.access === 'edit') ?? false
  const warehouses = useQuery({ queryKey: ['transfer-warehouses', companyId], queryFn: listWarehouses, enabled: Boolean(companyId) })
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ProductSearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [card, setCard] = useState<TransferStockCard | null>(null)
  const [unit, setUnit] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [notice, setNotice] = useState('')

  const transfer = useMutation({
    mutationFn: () => transferStock({ companyId: companyId ?? '', productId: card?.productId ?? '', unit, quantity, originWarehouseId: origin, destinationWarehouseId: destination }),
    onSuccess: async (result) => {
      if ('error' in result) { setNotice(result.error); return }
      setNotice('Traslado confirmado.')
      setCard(null)
      setQuery('')
      setHits([])
      await client.invalidateQueries({ queryKey: ['inventory-documents'] })
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : 'No se pudo completar el traslado.'),
  })

  const active = (warehouses.data ?? []).filter((item) => item.active)
  const originCode = active.find((item) => item.id === origin)?.code
  const destinationOptions = active.filter((item) => item.id !== origin)

  async function search() {
    if (!companyId || query.trim() === '') return
    setSearching(true)
    setNotice('')
    try {
      setHits(await searchProductsByName(companyId, query))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo buscar.')
    } finally {
      setSearching(false)
    }
  }

  async function pick(productId: string) {
    const hit = hits.find((item) => item.productId === productId)
    if (!hit || !companyId || origin === '') return
    const found = await readStockCardForTransfer(companyId, hit.barcode, origin)
    if (!found) { setNotice('No se encontró el producto en esa bodega.'); return }
    setCard(found)
    setUnit(found.presentations[0]?.unit ?? '')
    setQuantity(1)
    setHits([])
    setQuery('')
  }

  function submit() {
    if (!card || unit === '' || quantity <= 0 || origin === '' || destination === '') return
    transfer.mutate()
  }

  if (active.length < 2) {
    return <Panel title="Traslado entre bodegas"><p className="muted">Necesitas al menos dos bodegas activas para trasladar inventario entre ellas. Agrega una en Configuración → Fiscal, contabilidad e inventario.</p></Panel>
  }

  return <Panel title="Traslado entre bodegas">
    <p className="muted">Mueve existencias de una bodega a otra sin afectar la venta ni el costo de la mercancía; el asiento queda separado por bodega de origen y destino.</p>
    {notice ? <p className="form-notice" role="status">{notice}</p> : null}
    <div className="control-grid control-grid--three">
      <label className="field">Bodega de origen<select value={origin} onChange={(event) => { setOrigin(event.target.value); setCard(null) }}>
        <option value="">Seleccionar</option>{active.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
      </select></label>
      <label className="field">Bodega de destino<select value={destination} onChange={(event) => setDestination(event.target.value)} disabled={origin === ''}>
        <option value="">Seleccionar</option>{destinationOptions.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
      </select></label>
    </div>
    {origin === '' ? <p className="muted">Elige primero la bodega de origen para buscar un producto.</p> : <>
      <form className="control-inline" onSubmit={(event) => { event.preventDefault(); void search() }}>
        <label className="field control-span-two">Buscar producto<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, proveedor o código" /></label>
        <Button type="submit" disabled={searching || query.trim() === ''}>{searching ? 'Buscando…' : 'Buscar'}</Button>
      </form>
      {hits.length > 0 ? <ItemPickerResults options={hits.map((hit) => ({ id: hit.productId, name: hit.name, details: hit.barcode }))} onSelect={(id) => void pick(id)} /> : null}
    </>}
    {card ? <div className="control-section" style={{ marginTop: '1rem' }}>
      <p><strong>{card.name}</strong> · disponible en {originCode ?? 'origen'}: <strong>{card.onHand}</strong></p>
      <div className="control-grid control-grid--three">
        <label className="field">Presentación<select value={unit} onChange={(event) => setUnit(event.target.value)}>
          {card.presentations.map((presentation) => <option key={presentation.unit} value={presentation.unit}>{presentation.unit} (×{presentation.factor})</option>)}
        </select></label>
        <label className="field">Cantidad<input type="number" min={0.0001} step="any" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
      </div>
      <div className="control-actions">
        <Button type="button" disabled={!canEdit || transfer.isPending || destination === ''} onClick={submit}>{transfer.isPending ? 'Trasladando…' : 'Confirmar traslado'}</Button>
        <Button type="button" variant="quiet" onClick={() => setCard(null)}>Cancelar</Button>
      </div>
    </div> : null}
  </Panel>
}
