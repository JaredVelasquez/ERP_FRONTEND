import { useRef, useState, type FormEvent } from 'react'
import { useSession } from '@/app/providers/session'
import { useFieldSet } from '@/shared/hooks/use-field-set'
import { Button } from '@/shared/ui/button'
import { DateField } from '@/shared/ui/date-field'
import { TextField } from '@/shared/ui/fields'
import { Form, FormActions, FormDialog, FormNotice, FormSection } from '@/shared/ui/form-layout'
import { DevNote, PageIntro } from '@/shared/ui/ops'
import { ServerTable } from '@/shared/ui/server-table'
import { listSalePrices } from '../api'
import { priceMessages } from '../messages'

const priceColumns = [
  { key: 'name', label: 'Producto' },
  { key: 'presentation', label: 'Presentación' },
  { key: 'salePrice', label: 'Precio de venta' },
  { key: 'cost', label: 'Margen' },
] as const

export function PricesPage() {
  const { companyId } = useSession()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reveal, setReveal] = useState(0)
  const [formKey, setFormKey] = useState(0)
  const { report, ready } = useFieldSet(['product', 'amount', 'since'])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setReveal((current) => current + 1)
    if (!ready) {
      return
    }
    setNotice(priceMessages.pending)
    setFormKey((current) => current + 1)
    setReveal(0)
    dialogRef.current?.close()
  }

  return (
    <div className="ops-page">
      <PageIntro
        title={priceMessages.title}
        description={priceMessages.description}
        action={
          <Button type="button" onClick={() => dialogRef.current?.showModal()}>
            {priceMessages.newPrice}
          </Button>
        }
      />
      <DevNote>{priceMessages.noMargin}</DevNote>
      {notice ? <FormNotice>{notice}</FormNotice> : null}
      <ServerTable
        tableKey="prices"
        companyId={companyId}
        columns={priceColumns}
        queryKey="prices"
        empty={priceMessages.empty}
        searchHint={priceMessages.searchHint}
        load={async (query) => {
          const page = await listSalePrices(companyId ?? '', {
            page: query.page,
            pageSize: query.pageSize,
            search: query.search,
          })
          return {
            ...page,
            items: page.items.map((row) => ({
              id: row.id,
              cells: { name: row.name, presentation: row.presentation, salePrice: row.salePrice, cost: row.cost },
            })),
          }
        }}
      />
      <FormDialog dialogRef={dialogRef} title={priceMessages.newPrice} titleId="new-price-title">
        <Form key={formKey} onSubmit={onSubmit}>
          <FormSection title="Precio de venta">
            <TextField
              id="price-product"
              name="product"
              label={priceMessages.product}
              required
              requiredMessage={priceMessages.productRequired}
              field="product"
              report={report}
              reveal={reveal}
            />
            <TextField
              id="price-amount"
              name="amount"
              label={priceMessages.amount}
              inputMode="decimal"
              required
              requiredMessage={priceMessages.amountRequired}
              field="amount"
              report={report}
              reveal={reveal}
              validate={amountIssue}
            />
          </FormSection>
          <FormSection title="Vigencia">
            <DateField
              id="price-since"
              name="since"
              label={priceMessages.since}
              hint={priceMessages.sinceHint}
              required
              requiredMessage={priceMessages.sinceRequired}
              field="since"
              report={report}
              reveal={reveal}
            />
          </FormSection>
          <FormActions>
            <Button type="button" variant="quiet" onClick={() => dialogRef.current?.close()}>
              {priceMessages.close}
            </Button>
            <Button type="submit" disabled={!ready}>
              {priceMessages.save}
            </Button>
          </FormActions>
        </Form>
      </FormDialog>
    </div>
  )
}

function amountIssue(value: string): string | null {
  if (value.trim() === '') {
    return null
  }
  const parsed = Number(value.replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return priceMessages.amountInvalid
  }
  return null
}
