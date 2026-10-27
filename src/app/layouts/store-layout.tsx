import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useSession } from '@/app/providers/session'
import { AssistantPanel } from '@/modules/assistant/assistant-panel'
import { visibleModules } from '@/modules/access'
import { readUiPreferences, saveUiPreferences } from '@/shared/api/layouts'
import { shellMessages } from '@/shared/i18n/messages'
import { Skeleton } from '@/shared/ui/skeleton'
import { ModuleNav } from './module-nav'

export function StoreLayout() {
  const { grants, companyName, companyId, logoUrl, restoring, signOut } = useSession()
  const navigate = useNavigate()
  const isAssistantPage = useRouterState({ select: (state) => state.location.pathname === '/assistant' })
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [menuReady, setMenuReady] = useState(companyId === null || companyId === '')
  const modules = grants === null ? [] : visibleModules(grants)
  const displayCompany = companyName?.trim() || shellMessages.brand

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
    return <WorkspaceLoadingSkeleton />
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
            <strong className="wordmark">
              {logoUrl ? <img className="brand-logo" src={logoUrl} alt="" /> : <span className="nav-mark" aria-hidden="true">M</span>}
              <span className="nav-label">Michelle <span className="wordmark-quiet">Market</span></span>
            </strong>
            <span className="nav-label brand-company">{displayCompany}</span>
          </div>
          <button type="button" className="ghost-button sidebar-toggle" aria-pressed={collapsed} onClick={toggleSidebar}>
            <span aria-hidden="true">{collapsed ? '»' : '«'}</span>
            <span className="nav-label">{collapsed ? shellMessages.expandMenu : shellMessages.collapseMenu}</span>
          </button>
          <ModuleNav modules={modules} onNavigate={() => setMenuOpen(false)} onExpandSidebar={() => { if (collapsed) toggleSidebar() }} />
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
          <span className="topbar-context">{shellMessages.workspace}</span>
          <p className="topbar-title">{displayCompany}</p>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
      {isAssistantPage ? null : <AssistantPanel />}
    </div>
  )
}

function WorkspaceLoadingSkeleton() {
  return (
    <div className="app-shell workspace-loading" role="status">
      <span className="sr-only">{shellMessages.loading} {shellMessages.workspace.toLocaleLowerCase()}…</span>
      <aside className="workspace-loading-sidebar" aria-hidden="true">
        <Skeleton className="skeleton-block workspace-loading-brand" />
        <Skeleton className="skeleton-line workspace-loading-caption" />
        {Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="skeleton-block workspace-loading-link" />)}
      </aside>
      <main className="workspace-loading-main" aria-hidden="true">
        <Skeleton className="skeleton-block workspace-loading-topbar" />
        <div className="workspace-loading-content">
          <Skeleton className="skeleton-line skeleton-line--short" />
          <Skeleton className="skeleton-line workspace-loading-title" />
          <Skeleton className="skeleton-line skeleton-line--wide" />
          <div className="workspace-loading-cards">
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="skeleton-block" />)}
          </div>
          <Skeleton className="skeleton-block workspace-loading-table" />
        </div>
      </main>
    </div>
  )
}
