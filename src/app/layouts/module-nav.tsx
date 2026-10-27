import { Link, useLocation } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
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
  { label: 'Sistema', modules: ['imports', 'settings', 'platform'] },
]

type ModuleNavProps = {
  modules: readonly AppModule[]
  onNavigate: () => void
  onExpandSidebar: () => void
}

export function ModuleNav({ modules, onNavigate, onExpandSidebar }: ModuleNavProps) {
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
              <ModuleLinks key={module} module={module} modules={modules} onNavigate={onNavigate} onExpandSidebar={onExpandSidebar} />
            ))}
          </div>
        )
      })}
    </nav>
  )
}

function ModuleLinks({ module, modules, onNavigate, onExpandSidebar }: { module: AppModule; modules: readonly AppModule[]; onNavigate: () => void; onExpandSidebar: () => void }) {
  if (module === 'settings') return <SettingsLinks modules={modules} onNavigate={onNavigate} onExpandSidebar={onExpandSidebar} />
  return (
    <>
      <Link to={modulePath[module]} className="nav-link" title={shellMessages[module]} activeOptions={{ exact: true, includeSearch: false }} onClick={onNavigate}>
        <NavIcon name={module} />
        <span className="nav-label">{shellMessages[module]}</span>
      </Link>
      {module === 'inventory' ? <ScanLink onNavigate={onNavigate} /> : null}
      {module === 'accounting' ? <Link to="/reports" className="nav-link" title="Reportes" onClick={onNavigate}>
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 19h16M6 16V9m6 7V5m6 11v-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="nav-label">Reportes</span>
      </Link> : null}
      {module === 'accounting' ? <Link to="/accounting/journal-entries" className="nav-link" title="Asientos contables" onClick={onNavigate}>
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M7 3h10v18l-5-3-5 3V3Z" strokeLinejoin="round"/><path d="M9.5 8h5M9.5 12h5" strokeLinecap="round"/></svg>
        <span className="nav-label">Asientos</span>
      </Link> : null}
    </>
  )
}

function SettingsLinks({ modules, onNavigate, onExpandSidebar }: { modules: readonly AppModule[]; onNavigate: () => void; onExpandSidebar: () => void }) {
  const pathname = useLocation({ select: (location) => location.pathname })
  const [expanded, setExpanded] = useState(() => pathname === '/settings' || pathname.startsWith('/settings/'))

  useEffect(() => {
    if (pathname === '/settings' || pathname.startsWith('/settings/')) setExpanded(true)
  }, [pathname])

  return <div className="nav-settings">
    <button type="button" className={`nav-link nav-link--toggle${pathname.startsWith('/settings') ? ' nav-link--section-active' : ''}`}
      aria-expanded={expanded} aria-controls="settings-submenu" onClick={() => { if (!expanded) onExpandSidebar(); setExpanded(!expanded) }}>
      <NavIcon name="settings" /><span className="nav-label">{shellMessages.settings}</span>
      <svg className="nav-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {expanded ? <div id="settings-submenu" className="nav-submenu" aria-label="Secciones de configuración">
      <Link to="/settings" className="nav-link nav-link--sub" activeOptions={{ exact: true }} onClick={onNavigate}>Resumen</Link>
      <Link to="/settings/users" className="nav-link nav-link--sub" onClick={onNavigate}>Usuarios y accesos</Link>
      {modules.includes('prices') ? <Link to="/settings/prices" className="nav-link nav-link--sub" onClick={onNavigate}>Política de precios</Link> : null}
      <Link to="/settings/assistant" className="nav-link nav-link--sub" onClick={onNavigate}>Asistente con IA</Link>
      <Link to="/settings/integrations" className="nav-link nav-link--sub" onClick={onNavigate}>Integraciones MCP</Link>
    </div> : null}
  </div>
}

function ScanLink({ onNavigate }: { onNavigate: () => void }) {
  return (
    <Link to="/scan" className="nav-link" title={shellMessages.scan} onClick={onNavigate}>
      <NavIcon name="scan" />
      <span className="nav-label">{shellMessages.scan}</span>
    </Link>
  )
}
