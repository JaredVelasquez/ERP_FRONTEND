import { useRef, useState, type FormEvent } from 'react'
import { useSession } from '@/app/providers/session'
import { useFieldSet } from '@/shared/hooks/use-field-set'
import { Button } from '@/shared/ui/button'
import { TextField } from '@/shared/ui/fields'
import { Form, FormActions, FormDialog, FormNotice, FormSection } from '@/shared/ui/form-layout'
import { DevNote, PageIntro } from '@/shared/ui/ops'
import { ServerTable } from '@/shared/ui/server-table'
import { listCatalog } from '../api'
import { productMessages } from '../messages'

const productColumns = [
  { key: 'name', label: 'Nombre' },
  { key: 'category', label: 'Categoría' },
  { key: 'supplier', label: 'Proveedor' },
  { key: 'presentation', label: 'Presentación' },
  { key: 'factor', label: 'Factor' },
  { key: 'barcode', label: 'Código' },
  { key: 'salePrice', label: 'Precio' },
  { key: 'stock', label: 'Existencia' },
] as const

export function ProductsPage() {
  const { companyId } = useSession()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reveal, setReveal] = useState(0)
  const [formKey, setFormKey] = useState(0)
  const { report, ready } = useFieldSet(['name', 'factor'])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setReveal((current) => current + 1)
    if (!ready) {
      return
    }
    setNotice(productMessages.pending)
    setFormKey((current) => current + 1)
    setReveal(0)
    dialogRef.current?.close()
  }

  return (
    <div className="ops-page">
      <PageIntro
        title={productMessages.title}
        description={productMessages.description}
        action={
          <Button type="button" onClick={() => dialogRef.current?.showModal()}>
            {productMessages.newProduct}
          </Button>
        }
      />
      <DevNote>{productMessages.noStock}</DevNote>
      {notice ? <FormNotice>{notice}</FormNotice> : null}
      <ServerTable
        tableKey="products"
        companyId={companyId}
        columns={productColumns}
        queryKey="products"
        empty={productMessages.empty}
        searchHint={productMessages.searchHint}
        remoteSort
        load={async (query) => {
          const page = await listCatalog(companyId ?? '', {
            page: query.page,
            pageSize: query.pageSize,
            search: query.search,
            sort: sortParam(query.sort),
          })
          return {
            ...page,
            items: page.items.map((row) => ({
              id: row.id,
              cells: {
                name: row.name,
                category: row.category,
                supplier: row.supplier,
                presentation: row.presentation,
                factor: row.factor,
                barcode: row.barcode,
                salePrice: row.salePrice,
                stock: 'Sin saldo',
              },
            })),
          }
        }}
      />
      <FormDialog dialogRef={dialogRef} title={productMessages.newProduct} titleId="new-product-title">
        <Form key={formKey} onSubmit={onSubmit}>
          <FormSection title="Datos del producto">
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
              label={productMessages.presentation}
              hint={productMessages.presentationHint}
            />
            <TextField
              id="product-factor"
              name="factor"
              label={productMessages.factor}
              hint={productMessages.factorHint}
              inputMode="decimal"
              field="factor"
              report={report}
              reveal={reveal}
              validate={factorIssue}
            />
          </FormSection>
          <FormSection title="Código" hint={productMessages.barcodeNote} />
          <FormActions>
            <Button type="button" variant="quiet" onClick={() => dialogRef.current?.close()}>
              {productMessages.close}
            </Button>
            <Button type="submit" disabled={!ready}>
              {productMessages.save}
            </Button>
          </FormActions>
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
