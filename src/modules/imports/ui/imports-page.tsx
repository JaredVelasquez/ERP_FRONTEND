import { useState, type FormEvent } from 'react'
import { useSession } from '@/app/providers/session'
import { useFieldSet } from '@/shared/hooks/use-field-set'
import { Button } from '@/shared/ui/button'
import { FileField } from '@/shared/ui/fields'
import { Form, FormActions, FormNotice, FormSection } from '@/shared/ui/form-layout'
import { PageIntro, Panel } from '@/shared/ui/ops'
import { ServerTable } from '@/shared/ui/server-table'
import { listImportHistory } from '../api'
import { importMessages } from '../messages'

const importColumns = [
  { key: 'file', label: 'Archivo' },
  { key: 'status', label: 'Estado' },
  { key: 'rows', label: 'Filas' },
] as const

export function ImportsPage() {
  const { companyId } = useSession()
  const [notice, setNotice] = useState<string | null>(null)
  const [reveal, setReveal] = useState(0)
  const { report, ready } = useFieldSet(['file'])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setReveal((current) => current + 1)
    if (!ready) {
      return
    }
    setNotice(importMessages.notSent)
  }

  return (
    <div className="ops-page">
      <PageIntro title={importMessages.title} description={importMessages.description} />
      <Panel>
        <Form onSubmit={onSubmit}>
          <FormSection title="Archivo">
            <FileField
              id="import-file"
              name="file"
              label={importMessages.file}
              hint={importMessages.fileHint}
              emptyLabel={importMessages.chooseFile}
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              requiredMessage={importMessages.fileRequired}
              field="file"
              report={report}
              reveal={reveal}
            />
          </FormSection>
          <FormActions>
            <Button type="submit" disabled={!ready}>
              {importMessages.review}
            </Button>
          </FormActions>
          {notice ? <FormNotice>{notice}</FormNotice> : null}
        </Form>
      </Panel>
      <ServerTable
        tableKey="imports"
        companyId={companyId}
        columns={importColumns}
        queryKey="imports"
        empty="No hay importaciones guardadas."
        searchHint={importMessages.searchHint}
        load={(query) => listImportHistory(companyId ?? '', query)}
      />
    </div>
  )
}
