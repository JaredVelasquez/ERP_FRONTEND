import { Link } from '@tanstack/react-router'
import { useSession } from '@/app/providers/session'
import { PageIntro } from '@/shared/ui/ops'
import { ServerTable } from '@/shared/ui/server-table'
import { listInventoryDocuments } from '../api'
import { inventoryMessages } from '../messages'

const documentColumns = [
  { key: 'type', label: 'Tipo' },
  { key: 'status', label: 'Estado' },
  { key: 'createdAt', label: 'Fecha' },
] as const

export function InventoryPage() {
  const { companyId } = useSession()

  return (
    <div className="ops-page inventory-page">
      <PageIntro title={inventoryMessages.title} description={inventoryMessages.description} action={<Link className="ui-button ui-button--primary" to="/operations">{inventoryMessages.scan} <span aria-hidden="true">↗</span></Link>} />
      <ServerTable
        tableKey="inventory-documents"
        companyId={companyId}
        columns={documentColumns}
        queryKey="inventory-documents"
        empty={inventoryMessages.empty}
        searchHint={inventoryMessages.searchHint}
        load={(query) => listInventoryDocuments(companyId ?? '', query)}
      />
    </div>
  )
}
