import { describe, expect, it } from 'vitest'
import { visibleModules, type ModuleGrant } from './grants'

const operatorGrants: ModuleGrant[] = [
  { module: 'dashboard', access: 'view' },
  { module: 'products', access: 'edit' },
  { module: 'inventory', access: 'edit' },
  { module: 'prices', access: 'view' },
  { module: 'imports', access: 'edit' },
  { module: 'documents', access: 'edit' },
]

describe('visible modules', () => {
  it('hides accounting and platform from an operator', () => {
    expect(visibleModules(operatorGrants)).toEqual([
      'dashboard',
      'products',
      'inventory',
      'prices',
      'imports',
      'documents',
    ])
  })

  it('shows accounting to an owner and keeps platform hidden', () => {
    const owner: ModuleGrant[] = [
      { module: 'dashboard', access: 'edit' },
      { module: 'products', access: 'edit' },
      { module: 'inventory', access: 'edit' },
      { module: 'prices', access: 'edit' },
      { module: 'accounting', access: 'edit' },
      { module: 'imports', access: 'edit' },
      { module: 'documents', access: 'edit' },
    ]
    expect(visibleModules(owner)).toContain('accounting')
    expect(visibleModules(owner)).not.toContain('platform')
  })

  it('shows platform only when the grant includes it', () => {
    expect(visibleModules([{ module: 'platform', access: 'edit' }])).toEqual(['platform'])
  })
})
