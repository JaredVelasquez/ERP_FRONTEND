import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from '@tanstack/react-router'
import { useSession } from '@/app/providers/session'
import { visibleModules } from '@/modules/access'
import { readUiPreferences, saveUiPreferences } from '@/shared/api/layouts'
import { shellMessages } from '@/shared/i18n/messages'
import { ModuleNav } from './module-nav'

export function StoreLayout() {
  const { grants, companyName, companyId, logoUrl, restoring, signOut } = useSession()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [menuReady, setMenuReady] = useState(companyId === null || companyId === '')
  const modules = grants === null ? [] : visibleModules(grants)

  useEffect(() => {
    if (companyId === null || companyId === '') {
      setMenuReady(true)
      return
    }
    let active = true
    void readUiPreferences()
      .then((preferences) => {
        if (!active) {
          return
        }
        setCollapsed(preferences.sidebarCollapsed)
        setMenuReady(true)
      })
      .catch(() => {
        if (!active) {
          return
        }
        setMenuReady(true)
      })
    return () => {
      active = false
    }
  }, [companyId])

  if (restoring || (modules.length > 0 && !menuReady)) {
    return (
      <main className="login-page">
        <p role="status">{shellMessages.loading}</p>
      </main>
    )
  }

  if (modules.length === 0) {
    return (
      <main className="login-page">
        <Outlet />
      </main>
    )
  }

  const shellClass = collapsed ? 'app-shell app-shell--collapsed' : 'app-shell'

  function toggleSidebar() {
    const next = !collapsed
    setCollapsed(next)
    if (companyId === null || companyId === '') {
      return
    }
    void saveUiPreferences({ sidebarCollapsed: next })
  }

  return (
    <div className={shellClass}>
      {menuOpen ? (
        <button type="button" className="sidebar-backdrop" aria-label={shellMessages.closeMenu} onClick={() => setMenuOpen(false)} />
      ) : null}
      <aside className={menuOpen ? 'sidebar sidebar--open' : 'sidebar'} id="main-sidebar" aria-label="Navegación principal">
        <div>
          <div className="sidebar-brand">
            {logoUrl ? (
              <img className="brand-logo" src={logoUrl} alt={companyName ?? shellMessages.brand} />
            ) : (
              <strong className="wordmark">
                <span className="nav-mark" aria-hidden="true">M</span>
                <span className="nav-label">Michelle <span className="wordmark-quiet">Market</span></span>
              </strong>
            )}
            <span className="nav-label brand-company">{companyName ?? shellMessages.noCompany}</span>
          </div>
          <button type="button" className="ghost-button sidebar-toggle" aria-pressed={collapsed} onClick={toggleSidebar}>
            <span aria-hidden="true">{collapsed ? '»' : '«'}</span>
            <span className="nav-label">{collapsed ? shellMessages.expandMenu : shellMessages.collapseMenu}</span>
          </button>
          <ModuleNav modules={modules} onNavigate={() => setMenuOpen(false)} />
        </div>
        <div className="sidebar-foot">
          <p className="nav-label">{shellMessages.devCompany}</p>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              signOut()
              void navigate({ to: '/' })
            }}
          >
            <span className="nav-mark" aria-hidden="true">×</span>
            <span className="nav-label">{shellMessages.signOut}</span>
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button type="button" className="ghost-button menu-button" aria-expanded={menuOpen} aria-controls="main-sidebar" onClick={() => setMenuOpen(!menuOpen)}>
            {shellMessages.menu}
          </button>
          <p className="topbar-title">{companyName ?? shellMessages.brand}</p>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
