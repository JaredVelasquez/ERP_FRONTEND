import { Link } from '@tanstack/react-router'
import { modulePath } from '@/app/router/module-paths'
import type { AppModule } from '@/modules/access'
import { shellMessages } from '@/shared/i18n/messages'
import { NavIcon } from './nav-icon'

const groups: readonly { label: string; modules: readonly AppModule[] }[] = [
  { label: 'Tienda', modules: ['dashboard'] },
  { label: 'Catálogo', modules: ['products'] },
  { label: 'Bodega', modules: ['inventory'] },
  { label: 'Comercial', modules: ['prices', 'documents'] },
  { label: 'Cuentas', modules: ['accounting'] },
  { label: 'Sistema', modules: ['imports', 'platform'] },
]

type ModuleNavProps = {
  modules: readonly AppModule[]
  onNavigate: () => void
}

export function ModuleNav({ modules, onNavigate }: ModuleNavProps) {
  const allowed = new Set(modules)
  return (
    <nav className="sidebar-nav" aria-label={shellMessages.sections}>
      {groups.map((group) => {
        const visible = group.modules.filter((module) => allowed.has(module))
        if (visible.length === 0) {
          return null
        }
        return (
          <div className="nav-group" key={group.label}>
            <p className="nav-group-label">{group.label}</p>
            {visible.map((module) => (
              <ModuleLinks key={module} module={module} onNavigate={onNavigate} />
            ))}
          </div>
        )
      })}
    </nav>
  )
}

function ModuleLinks({ module, onNavigate }: { module: AppModule; onNavigate: () => void }) {
  return (
    <>
      <Link to={modulePath[module]} className="nav-link" title={shellMessages[module]} activeOptions={{ exact: true, includeSearch: false }} onClick={onNavigate}>
        <NavIcon name={module} />
        <span className="nav-label">{shellMessages[module]}</span>
      </Link>
      {module === 'inventory' ? <ScanLink onNavigate={onNavigate} /> : null}
    </>
  )
}

function ScanLink({ onNavigate }: { onNavigate: () => void }) {
  return (
    <Link to="/scan" className="nav-link" title={shellMessages.scan} onClick={onNavigate}>
      <NavIcon name="scan" />
      <span className="nav-label">{shellMessages.scan}</span>
    </Link>
  )
}
