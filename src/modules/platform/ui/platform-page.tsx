import { useState, type FormEvent } from 'react'
import { useSession } from '@/app/providers/session'
import { useFieldSet } from '@/shared/hooks/use-field-set'
import { Button } from '@/shared/ui/button'
import { SelectField, TextField } from '@/shared/ui/fields'
import { Form, FormActions, FormNotice, FormSection } from '@/shared/ui/form-layout'
import { PageIntro, Panel } from '@/shared/ui/ops'
import { ServerTable } from '@/shared/ui/server-table'
import { listCompanyUsers } from '../api'
import { platformMessages } from '../messages'

const userColumns = [
  { key: 'email', label: 'Correo' },
  { key: 'displayName', label: 'Nombre' },
] as const

export function PlatformPage() {
  const { companyId } = useSession()
  const [notice, setNotice] = useState<string | null>(null)
  const [reveal, setReveal] = useState(0)
  const { report, ready } = useFieldSet(['legalName', 'rtn'])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setReveal((current) => current + 1)
    if (!ready) {
      return
    }
    setNotice(platformMessages.saved)
  }

  return (
    <div className="ops-page">
      <PageIntro title={platformMessages.title} description={platformMessages.description} />
      <Panel title={platformMessages.company}>
        <Form onSubmit={onSubmit}>
          <FormSection title={platformMessages.identity}>
            <TextField
              id="company-name"
              name="legalName"
              label={platformMessages.legalName}
              defaultValue="Michelle Market (desarrollo)"
              required
              requiredMessage={platformMessages.legalRequired}
              field="legalName"
              report={report}
              reveal={reveal}
            />
            <TextField
              id="company-rtn"
              name="rtn"
              label={platformMessages.rtn}
              hint={platformMessages.rtnHint}
              defaultValue="08019999999999"
              required
              requiredMessage={platformMessages.rtnRequired}
              field="rtn"
              report={report}
              reveal={reveal}
            />
          </FormSection>
          <FormSection title={platformMessages.operation}>
            <SelectField
              id="company-currency"
              name="currency"
              label={platformMessages.currency}
              defaultValue="HNL"
              options={[
                { value: 'HNL', label: 'HNL' },
                { value: 'USD', label: 'USD' },
              ]}
            />
            <SelectField
              id="company-costing"
              name="costing"
              label={platformMessages.costing}
              hint={platformMessages.costingHint}
              defaultValue="PEPS"
              options={[{ value: 'PEPS', label: 'PEPS' }]}
            />
            <TextField
              id="company-notes"
              name="notes"
              label={platformMessages.notes}
              hint={platformMessages.notesHint}
              multiline
            />
          </FormSection>
          <FormActions>
            <Button type="submit" disabled={!ready}>
              {platformMessages.save}
            </Button>
          </FormActions>
          {notice ? <FormNotice>{notice}</FormNotice> : null}
        </Form>
      </Panel>
      <ServerTable
        tableKey="company-users"
        companyId={companyId}
        columns={userColumns}
        queryKey="company-users"
        empty="No hay usuarios en esta empresa."
        searchHint={platformMessages.searchHint}
        load={(query) => listCompanyUsers(companyId ?? '', query)}
      />
    </div>
  )
}
