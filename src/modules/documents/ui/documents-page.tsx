import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/app/providers/session'
import { PageIntro, Panel } from '@/shared/ui/ops'
import { ServerTable } from '@/shared/ui/server-table'
import { ListSkeleton, Skeleton } from '@/shared/ui/skeleton'
import { fetchVoucherFile, listVoucherVoidRequests, listVouchers, requestVoucherVoid, resolveVoucherVoidRequest, uploadBankReceipt, type VoucherVoidRequest } from '../api'
import { voucherMessages } from '../messages'
import { VoucherForm } from './voucher-form'

const voucherColumns = [
  { key: 'reference', label: 'Referencia' }, { key: 'holder', label: 'Titular' }, { key: 'amount', label: 'Monto' },
  { key: 'occurredOn', label: 'Fecha' }, { key: 'status', label: 'Estado' }, { key: 'files', label: 'Archivos' }, { key: 'actions', label: 'Vista previa' },
] as const
type PreviewMode = 'voucher' | 'bank-receipt' | 'compare' | 'manage'
type PreviewFile = { url: string; type: string }

export function DocumentsPage() {
  const { companyId, userId } = useSession()
  const queryClient = useQueryClient()
  const previewDialog = useRef<HTMLDialogElement>(null)
  const voidDialog = useRef<HTMLDialogElement>(null)
  const [preview, setPreview] = useState<{ id: string; mode: PreviewMode } | null>(null)
  const [voidingVoucher, setVoidingVoucher] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidNotice, setVoidNotice] = useState('')
  const [files, setFiles] = useState<Partial<Record<'voucher' | 'bank-receipt', PreviewFile>>>({})
  const [previewError, setPreviewError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [refreshFiles, setRefreshFiles] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const voidQueue = useQuery({ queryKey: ['voucher-void-requests', companyId], queryFn: listVoucherVoidRequests, enabled: Boolean(companyId) })

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === previewDialog.current)
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  useEffect(() => {
    if (voidingVoucher) voidDialog.current?.showModal()
    if (!voidingVoucher && voidDialog.current?.open) voidDialog.current.close()
  }, [voidingVoucher])

  useEffect(() => {
    if (preview === null) {
      if (previewDialog.current?.open) previewDialog.current.close()
      return
    }
    if (!previewDialog.current?.open) previewDialog.current?.showModal()
    let active = true
    const urls: string[] = []
    setFiles({})
    setPreviewError('')
    const kinds = preview.mode === 'compare' ? ['voucher', 'bank-receipt'] as const : preview.mode === 'manage' ? [] : [preview.mode] as const
    setPreviewLoading(kinds.length > 0)
    void Promise.all(kinds.map(async (kind) => {
      try {
        const blob = await fetchVoucherFile(companyId ?? '', preview.id, kind)
        const url = URL.createObjectURL(blob)
        urls.push(url)
        if (active) setFiles((current) => ({ ...current, [kind]: { url, type: blob.type } }))
      } catch (error) {
        if (active) setPreviewError(error instanceof Error ? error.message : 'No se pudo abrir el archivo.')
      }
    })).finally(() => { if (active) setPreviewLoading(false) })
    return () => { active = false; urls.forEach((url) => URL.revokeObjectURL(url)) }
  }, [preview, companyId, refreshFiles])

  async function onReceiptUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (!file || !preview || !companyId) return
    setUploading(true)
    setPreviewError('')
    try {
      await uploadBankReceipt(companyId, preview.id, file)
      setPreview((current) => current === null ? null : { id: current.id, mode: 'bank-receipt' })
      setRefreshFiles((value) => value + 1)
      void queryClient.invalidateQueries({ queryKey: ['vouchers', companyId] })
    } catch (error) { setPreviewError(error instanceof Error ? error.message : 'No se pudo adjuntar el archivo.') }
    finally { setUploading(false); event.currentTarget.value = '' }
  }

  async function submitVoidRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!voidingVoucher) return
    try {
      await requestVoucherVoid(voidingVoucher, voidReason)
      setVoidNotice('Solicitud enviada a revisión.')
      setVoidingVoucher(null)
      await queryClient.invalidateQueries({ queryKey: ['voucher-void-requests', companyId] })
    } catch (error) { setVoidNotice(error instanceof Error ? error.message : 'No se pudo solicitar la anulación.') }
  }

  async function resolveVoid(request: VoucherVoidRequest, decision: 'approved' | 'rejected') {
    try {
      await resolveVoucherVoidRequest(request.id, decision, '')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['voucher-void-requests', companyId] }),
        queryClient.invalidateQueries({ queryKey: ['vouchers', companyId] }),
      ])
    } catch (error) { setVoidNotice(error instanceof Error ? error.message : 'No se pudo resolver la solicitud.') }
  }

  function previewActions(id: string, row?: { cells?: Record<string, string> }) {
    const hasVoucher = row?.cells?.hasVoucherFile === 'true'
    const hasBank = row?.cells?.hasBankReceipt === 'true'
    return [
      { label: 'Ver comprobante manual', onSelect: () => setPreview({ id, mode: 'voucher' }) },
      { label: 'Ver comprobante bancario del POS', disabled: !hasBank, onSelect: () => setPreview({ id, mode: 'bank-receipt' }) },
      { label: 'Comparar archivos', disabled: !hasVoucher || !hasBank, onSelect: () => setPreview({ id, mode: 'compare' }) },
      { label: 'Agregar comprobante bancario del POS', onSelect: () => setPreview({ id, mode: 'manage' }) },
      ...(row?.cells?.status === 'Anulado' || voidQueue.data?.requests.some((request) => request.voucherId === id && request.status === 'pending') ? [] : [
        { label: 'Solicitar anulación', danger: true, onSelect: () => { setVoidReason(''); setVoidNotice(''); setVoidingVoucher(id) } },
      ]),
    ]
  }

  return <div className="ops-page documents-page">
    <PageIntro title={voucherMessages.title} description={voucherMessages.description} />
    <VoucherForm companyId={companyId} onSigned={() => void queryClient.invalidateQueries({ queryKey: ['vouchers', companyId] })} />
    {voidNotice ? <p className="form-notice" role="status">{voidNotice}</p> : null}
    {voidQueue.isPending ? <Panel title="Solicitudes de anulación"><ListSkeleton rows={2} label="Cargando solicitudes de anulación…" /></Panel> : null}
    {voidQueue.isError ? <div className="table-load-error" role="alert"><p>No se pudieron cargar las solicitudes de anulación.</p><button type="button" className="ghost-button" onClick={() => void voidQueue.refetch()}>Reintentar</button></div> : null}
    {voidQueue.data && voidQueue.data.requests.length > 0 ? <section className="panel voucher-void-queue"><header><h2>{voidQueue.data.canReview ? 'Solicitudes de anulación' : 'Mis solicitudes de anulación'}</h2><p>{voidQueue.data.canReview ? 'Revisa el motivo y decide si se anula el comprobante.' : 'Consulta el estado de tus solicitudes.'}</p></header>
      {voidQueue.data.requests.map((request) => <article key={request.id}>
        <div><strong>{request.voucherReference}</strong><span>{request.requesterName} · {new Date(request.requestedAt).toLocaleString()}</span><p>{request.reason}</p></div>
        {request.status === 'pending' && voidQueue.data.canReview && request.requestedBy !== userId ? <div className="voucher-void-actions"><button type="button" onClick={() => void resolveVoid(request, 'approved')}>Aprobar anulación</button><button type="button" onClick={() => void resolveVoid(request, 'rejected')}>Rechazar</button></div> : <small>{voidRequestStatus(request.status)}{request.status === 'pending' ? ' · Esperando revisión' : ''}</small>}
      </article>)}
    </section> : null}
    <ServerTable tableKey="vouchers" companyId={companyId} columns={voucherColumns} queryKey="vouchers" empty="No hay comprobantes guardados."
      searchHint={voucherMessages.searchHint} load={(query) => listVouchers(companyId ?? '', query)} rowActions={previewActions} rowActionLabel="Abrir archivos"
      onRowAction={(id, row) => {
        const hasVoucher = row?.cells.hasVoucherFile === 'true'
        const hasBank = row?.cells.hasBankReceipt === 'true'
        const mode = hasVoucher && hasBank ? 'compare' : hasVoucher ? 'voucher' : hasBank ? 'bank-receipt' : 'manage'
        setPreview({ id, mode })
      }} />
    <dialog ref={voidDialog} className="dialog settings-dialog" aria-labelledby="void-request-title" onClose={() => setVoidingVoucher(null)}>
      <form className="settings-form" onSubmit={(event) => void submitVoidRequest(event)}>
        <header className="voucher-preview-header"><div><h2 id="void-request-title">Solicitar anulación</h2><p>Gerencia o el encargado designado revisará el motivo. El comprobante conservará sus datos.</p></div><button type="button" className="settings-dialog-close" onClick={() => setVoidingVoucher(null)} aria-label="Cerrar">×</button></header>
        <label className="field">Motivo de anulación<textarea value={voidReason} onChange={(event) => setVoidReason(event.target.value)} minLength={5} maxLength={500} required rows={4} placeholder="Explica por qué debe anularse este comprobante" /></label>
        {voidNotice ? <p role="alert">{voidNotice}</p> : null}
        <div className="dialog-actions"><button type="button" className="ghost-button" onClick={() => setVoidingVoucher(null)}>Cancelar</button><button type="submit" disabled={voidReason.trim().length < 5}>Enviar solicitud</button></div>
      </form>
    </dialog>
    <dialog ref={previewDialog} className="dialog voucher-preview-dialog" aria-labelledby="voucher-preview-title" onClose={() => setPreview(null)}>
      <header className="voucher-preview-header"><div><h2 id="voucher-preview-title">Comprobante manual y adjunto bancario</h2><p>El archivo POS se agrega al comprobante manual. Si ya había un adjunto POS, se actualiza solo ese archivo; el comprobante manual permanece intacto.</p></div><button type="button" className="settings-dialog-close" aria-label="Cerrar" onClick={() => setPreview(null)}>×</button></header>
      {preview?.mode !== 'manage' ? <nav className="voucher-preview-toolbar" aria-label="Modo de visualización">
        <button type="button" aria-pressed={preview?.mode === 'compare'} onClick={() => preview && setPreview({ ...preview, mode: 'compare' })}>Comparar ambos</button>
        <button type="button" aria-pressed={preview?.mode === 'voucher'} onClick={() => preview && setPreview({ ...preview, mode: 'voucher' })}>Solo comprobante manual</button>
        <button type="button" aria-pressed={preview?.mode === 'bank-receipt'} onClick={() => preview && setPreview({ ...preview, mode: 'bank-receipt' })}>Solo comprobante del POS</button>
        <button type="button" onClick={() => { if (fullscreen) void document.exitFullscreen(); else void previewDialog.current?.requestFullscreen() }}>{fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}</button>
      </nav> : null}
      <div className={preview?.mode === 'compare' ? 'voucher-preview-files is-split' : 'voucher-preview-files'}>
        {preview?.mode === 'compare' || preview?.mode === 'voucher' ? <PreviewPane label="Comprobante manual del ERP" file={files.voucher} loading={previewLoading} /> : null}
        {preview?.mode === 'compare' || preview?.mode === 'bank-receipt' ? <PreviewPane label="Comprobante bancario adicional del POS" file={files['bank-receipt']} loading={previewLoading} /> : null}
        {preview?.mode === 'manage' ? <div className="voucher-preview-empty"><strong>Agregar comprobante bancario del POS</strong><p>Se adjunta al comprobante manual para poder compararlos. Si ya había un archivo POS, se actualiza únicamente ese adjunto; el PDF manual permanece intacto.</p><small>PDF, JPG o PNG · hasta 12 MB</small></div> : null}
      </div>
      {previewError ? <p className="form-alert" role="status">{previewError}</p> : null}
      <div className="voucher-preview-actions"><label className="ui-button ui-button--quiet" aria-disabled={uploading}>{uploading ? 'Subiendo adjunto…' : 'Agregar comprobante bancario del POS'}<input type="file" accept="application/pdf,image/jpeg,image/png" disabled={uploading} onChange={(event) => void onReceiptUpload(event)} /></label><button type="button" className="ghost-button" onClick={() => setPreview(null)}>Cerrar</button></div>
    </dialog>
  </div>
}

function PreviewPane({ label, file, loading }: { label: string; file?: PreviewFile; loading: boolean }) {
  return <section className="voucher-preview-pane"><h3>{label}</h3>{file ? file.type.startsWith('image/') ? <img src={file.url} alt={label} /> : <iframe src={file.url} title={label} /> : loading ? <div className="voucher-file-loading" role="status" aria-label={`Cargando ${label}`}><Skeleton className="skeleton-block" /><Skeleton className="skeleton-line skeleton-line--short" /></div> : <p className="empty-row">El archivo no está disponible.</p>}</section>
}

function voidRequestStatus(status: VoucherVoidRequest['status']): string {
  if (status === 'approved') return 'Anulada'
  if (status === 'rejected') return 'Rechazada'
  return 'Pendiente'
}
