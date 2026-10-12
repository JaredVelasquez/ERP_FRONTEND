import { useQuery } from '@tanstack/react-query'
import { listAccountTree } from '../api'

export function useAccountTree(companyId: string | null) {
  return useQuery({
    queryKey: ['accounting', 'chart', companyId],
    enabled: companyId !== null && companyId !== '',
    queryFn: () => listAccountTree(companyId ?? ''),
    retry: false,
  })
}
