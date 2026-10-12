export const COMPANY_MODULES = [
  'dashboard',
  'products',
  'inventory',
  'prices',
  'accounting',
  'imports',
  'documents',
] as const

export const APP_MODULES = [...COMPANY_MODULES, 'platform'] as const

export type AppModule = (typeof APP_MODULES)[number]

export type ModuleAccess = 'view' | 'edit'

export interface ModuleGrant {
  module: AppModule
  access: ModuleAccess
}

export function visibleModules(grants: readonly ModuleGrant[]): AppModule[] {
  return APP_MODULES.filter((module) => canSee(grants, module))
}

function canSee(grants: readonly ModuleGrant[], module: AppModule): boolean {
  const grant = grants.find((row) => row.module === module)
  if (grant === undefined) {
    return false
  }
  return grant.access === 'view' || grant.access === 'edit'
}
