export type VoucherFormIssue = 'bank-reference' | 'declaration' | 'signature'

export interface LocalSignature {
  bankReference: string
  moneyMovementId: string | null
  journalPosted: false
}

export interface SignVoucherInput {
  bankReference: string
  moneyMovementId: string
  signature: string
  acceptedDeclaration: boolean
}

export function voucherFormIssue(input: SignVoucherInput): VoucherFormIssue | null {
  if (input.bankReference.trim() === '') {
    return 'bank-reference'
  }
  if (!input.acceptedDeclaration) {
    return 'declaration'
  }
  if (!input.signature.startsWith('data:image/')) {
    return 'signature'
  }
  return null
}

export function signVoucherLocally(input: SignVoucherInput): LocalSignature {
  const issue = voucherFormIssue(input)
  if (issue !== null) {
    throw new Error(issue)
  }
  const movement = input.moneyMovementId.trim()
  return {
    bankReference: input.bankReference.trim(),
    moneyMovementId: movement === '' ? null : movement,
    journalPosted: false,
  }
}
