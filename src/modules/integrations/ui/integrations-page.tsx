import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { appConfig } from '@/app/config/app-config'
import { useSession } from '@/app/providers/session'
import { PageIntro } from '@/shared/ui/ops'
import { ServerTable, type PageQuery } from '@/shared/ui/server-table'
import { Skeleton } from '@/shared/ui/skeleton'
import { createToken, listCompanyTokens, listUsage, revokeCompanyToken, rotateCompanyToken, tokenOptions, type TokenDetails, type TokenProfile } from '../api'

const profileNames: Record<TokenProfile, string> = {
  consulta: 'Solo consulta', operacion: 'Operaciones', catalogo: 'Catálogo y precios',
  gerencia: 'Gerencia', personalizado: 'Personalizado',
}

export function IntegrationsPage() {
  const { companyId, grants, userId, role } = useSession()
  const queryClient = useQueryClient()
  const options = useQuery({ queryKey: ['mcp-token-options', companyId], queryFn: tokenOptions, enabled: Boolean(companyId) })
  const tokens = useQuery({ queryKey: ['mcp-tokens', companyId], queryFn: listCompanyTokens, enabled: Boolean(companyId) })
  const usage = useQuery({ queryKey: ['mcp-usage-summary', companyId], queryFn: () => listUsage({ page: 1, pageSize: 1, search: '' }), enabled: Boolean(companyId) })
  const canEdit = grants?.some((grant) => grant.module === 'settings' && grant.access === 'edit') ?? false
  const [profile, setProfile] = useState<TokenProfile>('consulta')
  const [selected, setSelected] = useState<string[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [secret, setSecret] = useState('')
  const [freshToken, setFreshToken] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [installTarget, setInstallTarget] = useState<{ id: string; name: string } | null>(null)
  const [pendingAction, setPendingAction] = useState<{ kind: 'rotate' | 'revoke'; token: TokenDetails } | null>(null)
  const confirmDialog = useRef<HTMLDialogElement>(null)
  const createDialog = useRef<HTMLDialogElement>(null)
  const installDialog = useRef<HTMLDialogElement>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const connectorUrl = new URL('/mcp/connector', appConfig.gatewayUrl).toString()
  const connectorKey = installTarget ? `erp_${installTarget.id.slice(0, 8)}` : 'erp'
  const connectorJson = secret ? JSON.stringify({ mcpServers: { [connectorKey]: { type: 'http', url: connectorUrl, headers: { Authorization: `Bearer ${secret}` } } } }, null, 2) : ''
  const setupPrompt = secret ? `Configura el conector MCP del ERP en el archivo JSON de configuración MCP de este cliente. Conserva todos los conectores existentes y agrega o actualiza la entrada "${connectorKey}" dentro de "mcpServers" con esta configuración:\n\n${connectorJson}\n\nSi este cliente usa otro nombre para el campo de servidores o para el transporte HTTP, adapta solo esas claves a su formato documentado. No muestres el token en la respuesta ni lo incluyas en commits. Guarda el JSON válido y avísame si debo reiniciar el cliente para activar el conector.` : ''

  useEffect(() => {
    if (pendingAction && !confirmDialog.current?.open) confirmDialog.current?.showModal()
    if (!pendingAction && confirmDialog.current?.open) confirmDialog.current.close()
  }, [pendingAction])

  useEffect(() => {
    if (createOpen && !createDialog.current?.open) createDialog.current?.showModal()
    if (!createOpen && createDialog.current?.open) createDialog.current.close()
  }, [createOpen])

  useEffect(() => {
    if (installTarget && !installDialog.current?.open) installDialog.current?.showModal()
    if (!installTarget && installDialog.current?.open) installDialog.current.close()
  }, [installTarget])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    if (profile === 'personalizado' && selected.length === 0) {
      setNotice('Selecciona al menos una herramienta para este perfil.')
      return
    }
    setBusy(true)
    setNotice('')
    try {
      const created = await createToken({
        name: String(data.get('name') ?? '').trim(), profile,
        tools: profile === 'personalizado' ? selected : undefined,
        days: Number(data.get('days') ?? 90),
      })
      setSecret(created.token)
      setFreshToken(true)
      setShowSecret(false)
      setInstallTarget({ id: created.details.id, name: created.details.name })
      await queryClient.invalidateQueries({ queryKey: ['mcp-tokens'] })
      form.reset()
      setProfile('consulta')
      setSelected([])
      setCreateOpen(false)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo crear el token.')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    try {
      setActionNotice('')
      await revokeCompanyToken(id)
      await queryClient.invalidateQueries({ queryKey: ['mcp-tokens'] })
      if (installTarget?.id === id) { setInstallTarget(null); setSecret('') }
      setActionNotice('Token revocado. La integración ya no tiene acceso.')
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : 'No se pudo revocar el token.')
    }
  }

  async function rotate(token: TokenDetails) {
    try {
      setActionNotice('')
      const restoring = Boolean(token.revokedAt)
      const result = await rotateCompanyToken(token.id)
      setSecret(result.token)
      setFreshToken(true)
      setShowSecret(false)
      setInstallTarget({ id: token.id, name: token.name })
      setActionNotice(restoring ? 'Acceso restablecido con un token nuevo. Instala el JSON o prompt actualizado.' : 'Token renovado. Actualiza el conector con el nuevo JSON o prompt.')
      await queryClient.invalidateQueries({ queryKey: ['mcp-tokens'] })
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : 'No se pudo restablecer el token.')
    }
  }

  function openInstall(token: TokenDetails) {
    if (installTarget?.id !== token.id) { setSecret(''); setFreshToken(false) }
    setShowSecret(false)
    setInstallTarget({ id: token.id, name: token.name })
  }

  function closeInstall() {
    setInstallTarget(null)
    setSecret('')
    setFreshToken(false)
    setShowSecret(false)
  }

  async function confirmAction() {
    if (!pendingAction) return
    setBusy(true)
    const action = pendingAction
    setPendingAction(null)
    if (action.kind === 'rotate') await rotate(action.token)
    if (action.kind === 'revoke') await revoke(action.token.id)
    setBusy(false)
  }

  const rotateLabel = pendingAction?.token.revokedAt ? 'Restablecer acceso' : pendingAction?.token.expiresAt && Date.parse(pendingAction.token.expiresAt) <= Date.now() ? 'Renovar token' : 'Rotar token'

  if (!companyId) return <main className="login-page"><p>Inicia sesión para administrar integraciones.</p><Link to="/">Ir al acceso</Link></main>

  async function loadTokens(query: PageQuery) {
    const items = (await listCompanyTokens()).filter((item) =>
      `${item.name} ${item.userName ?? ''} ${item.profile}`.toLowerCase().includes(query.search.toLowerCase()))
    const offset = (query.page - 1) * query.pageSize
    return { page: query.page, pageSize: query.pageSize, total: items.length, items: items.slice(offset, offset + query.pageSize).map((item) => ({ id: item.id, cells: {
      name: item.name, user: item.userName ?? item.userId, profile: profileNames[item.profile] ?? item.profile,
      status: item.revokedAt ? 'Revocado' : item.ownerActive === false ? 'Usuario deshabilitado' : item.expiresAt && Date.parse(item.expiresAt) <= Date.now() ? 'Vencido' : 'Activo',
      lastUsed: item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString('es-HN') : 'Sin uso',
      expires: item.expiresAt ? new Date(item.expiresAt).toLocaleDateString('es-HN') : 'Sin fecha', actions: 'Opciones',
    } })) }
  }

  async function loadUsage(query: PageQuery) {
    const result = await listUsage({ page: query.page, pageSize: query.pageSize, search: query.search, userId: selectedUser })
    return { page: query.page, pageSize: query.pageSize, total: result.total, items: result.items.map((item, index) => ({
      id: `${item.tokenId ?? item.userId}-${item.createdAt ?? index}-${index}`, cells: {
        date: item.createdAt ? new Date(item.createdAt).toLocaleString('es-HN') : '—',
        user: item.userName ?? item.userId, connector: item.tokenName ?? 'Chat embebido', tool: item.tool,
        status: item.result === 'ok' ? 'Correcto' : item.result === 'denied' ? 'Denegado' : 'Error',
      },
    })) }
  }

  return (
    <main className="ops-page integrations-page">
      <PageIntro title="Integraciones MCP" description="Crea credenciales limitadas a tus permisos actuales y a una sola empresa." />
      <div className="integration-toolbar">
        <p>Administra credenciales, permisos y actividad de las herramientas conectadas a esta empresa.</p>
        {canEdit ? <button type="button" className="ui-button ui-button--primary" onClick={() => { setNotice(''); setCreateOpen(true) }} aria-haspopup="dialog">Crear integración</button> : null}
      </div>
      <div className="integration-summary" aria-label="Resumen de conectores">
        <div><span>Conectores</span>{tokens.isPending ? <Skeleton className="skeleton-line integration-count-skeleton" /> : <strong>{tokens.data?.length ?? '—'}</strong>}</div>
        <div><span>Activos</span>{tokens.isPending ? <Skeleton className="skeleton-line integration-count-skeleton" /> : <strong>{tokens.data?.filter((item) => !item.revokedAt && item.ownerActive !== false && (!item.expiresAt || Date.parse(item.expiresAt) > Date.now())).length ?? '—'}</strong>}</div>
        <div><span>Usos registrados</span>{usage.isPending ? <Skeleton className="skeleton-line integration-count-skeleton" /> : <strong>{usage.data?.total ?? '—'}</strong>}</div>
      </div>
      <ServerTable tableKey="mcp-connectors" companyId={companyId} queryKey="mcp-tokens" empty="No hay conectores para mostrar." searchHint="Buscar conector, usuario o perfil" columns={[
        { key: 'name', label: 'Conector' }, { key: 'user', label: 'Creado por' }, { key: 'profile', label: 'Perfil' },
        { key: 'status', label: 'Estado' }, { key: 'lastUsed', label: 'Último uso' }, { key: 'expires', label: 'Vence' },
        ...(canEdit ? [{ key: 'actions', label: 'Acción' }] : []),
      ]} load={loadTokens} rowActions={canEdit ? (id) => {
        const token = tokens.data?.find((item) => item.id === id)
        if (!token) return []
        const revoked = Boolean(token.revokedAt)
        const expired = Boolean(token.expiresAt && Date.parse(token.expiresAt) <= Date.now())
        const ownerActive = token.ownerActive !== false
        return [
          { label: 'Obtener JSON y prompt', onSelect: () => openInstall(token), disabled: revoked || expired || !ownerActive },
          { label: revoked ? 'Restablecer acceso' : expired ? 'Renovar token' : 'Rotar token', onSelect: () => setPendingAction({ kind: 'rotate', token }), disabled: !ownerActive || (role !== 'owner' && token.userId !== userId) },
          { label: 'Revocar token', onSelect: () => setPendingAction({ kind: 'revoke', token }), danger: true, disabled: revoked },
        ]
      } : undefined} />
      {actionNotice ? <p role="alert" className="form-notice">{actionNotice}</p> : null}
      <dialog ref={installDialog} className="dialog integration-install-dialog" aria-labelledby="integration-install-title" onCancel={closeInstall}>
        <div className="integration-install-dialog-body">
          <header className="integration-create-header"><div><h2 id="integration-install-title">Instalación · {installTarget?.name}</h2><p>Guarda el token y agrega esta conexión a tu cliente MCP.</p></div><button type="button" className="settings-dialog-close" aria-label="Cerrar" onClick={closeInstall}>×</button></header>
          <div className="integration-install">
          <p className="muted">El ERP guarda el hash del token. Para recuperar la configuración, pega el token que guardaste; si no lo tienes, usa la opción de rotar o restablecer en el menú de tres puntos.</p>
          <label className="field">Token del conector
            <input type={showSecret ? 'text' : 'password'} value={secret} onChange={(event) => { setSecret(event.target.value.trim()); setFreshToken(false) }} autoComplete="off" placeholder="erp_mcp_…" />
          </label>
          <div className="integration-install-actions"><button type="button" className="ghost-button" onClick={() => setShowSecret(!showSecret)}>{showSecret ? 'Ocultar token' : 'Mostrar token'}</button>
            {secret ? <button type="button" className="ghost-button" onClick={() => void navigator.clipboard.writeText(secret)}>Copiar token</button> : null}
          </div>
          {freshToken ? <p className="form-notice" role="status">Nuevo token generado. Cópialo ahora; al cerrar esta sección no volverá a mostrarse.</p> : null}
          {secret ? <div className="integration-install-output">
            <div><strong>JSON del conector</strong><button type="button" className="ghost-button" onClick={() => void navigator.clipboard.writeText(connectorJson)}>Copiar JSON</button></div>
            <pre>{connectorJson}</pre>
            <div><strong>Prompt de instalación</strong><button type="button" className="ghost-button" onClick={() => void navigator.clipboard.writeText(setupPrompt)}>Copiar prompt</button></div>
            <textarea readOnly value={setupPrompt} rows={8} aria-label="Prompt de instalación del conector MCP" />
          </div> : null}
          </div>
        </div>
      </dialog>
      {canEdit ? <dialog ref={createDialog} className="dialog integration-create-dialog" aria-labelledby="integration-create-title" onCancel={() => setCreateOpen(false)}>
        <div className="integration-create-content">
          <header className="integration-create-header"><div><h2 id="integration-create-title">Crear integración MCP</h2><p>Define el nombre y las acciones que podrá realizar esta conexión.</p></div><button type="button" className="settings-dialog-close" aria-label="Cerrar" onClick={() => setCreateOpen(false)}>×</button></header>
          <p className="muted integration-create-note">El ERP genera el token automáticamente. Podrás copiarlo junto con el JSON y el prompt al terminar.</p>
          {options.isPending ? <p className="table-refresh-status" role="status">Cargando perfiles y permisos disponibles…</p> : null}
          {options.isError ? <div className="table-load-error" role="alert"><p>No se pudieron cargar los perfiles de integración.</p><button type="button" className="ghost-button" onClick={() => void options.refetch()}>Reintentar</button></div> : null}
          <form className="integration-form" onSubmit={(event) => void submit(event)}>
            <label className="field">Nombre de la integración<input name="name" maxLength={120} required placeholder="Ej. automatización de inventario" /></label>
            <label className="field">Perfil
              <select value={profile} onChange={(event) => setProfile(event.target.value as TokenProfile)}>
                {(options.data?.profiles ?? ['consulta', 'operacion', 'catalogo', 'gerencia', 'personalizado']).map((item) => <option key={item} value={item}>{profileNames[item]}</option>)}
              </select>
            </label>
            {profile === 'personalizado' ? <fieldset className="integration-tools"><legend>Herramientas autorizadas</legend>
              {(options.data?.tools ?? []).map((tool) => <label key={tool}><input type="checkbox" checked={selected.includes(tool)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, tool] : current.filter((item) => item !== tool))} /><span>{tool}</span></label>)}
            </fieldset> : <p className="muted">El perfil queda limitado a los permisos de tu usuario y a esta empresa.</p>}
            <label className="field">Vigencia del token
              <select name="days" defaultValue="90"><option value="30">30 días</option><option value="90">90 días</option><option value="180">180 días</option><option value="365">365 días</option></select>
            </label>
            {notice ? <p role="alert" className="form-notice">{notice}</p> : null}
            <div className="dialog-actions"><button type="button" className="ghost-button" onClick={() => setCreateOpen(false)} disabled={busy}>Cancelar</button><button className="ui-button ui-button--primary" type="submit" disabled={busy || options.isPending || options.isError}>{busy ? 'Generando…' : 'Generar token'}</button></div>
          </form>
        </div>
      </dialog> : null}
      <dialog ref={confirmDialog} className="dialog integration-confirm-dialog" aria-labelledby="integration-confirm-title" onCancel={() => setPendingAction(null)}>
        <div className="integration-confirm-body">
          <h2 id="integration-confirm-title">{pendingAction?.kind === 'rotate' ? rotateLabel : 'Revocar token'}</h2>
          <p>{pendingAction?.kind === 'rotate' ? `Se generará un token nuevo para «${pendingAction.token.name}». El anterior dejará de funcionar y tendrás que instalar el nuevo.` : `«${pendingAction?.token.name ?? ''}» perderá acceso inmediatamente.`}</p>
          <div className="dialog-actions"><button type="button" className="ghost-button" onClick={() => setPendingAction(null)}>Cancelar</button><button type="button" className="ui-button ui-button--primary" disabled={busy} onClick={() => void confirmAction()}>{pendingAction?.kind === 'rotate' ? rotateLabel : 'Revocar token'}</button></div>
        </div>
      </dialog>
      <label className="field integration-user-filter">Historial por usuario<select value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}>
        <option value="">Todos los usuarios</option>{[...new Map(tokens.data?.map((item) => [item.userId, item.userName ?? item.userId]) ?? [])].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select></label>
      <ServerTable tableKey="mcp-usage" companyId={companyId} queryKey={`mcp-usage-${selectedUser}`} empty="Aún no hay actividad registrada." searchHint="Buscar usuario, conector o herramienta" columns={[
        { key: 'date', label: 'Fecha' }, { key: 'user', label: 'Usuario' }, { key: 'connector', label: 'Conector' },
        { key: 'tool', label: 'Herramienta' }, { key: 'status', label: 'Resultado' },
      ]} load={loadUsage} />
    </main>
  )
}
