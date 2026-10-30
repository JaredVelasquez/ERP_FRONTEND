import { useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/app/providers/session'
import { useFieldSet } from '@/shared/hooks/use-field-set'
import { Button } from '@/shared/ui/button'
import { TextField } from '@/shared/ui/fields'
import { Form, FormActions, FormDialog, FormNotice, FormSection } from '@/shared/ui/form-layout'
import { PageIntro } from '@/shared/ui/ops'
import { ServerTable } from '@/shared/ui/server-table'
import { createBarcodeSheet, createCatalogProduct, listCatalog } from '../api'
import { productMessages } from '../messages'

const productColumns = [
  { key: 'name', label: 'Nombre' },
  { key: 'itemType', label: 'Tipo' },
  { key: 'category', label: 'Categoría' },
  { key: 'supplier', label: 'Proveedor' },
  { key: 'presentation', label: 'Presentación' },
  { key: 'factor', label: 'Factor' },
  { key: 'barcode', label: 'Código' },
  { key: 'salePrice', label: 'Precio' },
  { key: 'actions', label: 'Acciones' },
] as const

export function ProductsPage() {
  const { companyId } = useSession()
  const queryClient = useQueryClient()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reveal, setReveal] = useState(0)
  const [formKey, setFormKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [barcodeBusy, setBarcodeBusy] = useState(false)
  const [itemType, setItemType] = useState<'product' | 'service'>('product')
  const { report, ready } = useFieldSet(['name', 'factor'])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setReveal((current) => current + 1)
    if (!ready || companyId === null) {
      return
    }
    const data = new FormData(event.currentTarget)
    const priceText = String(data.get('salePrice') ?? '').trim()
    const salePrice = priceText === '' ? null : Number(priceText.replace(',', '.'))
    const selectedItemType = data.get('itemType') === 'service' ? 'service' : 'product'
    if (selectedItemType === 'service' && salePrice === null) {
      setNotice('Un servicio necesita un precio de venta vigente para agregarse a documentos.')
      return
    }
    if (salePrice !== null && (!Number.isFinite(salePrice) || salePrice <= 0)) {
      setNotice(productMessages.initialPriceInvalid)
      return
    }
    setBusy(true)
    try {
      await createCatalogProduct({
        companyId,
        name: String(data.get('name') ?? ''),
        itemType: selectedItemType,
        unit: String(data.get('presentation') ?? ''),
        factor: Number(String(data.get('factor') ?? '').replace(',', '.')),
        salePrice,
        costingMethod: parseCostingMethod(String(data.get('costingMethod') ?? '')),
      })
      await queryClient.invalidateQueries({ queryKey: ['products', companyId] })
      setNotice(priceText === '' ? 'Producto guardado sin precio. Propón uno en Precios para habilitar su venta.' : productMessages.saved)
      setFormKey((current) => current + 1)
      setReveal(0)
      dialogRef.current?.close()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : productMessages.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  async function downloadSelectedBarcodes() {
    if (companyId === null || companyId === '' || selectedProducts.length === 0 || barcodeBusy) return
    setBarcodeBusy(true)
    setNotice(null)
    try {
      const pdf = await createBarcodeSheet(companyId, selectedProducts)
      const url = URL.createObjectURL(pdf)
      const download = document.createElement('a')
      download.href = url
      download.download = 'hoja-de-codigos.pdf'
      download.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
      setNotice(productMessages.barcodeSheetReady)
    } catch {
      setNotice(productMessages.barcodeSheetFailed)
    } finally {
      setBarcodeBusy(false)
    }
  }

  return (
    <div className="ops-page products-page">
      <PageIntro
        title={productMessages.title}
        description={productMessages.description}
        action={
          <Button type="button" onClick={() => dialogRef.current?.showModal()}>
            {productMessages.newProduct}
          </Button>
        }
      />
      {notice ? <FormNotice>{notice}</FormNotice> : null}
      <ServerTable
        tableKey="products"
        companyId={companyId}
        columns={productColumns}
        queryKey="products"
        empty={productMessages.empty}
        searchHint={productMessages.searchHint}
        remoteSort
        headerActions={selectedProducts.length > 0 ? <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--text-muted)]">{productMessages.selectedBarcodeCount(selectedProducts.length)}</span>
          <Button type="button" variant="quiet" onClick={() => setSelectedProducts([])}>{productMessages.clearBarcodeSelection}</Button>
          <Button type="button" onClick={() => void downloadSelectedBarcodes()} disabled={barcodeBusy}>
            {barcodeBusy ? 'Generando…' : productMessages.downloadBarcodeSheet}
          </Button>
        </div> : null}
        rowActions={(id) => [{
          label: selectedProducts.includes(id) ? productMessages.removeFromBarcodeSheet : productMessages.addToBarcodeSheet,
          onSelect: () => setSelectedProducts((current) => current.includes(id)
            ? current.filter((selectedId) => selectedId !== id)
            : [...current, id]),
        }]}
        load={async (query) => {
          const page = await listCatalog(companyId ?? '', {
            page: query.page,
            pageSize: query.pageSize,
            search: query.search,
            sort: sortParam(query.sort),
            itemType: 'all',
          })
          return {
            ...page,
            items: page.items.map((row) => ({
              id: row.id,
              cells: {
                name: row.name,
                itemType: row.itemType === 'service' ? 'Servicio' : 'Producto',
                category: row.category,
                supplier: row.supplier,
                presentation: row.presentation,
                factor: row.factor,
                barcode: row.barcode,
                salePrice: row.salePrice,
              },
            })),
          }
        }}
      />
      <FormDialog dialogRef={dialogRef} title={productMessages.newProduct} titleId="new-product-title">
        <Form key={formKey} onSubmit={onSubmit}>
          <FormSection title="Datos del artículo">
            <label className="field" htmlFor="product-item-type">
              <span>Tipo de artículo</span>
              <select id="product-item-type" name="itemType" value={itemType} onChange={(event) => setItemType(event.target.value === 'service' ? 'service' : 'product')}>
                <option value="product">Producto con inventario</option>
                <option value="service">Servicio sin inventario</option>
              </select>
              <small className="field-hint">Los servicios no aceptan movimientos de bodega.</small>
            </label>
            <TextField
              id="product-name"
              name="name"
              label={productMessages.name}
              wide
              required
              requiredMessage={productMessages.nameRequired}
              field="name"
              report={report}
              reveal={reveal}
            />
            <TextField
              id="product-presentation"
              name="presentation"
              label={itemType === 'service' ? 'Unidad del servicio' : productMessages.presentation}
              hint={itemType === 'service' ? 'Por ejemplo: hora, visita o servicio' : productMessages.presentationHint}
            />
            <TextField
              id="product-factor"
              name="factor"
              label={productMessages.factor}
              hint={productMessages.factorHint}
              inputMode="decimal"
              defaultValue="1"
              required
              field="factor"
              report={report}
              reveal={reveal}
              validate={factorIssue}
            />
            {itemType === 'service' ? <TextField id="product-sale-price" name="salePrice" label="Precio de venta" inputMode="decimal" required validate={priceIssue} /> : <TextField
              id="product-sale-price"
              name="salePrice"
              label={productMessages.initialPrice}
              hint={productMessages.initialPriceHint}
              inputMode="decimal"
              reveal={reveal}
              validate={priceIssue}
            />}
            {itemType === 'product' ? <label className="field" htmlFor="product-costing-method">
              <span>Método de salida</span>
              <select id="product-costing-method" name="costingMethod" defaultValue="">
                <option value="">Usar el método predeterminado de la empresa</option>
                <option value="PEPS">PEPS · primero en entrar, primero en salir</option>
                <option value="UEPS">UEPS · último en entrar, primero en salir</option>
                <option value="FEFO">FEFO · vence primero, primero en salir</option>
                <option value="AVERAGE">Costo promedio</option>
                <option value="SPECIFIC">Identificación específica de lote</option>
              </select>
              <small className="field-hint">El método de empresa actual se usa mientras este producto no tenga una excepción.</small>
            </label> : null}
          </FormSection>
          <FormSection title="Código" hint={productMessages.barcodeNote} />
          <FormActions>
            <Button type="button" variant="quiet" onClick={() => dialogRef.current?.close()}>
              {productMessages.close}
            </Button>
            <Button type="submit" disabled={!ready || busy}>
              {productMessages.save}
            </Button>
          </FormActions>
          {notice ? <FormNotice>{notice}</FormNotice> : null}
        </Form>
      </FormDialog>
    </div>
  )
}

function sortParam(sort: { column: string; direction: 'asc' | 'desc' } | null): string {
  if (sort === null) {
    return ''
  }
  return `${sort.column}:${sort.direction}`
}

function parseCostingMethod(value: string): 'PEPS' | 'UEPS' | 'FEFO' | 'AVERAGE' | 'SPECIFIC' | null {
  if (value === 'PEPS' || value === 'UEPS' || value === 'FEFO' || value === 'AVERAGE' || value === 'SPECIFIC') return value
  return null
}

function factorIssue(value: string): string | null {
  if (value.trim() === '') {
    return null
  }
  const parsed = Number(value.replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return productMessages.factorInvalid
  }
  return null
}

function priceIssue(value: string): string | null {
  if (value.trim() === '') return null
  const parsed = Number(value.replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return productMessages.initialPriceInvalid
  }
  return null
}
