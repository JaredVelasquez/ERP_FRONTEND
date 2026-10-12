import { Link } from '@tanstack/react-router'
import { useSession } from '@/app/providers/session'
import { DevNote, PageIntro } from '@/shared/ui/ops'
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
    <div className="ops-page">
      <PageIntro title={inventoryMessages.title} description={inventoryMessages.description} />
      <DevNote>{inventoryMessages.noOpening}</DevNote>
      <p>
        <Link to="/scan">{inventoryMessages.scan}</Link>
      </p>
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
