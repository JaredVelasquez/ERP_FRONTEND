import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSession } from '@/app/providers/session'
import { COMPANY_MODULES, type ModuleGrant } from '@/modules/access'
import { designatePriceApprover, readPriceSettings } from '@/modules/prices/api'
import { designateVoucherVoidApprover, readVoucherVoidApproverSettings } from '../api'
import { Button } from '@/shared/ui/button'
import { PageIntro, Panel } from '@/shared/ui/ops'
import { ListSkeleton } from '@/shared/ui/skeleton'
import { ServerTable, type PageQuery } from '@/shared/ui/server-table'
import { changeOwnPassword, createCompanyUser, listCompanyUsers, readAiSettings, saveAiSettings,
  setCompanyUserActive, setCompanyUserGrants, readPaymentSettings, savePaymentSettings,
  type AiSettings, type CompanyUser, type PaymentAccount, type PaymentSettings } from '../api'
import './settings-page.css'
import { CompanyControlsPanel } from './company-controls-panel'

const moduleNames: Record<(typeof COMPANY_MODULES)[number], string> = {
  dashboard: 'Tablero', products: 'Productos', inventory: 'Inventario', prices: 'Precios',
  accounting: 'Contabilidad', imports: 'Importaciones', documents: 'Comprobantes', settings: 'Configuración',
}
const modelOptions: Record<AiSettings['provider'], readonly { value: string; label: string }[]> = {
  gemini: [{ value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }, { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' }],
  anthropic: [{ value: 'claude-sonnet-5', label: 'Claude Sonnet 5' }, { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' }],
  openai: [{ value: 'gpt-4o-mini', label: 'GPT-4o mini' }, { value: 'gpt-4o', label: 'GPT-4o' }],
}

type SettingsSection = 'overview' | 'users' | 'prices' | 'documents' | 'assistant' | 'payments' | 'controls'

function generatePassword(): string {
  const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*?']
  const all = groups.join('')
  const pick = (characters: string) => {
    const limit = 256 - (256 % characters.length)
    let value: number
    do { value = crypto.getRandomValues(new Uint8Array(1))[0] } while (value >= limit)
    return characters[value % characters.length]
  }
  const characters = [...groups.map(pick), ...Array.from({ length: 16 }, () => pick(all))]
  const randomness = crypto.getRandomValues(new Uint8Array(characters.length))
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const next = randomness[index] % (index + 1)
    ;[characters[index], characters[next]] = [characters[next], characters[index]]
  }
  return characters.join('')
}

export function SettingsPage({ section = 'overview' }: { section?: SettingsSection }) {
  const { companyId, companyName, grants, role, userId, signOut } = useSession()
  const client = useQueryClient()
  const users = useQuery({ queryKey: ['settings-users', companyId], queryFn: listCompanyUsers, enabled: Boolean(companyId) && section === 'users' })
  const price = useQuery({ queryKey: ['price-settings', companyId], queryFn: readPriceSettings, enabled: Boolean(companyId) && section === 'prices' })
  const voucherVoidSettings = useQuery({ queryKey: ['voucher-void-settings', companyId], queryFn: readVoucherVoidApproverSettings, enabled: Boolean(companyId) && section === 'documents' })
  const ai = useQuery({ queryKey: ['ai-settings', companyId], queryFn: readAiSettings, enabled: Boolean(companyId) && section === 'assistant' })
  const payments = useQuery({ queryKey: ['payment-settings', companyId], queryFn: () => readPaymentSettings(companyId ?? ''), enabled: Boolean(companyId) && section === 'payments' })
  const [selected, setSelected] = useState<CompanyUser | null>(null)
  const [userDialogMode, setUserDialogMode] = useState<'details' | 'permissions' | 'status'>('details')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [createdPassword, setCreatedPassword] = useState<{ email: string; password: string } | null>(null)
  const userDialog = useRef<HTMLDialogElement>(null)
  const canEdit = grants?.some((grant) => grant.module === 'settings' && grant.access === 'edit') ?? false
  const isOwner = role === 'owner'

  async function run(work: () => Promise<unknown>, success: string) {
    setBusy(true)
    setNotice('')
    try {
      await work()
      setNotice(success)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['settings-users', companyId] }),
        client.invalidateQueries({ queryKey: ['price-settings', companyId] }),
        client.invalidateQueries({ queryKey: ['voucher-void-settings', companyId] }),
        client.invalidateQueries({ queryKey: ['ai-settings', companyId] }),
        client.invalidateQueries({ queryKey: ['payment-settings', companyId] }),
      ])
      return true
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo guardar el cambio.')
      return false
    } finally {
      setBusy(false)
    }
  }

  function openUser(id: string, mode: 'details' | 'permissions' | 'status' = 'details') {
    const user = users.data?.find((item) => item.id === id)
    if (!user) return
    setSelected(user)
    setUserDialogMode(mode)
    userDialog.current?.showModal()
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!companyId) return
    const form = event.currentTarget
    const data = new FormData(form)
    const email = String(data.get('email') ?? '').trim()
    const initialPassword = password
    const saved = await run(() => createCompanyUser({ companyId, email,
      displayName: String(data.get('name') ?? '').trim(), password: initialPassword }), 'Usuario creado.')
    if (saved) { setCreatedPassword({ email, password: initialPassword }); setPassword(''); form.reset() }
  }

  async function saveAi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await run(() => saveAiSettings({ provider: String(data.get('provider')) as AiSettings['provider'],
      model: String(data.get('model') ?? ''), apiKey: String(data.get('apiKey') ?? '') || undefined }), 'Asistente actualizado.')
    const key = event.currentTarget.elements.namedItem('apiKey')
    if (key instanceof HTMLInputElement) key.value = ''
  }

  async function saveGrants(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !companyId) return
    const data = new FormData(event.currentTarget)
    const next: ModuleGrant[] = COMPANY_MODULES.flatMap((module) => {
      const access = data.get(module)
      return access === 'view' || access === 'edit' ? [{ module, access }] : []
    })
    await run(() => setCompanyUserGrants(selected.id, companyId, next), 'Permisos actualizados.')
    userDialog.current?.close()
  }

  async function loadUsers(query: PageQuery) {
    const items = (await listCompanyUsers()).filter((user) =>
      `${user.displayName} ${user.email}`.toLocaleLowerCase().includes(query.search.toLocaleLowerCase()))
    const offset = (query.page - 1) * query.pageSize
    return { page: query.page, pageSize: query.pageSize, total: items.length,
      items: items.slice(offset, offset + query.pageSize).map((user) => ({ id: user.id, cells: {
        name: user.displayName, email: user.email, role: user.role === 'owner' ? 'Dueño' : 'Empleado',
        status: user.active ? 'Activo' : 'Deshabilitado', access: `${user.grants.length} módulos`, actions: 'Administrar',
      } })) }
  }

  return <div className="ops-page settings-page">
    <PageIntro title={section === 'overview' ? 'Configuración' : section === 'users' ? 'Usuarios y accesos' : section === 'prices' ? 'Política de precios' : section === 'documents' ? 'Aprobación de anulaciones' : section === 'payments' ? 'Métodos de pago y bancos' : section === 'controls' ? 'Controles fiscales y operativos' : 'Asistente con IA'} description={`Administra ${companyName ?? 'esta empresa'} por tema.`} />
    {notice ? <p className="form-notice" role="status">{notice}</p> : null}
    {section === 'overview' ? <div className="settings-category-list">
      <Link to="/settings/users" className="settings-category"><span><strong>Usuarios y accesos</strong><small>Crear empleados, cambiar claves y asignar permisos.</small></span><span aria-hidden="true">→</span></Link>
      {grants?.some((grant) => grant.module === 'prices') ? <Link to="/settings/prices" className="settings-category"><span><strong>Política de precios</strong><small>Designar quién puede cambiar precios directamente.</small></span><span aria-hidden="true">→</span></Link> : null}
      <Link to="/settings/documents" className="settings-category"><span><strong>Comprobantes</strong><small>Designar quién puede aprobar solicitudes de anulación.</small></span><span aria-hidden="true">→</span></Link>
      <Link to="/settings/payments" className="settings-category"><span><strong>Métodos de pago y bancos</strong><small>Vincula cobros y pagos con cuentas del catálogo contable.</small></span><span aria-hidden="true">→</span></Link>
      <Link to="/settings/controls" className="settings-category"><span><strong>Fiscal, contabilidad e inventario</strong><small>CAI, periodos, decimales, bodegas, costos y conciliación.</small></span><span aria-hidden="true">→</span></Link>
      {grants?.some((grant) => grant.module === 'documents') ? <Link to="/settings/templates" className="settings-category"><span><strong>Plantillas de documentos</strong><small>Versiones, logo, papel y presentación de los formatos.</small></span><span aria-hidden="true">→</span></Link> : null}
      <Link to="/settings/assistant" className="settings-category"><span><strong>Asistente con IA</strong><small>Proveedor, modelo y clave del chat embebido.</small></span><span aria-hidden="true">→</span></Link>
      <Link to="/settings/integrations" className="settings-category"><span><strong>Integraciones MCP</strong><small>Credenciales, conectores e historial de uso.</small></span><span aria-hidden="true">→</span></Link>
    </div> : null}
    {section === 'users' ? <>
    <ServerTable tableKey="company-users" companyId={companyId} columns={[
      { key: 'name', label: 'Nombre' }, { key: 'email', label: 'Correo' }, { key: 'role', label: 'Rol' },
      { key: 'status', label: 'Estado' }, { key: 'access', label: 'Acceso' }, ...(canEdit ? [{ key: 'actions', label: 'Acción' }] : []),
    ]} queryKey="settings-users" empty="No hay usuarios para mostrar." searchHint="Buscar usuario o correo"
      load={loadUsers} rowActions={canEdit ? (id) => {
        const user = users.data?.find((item) => item.id === id)
        if (!user) return []
        if (user.role !== 'operator') return [{ label: 'Ver usuario', onSelect: () => openUser(id) }]
        return [
          { label: 'Permisos por módulo', onSelect: () => openUser(id, 'permissions'), disabled: !isOwner },
          { label: user.active ? 'Deshabilitar acceso' : 'Habilitar acceso', onSelect: () => openUser(id, 'status'), danger: user.active },
        ]
      } : undefined} />
    <div className="settings-grid">
      {canEdit ? <Panel title="Crear empleado"><p className="muted">Se crea con permisos operativos iniciales. El dueño puede ajustarlos después.</p>
        <form className="settings-form" onSubmit={(event) => void createUser(event)}>
          <label className="field">Nombre<input name="name" required maxLength={200} /></label>
          <label className="field">Correo<input name="email" type="email" required /></label>
          <label className="field">Clave inicial<input name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} required autoComplete="new-password" /></label>
          <div className="settings-inline-actions"><Button type="button" variant="quiet" onClick={() => { setPassword(generatePassword()); setShowPassword(true); setCreatedPassword(null) }}>Generar clave segura</Button><Button type="button" variant="quiet" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Ocultar clave' : 'Mostrar clave'}</Button></div>
          <Button type="submit" disabled={busy}>Crear usuario</Button>
        </form>
        {createdPassword ? <div className="settings-credential" role="status"><strong>Clave de {createdPassword.email}</strong><p>Entrégala por un canal seguro. Se muestra aquí solo hasta salir de esta página.</p><code>{createdPassword.password}</code><Button type="button" variant="quiet" onClick={() => void navigator.clipboard.writeText(createdPassword.password)}>Copiar clave</Button><Button type="button" variant="quiet" onClick={() => setCreatedPassword(null)}>Ocultar</Button></div> : null}
      </Panel> : null}
      <Panel title="Clave de mi cuenta"><p className="muted">Al cambiarla se cerrarán tus sesiones abiertas.</p>
        <form className="settings-form" onSubmit={(event) => { event.preventDefault(); if (!userId) return; const form = event.currentTarget;
          const data = new FormData(form); void run(() => changeOwnPassword(userId, String(data.get('current')), String(data.get('next'))), 'Clave cambiada. Inicia sesión de nuevo.').then((saved) => { if (saved) { form.reset(); signOut() } }) }}>
          <label className="field">Clave actual<input name="current" type="password" required autoComplete="current-password" /></label>
          <label className="field">Nueva clave<input name="next" type="password" minLength={12} required autoComplete="new-password" /></label>
          <Button type="submit" disabled={busy || !userId}>Cambiar clave</Button>
        </form>
      </Panel>
    </div>
    </> : null}
    {section === 'prices' ? <Panel title="Responsable de precios"><p className="muted">El dueño y la persona designada pueden cambiar precios inmediatamente. Los demás envían propuestas.</p>
        {price.isPending ? <ListSkeleton rows={2} label="Cargando responsables de precios…" /> : null}
        {price.isError ? <div className="table-load-error" role="alert"><p>Necesitas acceso al módulo de precios para ver esta opción o no se pudo cargar.</p><Button type="button" variant="quiet" onClick={() => void price.refetch()}>{'Reintentar'}</Button></div> : null}
        {price.data ? <form className="settings-form" onSubmit={(event) => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get('approver') ?? '');
          void run(() => designatePriceApprover(value || null), 'Responsable actualizado.') }}>
          <label className="field">Aprobador designado<select name="approver" key={price.data.designatedApproverId ?? ''} defaultValue={price.data.designatedApproverId ?? ''} disabled={!isOwner}>
            <option value="">Solo el dueño</option>{price.data.approvers.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}
          </select></label>
          {isOwner ? <Button type="submit" disabled={busy}>Guardar responsable</Button> : null}
        </form> : null}
      </Panel> : null}
    {section === 'documents' ? <Panel title="Encargado de anulaciones"><p className="muted">Las anulaciones requieren un motivo y aprobación. El solicitante no puede aprobar su propia solicitud. El traslado bancario relacionado permanece intacto.</p>
      {voucherVoidSettings.isPending ? <ListSkeleton rows={2} label="Cargando responsables de anulaciones…" /> : null}
      {voucherVoidSettings.isError ? <div className="table-load-error" role="alert"><p>No se pudo leer la configuración.</p><Button type="button" variant="quiet" onClick={() => void voucherVoidSettings.refetch()}>Reintentar</Button></div> : null}
      {voucherVoidSettings.data ? <form className="settings-form" onSubmit={(event) => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get('voidApprover') ?? ''); void run(() => designateVoucherVoidApprover(value || null), 'Encargado actualizado.') }}>
        <label className="field">Aprobador designado<select name="voidApprover" key={voucherVoidSettings.data.designatedApproverId ?? ''} defaultValue={voucherVoidSettings.data.designatedApproverId ?? ''} disabled={!isOwner}>
          <option value="">Solo el dueño</option>{voucherVoidSettings.data.approvers.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}
        </select></label>
        {isOwner ? <Button type="submit" disabled={busy}>Guardar encargado</Button> : null}
      </form> : null}
      </Panel> : null}
    {section === 'assistant' ? <Panel title="Asistente con IA"><p className="muted">La clave se guarda cifrada para esta empresa. Solo se muestran sus últimos cuatro caracteres. Gemini y Anthropic pueden leer PDF; OpenAI analiza imágenes.</p>
        {ai.isPending ? <ListSkeleton rows={3} label="Cargando configuración del asistente…" /> : null}
        {ai.isError ? <div className="table-load-error" role="alert"><p>No se pudo leer la configuración del asistente.</p><Button type="button" variant="quiet" onClick={() => void ai.refetch()}>Reintentar</Button></div> : null}
        {ai.data ? <AiForm settings={ai.data} canEdit={canEdit} busy={busy} onSubmit={saveAi} /> : null}
      </Panel> : null}
    {section === 'payments' ? <Panel title="Métodos de pago y cuentas bancarias"><p className="muted">Los cobros de ventas y pagos de compras toman las cuentas asignadas aquí. Los valores precargados son ficticios para desarrollo.</p>
      {payments.isPending ? <ListSkeleton rows={3} label="Cargando métodos y cuentas bancarias…" /> : null}
      {payments.isError ? <div className="table-load-error" role="alert"><p>No se pudo cargar la configuración de pagos.</p><Button type="button" variant="quiet" onClick={() => void payments.refetch()}>Reintentar</Button></div> : null}
      {payments.data && companyId ? <PaymentSettingsForm key={companyId} settings={payments.data.settings} accounts={payments.data.accounts} busy={busy} onSubmit={(next) => run(() => savePaymentSettings(companyId, next), 'Configuración de pagos guardada.')} /> : null}
      </Panel> : null}
    {section === 'controls' ? <CompanyControlsPanel /> : null}
    {section === 'users' ? <dialog ref={userDialog} className="dialog settings-dialog" aria-labelledby="user-settings-title">
      <div><div className="settings-dialog-header"><span><h2 id="user-settings-title">{selected?.displayName}</h2><p>{selected?.email}</p></span><button type="button" className="settings-dialog-close" aria-label="Cerrar" onClick={() => userDialog.current?.close()}>×</button></div>
        {selected?.role === 'operator' && canEdit && userDialogMode === 'status' ? <div className="settings-status-action"><p>{selected.active ? 'Este usuario perderá acceso a la empresa y sus tokens MCP dejarán de funcionar.' : 'Este usuario recuperará acceso según sus permisos actuales.'}</p><Button type="button" variant="quiet" disabled={busy} onClick={() => {
          if (!selected) return; void run(() => setCompanyUserActive(selected.id, !selected.active), selected.active ? 'Usuario deshabilitado.' : 'Usuario habilitado.').then((saved) => { if (saved) userDialog.current?.close() })
        }}>{selected.active ? 'Deshabilitar acceso' : 'Habilitar acceso'}</Button></div> : null}
        {selected?.role === 'operator' && isOwner && userDialogMode === 'permissions' ? <form className="settings-grants" onSubmit={(event) => void saveGrants(event)}>
          <h3>Permisos por módulo</h3><p className="muted">La configuración solo puede delegarla el dueño.</p>
          {COMPANY_MODULES.map((module) => <label key={module}><span>{moduleNames[module]}</span><select name={module} defaultValue={selected.grants.find((grant) => grant.module === module)?.access ?? 'none'}>
            <option value="none">Sin acceso</option><option value="view">Ver</option><option value="edit">Editar</option>
          </select></label>)}
          <Button type="submit" disabled={busy}>Guardar permisos</Button>
        </form> : null}
        <div className="dialog-actions"><Button type="button" variant="quiet" onClick={() => userDialog.current?.close()}>Cerrar</Button></div>
      </div>
    </dialog> : null}
  </div>
}

