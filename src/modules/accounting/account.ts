export type AccountLevel = 'class' | 'group' | 'ledger' | 'subaccount'

export type AccountNode = {
  code: string
  name: string
  postable: boolean
  collection: boolean
  children: AccountNode[]
}

export function accountLevel(code: string): AccountLevel {
  const depth = code.split('.').filter((part) => part !== '').length
  if (depth <= 1) {
    return 'class'
  }
  if (depth === 2) {
    return 'group'
  }
  if (depth === 3) {
    return 'ledger'
  }
  return 'subaccount'
}
