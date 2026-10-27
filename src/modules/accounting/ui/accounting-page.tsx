import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSession } from '@/app/providers/session'
import { useFieldSet } from '@/shared/hooks/use-field-set'
import { Button } from '@/shared/ui/button'
import { CheckField, TextField } from '@/shared/ui/fields'
import { Form, FormActions, FormDialog } from '@/shared/ui/form-layout'
import { PageIntro } from '@/shared/ui/ops'
import { accountLevel, type AccountNode } from '../account'
import { updateAccount } from '../api'
import { useAccountTree } from '../hooks/use-account-tree'
import { accountingMessages } from '../messages'
import { AccountTree } from './account-tree'
import { ListSkeleton } from '@/shared/ui/skeleton'

export function AccountingPage() {
  const { companyId } = useSession()
  const chart = useAccountTree(companyId)
  const queryClient = useQueryClient()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [editing, setEditing] = useState<AccountNode | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reveal, setReveal] = useState(0)
  const { report, ready } = useFieldSet(['name'])
  const nodes = chart.data ?? []
  const save = useMutation({
    mutationFn: (input: { code: string; name: string; collection: boolean }) =>
      updateAccount(companyId ?? '', input.code, input.name, input.collection),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['accounting', 'chart', companyId] })
      setNotice(accountingMessages.saved)
      setEditing(null)
    },
    onError: () => setNotice(accountingMessages.editFailed),
  })

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) {
      return
    }
    if (editing === null) {
      dialog.close()
      return
    }
    if (!dialog.open) {
      dialog.showModal()
    }
  }, [editing])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setReveal((current) => current + 1)
    if (!ready || editing === null || companyId === null || companyId === '') {
      return
    }
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') ?? '')
    const collection = accountLevel(editing.code) === 'subaccount' && data.get('collection') === 'on'
    save.mutate({ code: editing.code, name, collection })
  }

  return (
    <div className="ops-page accounting-page">
      <PageIntro title={accountingMessages.title} description={accountingMessages.description} />
      {chart.isFetching && chart.data ? <p className="table-refresh-status" role="status">Actualizando catálogo de cuentas…</p> : null}
      {chart.isError ? <div className="table-load-error" role="alert"><p>{accountingMessages.unavailable}</p><Button type="button" variant="quiet" onClick={() => void chart.refetch()}>{accountingMessages.retry}</Button></div> : null}
      {notice ? <p role="status">{notice}</p> : null}
      <section className="accounting-chart" aria-label={accountingMessages.chart}>
        <div className="accounting-chart-head"><div><h2>{accountingMessages.chart}</h2><p>{accountingMessages.fromSession}</p></div><span className="accounting-chart-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3.5" y="4" width="25" height="24" rx="5" /><path d="M9 11h14M9 16h9M9 21h14" /></svg></span></div>
        {chart.isPending ? <ListSkeleton rows={6} label="Cargando catálogo de cuentas…" /> : null}
        {!chart.isPending && !chart.isError ? <AccountTree nodes={nodes} onEdit={setEditing} /> : null}
      </section>
      <FormDialog
        dialogRef={dialogRef}
        title={editing?.code ?? accountingMessages.edit}
        titleId="edit-account-title"
        onClose={() => setEditing(null)}
      >
        {editing === null ? null : (
          <Form key={editing.code} onSubmit={onSubmit}>
            <TextField
              id="account-name"
              name="name"
              label={accountingMessages.name}
              defaultValue={editing.name}
              required
              requiredMessage={accountingMessages.nameRequired}
              field="name"
              report={report}
              reveal={reveal}
            />
            {accountLevel(editing.code) === 'subaccount' ? (
              <CheckField name="collection" label={accountingMessages.collection} defaultChecked={editing.collection} />
            ) : (
              <p>{accountingMessages.closedAccount}</p>
            )}
            <FormActions>
              <Button type="button" variant="quiet" onClick={() => setEditing(null)}>
                {accountingMessages.close}
              </Button>
              <Button type="submit" disabled={!ready || save.isPending}>
                {accountingMessages.save}
              </Button>
            </FormActions>
          </Form>
        )}
      </FormDialog>
    </div>
  )
}