function AiForm({ settings, canEdit, busy, onSubmit }: { settings: AiSettings; canEdit: boolean; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> }) {
  const [provider, setProvider] = useState(settings.provider)
  const [model, setModel] = useState(settings.model)
  return <form className="settings-form ai-settings-form" onSubmit={(event) => void onSubmit(event)}>
    <div className={`ai-settings-status${settings.configured ? ' ai-settings-status--ready' : ''}`} role="status">
      <span className="ai-settings-indicator" aria-hidden="true" />
      <span><strong>{settings.configured ? 'Conexión configurada' : 'Falta configurar la conexión'}</strong>
        <small>{settings.configured ? `Clave cifrada ····${settings.keyHint}` : 'La clave se guarda cifrada y nunca vuelve a mostrarse.'}</small></span>
    </div>
    <label className="field">Proveedor<select name="provider" value={provider} disabled={!canEdit} onChange={(event) => { const value = event.target.value as AiSettings['provider']; setProvider(value); setModel(modelOptions[value][0].value) }}>
      <option value="gemini">Google Gemini</option><option value="anthropic">Anthropic Claude</option><option value="openai">OpenAI</option>
    </select></label>
    <label className="field">Modelo<select name="model" value={model} onChange={(event) => setModel(event.target.value)} disabled={!canEdit} required>
      {!modelOptions[provider].some((option) => option.value === model) && model ? <option value={model}>{model} · modelo configurado anteriormente</option> : null}
      {modelOptions[provider].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select></label>
    <label className="field">Clave de API<input name="apiKey" type="password" autoComplete="new-password" spellCheck={false} placeholder={settings.configured ? 'Déjalo vacío para conservar la clave actual' : 'Pega aquí la clave del proveedor'} aria-describedby="ai-key-help" disabled={!canEdit} /></label>
    <small id="ai-key-help" className="ai-settings-help">Por seguridad, la clave guardada no se puede consultar. Solo se reemplaza si escribes una nueva.</small>
    {canEdit ? <div className="ai-settings-actions"><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar conexión'}</Button></div> : null}
  </form>
}

function PaymentSettingsForm({ settings, accounts, busy, onSubmit }: { settings: PaymentSettings; accounts: PaymentAccount[]; busy: boolean; onSubmit: (settings: PaymentSettings) => Promise<boolean> }) {
  const [draft, setDraft] = useState(settings)
  useEffect(() => { setDraft(settings) }, [settings])
  const collectionAccounts = accounts.filter((account) => account.postable && account.collection)
  const paymentAccounts = accounts.filter((account) => account.postable && (account.kind === 'asset' || account.code === '2.01.01.001'))
  const bankAccounts = accounts.filter((account) => account.postable && account.kind === 'asset' && !account.collection)

  function updateMethod(id: string, patch: Partial<PaymentSettings['paymentMethods'][number]>): void {
    setDraft((current) => ({ ...current, paymentMethods: current.paymentMethods.map((method) => method.id === id ? { ...method, ...patch } : method) }))
  }

  function updateBank(id: string, patch: Partial<PaymentSettings['bankAccounts'][number]>): void {
    setDraft((current) => ({ ...current, bankAccounts: current.bankAccounts.map((bank) => bank.id === id ? { ...bank, ...patch } : bank) }))
  }

  return <form className="payment-settings-form" onSubmit={(event) => { event.preventDefault(); void onSubmit(draft) }}>
    <div className="payment-settings-heading"><div><h3>Métodos de pago</h3><p>Selecciona qué cuenta recibe una venta y cuál se acredita al registrar una compra.</p></div><Button type="button" variant="quiet" onClick={() => setDraft((current) => ({ ...current, paymentMethods: [...current.paymentMethods, { id: crypto.randomUUID(), name: 'Nuevo método', kind: 'cash', collectionAccountCode: collectionAccounts[0]?.code ?? null, paymentAccountCode: paymentAccounts[0]?.code ?? null, active: true }] }))}>Agregar método</Button></div>
    <div className="payment-settings-list">
      {draft.paymentMethods.map((method) => <fieldset className="payment-settings-row" key={method.id}>
        <label className="field">Nombre<input value={method.name} onChange={(event) => updateMethod(method.id, { name: event.target.value })} maxLength={120} required /></label>
        <label className="field">Tipo<select value={method.kind} onChange={(event) => updateMethod(method.id, { kind: event.target.value as PaymentSettings['paymentMethods'][number]['kind'] })}><option value="cash">Efectivo</option><option value="card">Tarjeta / POS</option><option value="bank-transfer">Transferencia</option><option value="supplier-credit">Crédito de proveedor</option></select></label>
        <label className="field">Cobros de venta<select value={method.collectionAccountCode ?? ''} onChange={(event) => updateMethod(method.id, { collectionAccountCode: event.target.value || null })}><option value="">No disponible</option>{collectionAccounts.map((account) => <option key={account.code} value={account.code}>{account.code} · {account.name}</option>)}</select></label>
        <label className="field">Pagos de compra<select value={method.paymentAccountCode ?? ''} onChange={(event) => updateMethod(method.id, { paymentAccountCode: event.target.value || null })}><option value="">No disponible</option>{paymentAccounts.map((account) => <option key={account.code} value={account.code}>{account.code} · {account.name}</option>)}</select></label>
        <label className="payment-settings-active"><input type="checkbox" checked={method.active} onChange={(event) => updateMethod(method.id, { active: event.target.checked })} /> Activo</label>
        <Button type="button" variant="quiet" aria-label={`Quitar método ${method.name}`} onClick={() => setDraft((current) => ({ ...current, paymentMethods: current.paymentMethods.filter((item) => item.id !== method.id) }))}>Quitar</Button>
      </fieldset>)}
    </div>
    <div className="payment-settings-heading payment-settings-heading--banks"><div><h3>Cuentas bancarias ficticias</h3><p>Se usan para conciliar cobros y pagos con el mayor contable.</p></div><Button type="button" variant="quiet" onClick={() => setDraft((current) => ({ ...current, bankAccounts: [...current.bankAccounts, { id: crypto.randomUUID(), bankName: '', accountName: '', maskedNumber: '•••• 0000', currency: 'HNL', accountCode: bankAccounts[0]?.code ?? '', active: true }] }))}>Agregar banco</Button></div>
    <div className="payment-settings-list">
      {draft.bankAccounts.map((bank) => <fieldset className="payment-settings-row payment-settings-row--bank" key={bank.id}>
        <label className="field">Banco<input value={bank.bankName} onChange={(event) => updateBank(bank.id, { bankName: event.target.value })} maxLength={120} required /></label>
        <label className="field">Nombre de cuenta<input value={bank.accountName} onChange={(event) => updateBank(bank.id, { accountName: event.target.value })} maxLength={120} required /></label>
        <label className="field">Número protegido<input value={bank.maskedNumber} onChange={(event) => updateBank(bank.id, { maskedNumber: event.target.value })} maxLength={32} required /></label>
        <label className="field">Cuenta contable<select value={bank.accountCode} onChange={(event) => updateBank(bank.id, { accountCode: event.target.value })} required>{bankAccounts.map((account) => <option key={account.code} value={account.code}>{account.code} · {account.name}</option>)}</select></label>
        <label className="payment-settings-active"><input type="checkbox" checked={bank.active} onChange={(event) => updateBank(bank.id, { active: event.target.checked })} /> Activa</label>
        <Button type="button" variant="quiet" aria-label={`Quitar cuenta ${bank.bankName || 'bancaria'}`} onClick={() => setDraft((current) => ({ ...current, bankAccounts: current.bankAccounts.filter((item) => item.id !== bank.id) }))}>Quitar</Button>
      </fieldset>)}
    </div>
    <div className="payment-settings-footer"><p>Los documentos de desarrollo todavía no registran retenciones ni notas contra cuentas. Se conservan como documentos hasta definir la dirección y aprobación de cada ajuste.</p><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar configuración'}</Button></div>
  </form>
}
