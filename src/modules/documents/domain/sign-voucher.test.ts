import { describe, expect, it } from 'vitest'
import { signVoucherLocally } from './sign-voucher'

describe('local voucher signature', () => {
  it('keeps the bank reference and movement id and does not post a journal', () => {
    const signed = signVoucherLocally({
      bankReference: '  AUTH-9  ',
      moneyMovementId: ' mov-1 ',
      signature: 'data:image/png;base64,abc',
      acceptedDeclaration: true,
    })

    expect(signed).toEqual({
      bankReference: 'AUTH-9',
      moneyMovementId: 'mov-1',
      journalPosted: false,
    })
  })

  it('allows a signature without a money movement', () => {
    const signed = signVoucherLocally({
      bankReference: 'AUTH-9',
      moneyMovementId: ' ',
      signature: 'data:image/png;base64,abc',
      acceptedDeclaration: true,
    })

    expect(signed.moneyMovementId).toBeNull()
    expect(signed.journalPosted).toBe(false)
  })
})
