import { describe, expect, it } from 'vitest'
import { accountLevel } from './account'

describe('accountLevel', () => {
  it('reads the four chart levels from the business code', () => {
    expect(accountLevel('1')).toBe('class')
    expect(accountLevel('1.01')).toBe('group')
    expect(accountLevel('1.01.01')).toBe('ledger')
    expect(accountLevel('1.01.01.001')).toBe('subaccount')
  })
})
