import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/app/providers/session'
import { PageIntro } from '@/shared/ui/ops'
import { ServerTable } from '@/shared/ui/server-table'
import { listVouchers } from '../api'
import { voucherMessages } from '../messages'
import { VoucherForm } from './voucher-form'

const voucherColumns = [
  { key: 'reference', label: 'Referencia' },
  { key: 'holder', label: 'Titular' },
  { key: 'amount', label: 'Monto' },
  { key: 'occurredOn', label: 'Fecha' },
] as const

export function DocumentsPage() {
  const { companyId } = useSession()
  const queryClient = useQueryClient()

  return (
    <div className="ops-page">
      <PageIntro title={voucherMessages.title} description={voucherMessages.description} />
      <VoucherForm
        companyId={companyId}
        onSigned={() => {
          void queryClient.invalidateQueries({ queryKey: ['vouchers', companyId] })
        }}
      />
      <ServerTable
        tableKey="vouchers"
        companyId={companyId}
        columns={voucherColumns}
        queryKey="vouchers"
        empty="No hay comprobantes guardados."
        searchHint={voucherMessages.searchHint}
        load={(query) => listVouchers(companyId ?? '', query)}
      />
    </div>
  )
}
