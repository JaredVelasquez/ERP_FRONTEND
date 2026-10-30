import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/app/providers/session'
import { Button } from '@/shared/ui/button'
import { IconAction } from '@/shared/ui/icon-action'
import { DevNote, PageIntro, Panel } from '@/shared/ui/ops'
import { ListSkeleton } from '@/shared/ui/skeleton'
import { ItemPickerResults } from '@/shared/ui/item-picker-results'
import { listCatalog, type CatalogPresentation, type CatalogProduct } from '@/modules/products/api'
import { createBusinessDocument, documentTypes, listBusinessDocuments, listTemplates, type BusinessDocument, type DocumentTemplate, type DocumentType } from '../api'
import type { TemplateCanvasData } from '../types'
import { TemplateCanvasPreview, type TemplateRenderContext } from './template-canvas'
import './document-center.css'

type Line = { product: CatalogProduct; presentationUnit: string; quantity: number }
const money = (value: number) => new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(value)
const date = (value: string) => new Intl.DateTimeFormat('es-HN', { dateStyle: 'medium' }).format(new Date(value))

export function DocumentCenterPage({ embedded = false, allowedTypes = documentTypes.map((item) => item.value), initialType }: { embedded?: boolean; allowedTypes?: readonly DocumentType[]; initialType?: DocumentType }) {
  const { companyId, companyName } = useSession()
  const queryClient = useQueryClient()
  const defaultType = allowedTypes.includes(initialType ?? 'proforma') ? initialType ?? 'proforma' : allowedTypes[0] ?? 'proforma'
  const [type, setType] = useState<DocumentType>(defaultType)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientReference, setRecipientReference] = useState('')
  const [notes, setNotes] = useState('')
  const [reviewRequested, setReviewRequested] = useState(false)
  const [view, setView] = useState<'create' | 'history'>('create')
  const formRef = useRef<HTMLFormElement>(null)
  const templates = useQuery({ queryKey: ['business-document-templates', companyId], queryFn: listTemplates, enabled: Boolean(companyId) })
  const documents = useQuery({ queryKey: ['business-documents', companyId], queryFn: listBusinessDocuments, enabled: Boolean(companyId) })
  const purchaseDocument = type === 'requisition' || type === 'purchase_request' || type === 'purchase_order'
  const catalog = useQuery({
    queryKey: ['document-catalog-search', companyId, catalogSearch],
    queryFn: () => listCatalog(companyId ?? '', { page: 1, pageSize: 12, search: catalogSearch.trim(), sort: '', itemType: 'all' }),
    enabled: Boolean(companyId) && catalogSearch.trim().length >= 2,
  })
  const catalogItems = (catalog.data?.items ?? []).filter((product) => product.active && product.presentations.some((presentation) => catalogPrice(presentation, purchaseDocument) !== null))
  const visibleTypes = documentTypes.filter((item) => allowedTypes.includes(item.value))
  const usableTemplates = useMemo(() => (templates.data ?? [])
    .filter((item) => item.documentType === type && item.status === 'published')
    .sort((left, right) => Date.parse(right.publishedAt ?? right.createdAt) - Date.parse(left.publishedAt ?? left.createdAt) || right.version - left.version), [templates.data, type])
  const selectedTemplate = usableTemplates.find((template) => template.id === selectedTemplateId) ?? usableTemplates[0] ?? null
  const selected = selectedId === null ? null : documents.data?.find((document) => document.id === selectedId) ?? null
  useEffect(() => {
    if (!usableTemplates.some((template) => template.id === selectedTemplateId)) setSelectedTemplateId(usableTemplates[0]?.id ?? '')
  }, [selectedTemplateId, usableTemplates])
  const create = useMutation({
    mutationFn: (form: HTMLFormElement) => {
      const data = new FormData(form)
      return createBusinessDocument({
        idempotencyKey: crypto.randomUUID(), templateId: String(data.get('templateId')), documentType: type,
        recipientName: String(data.get('recipientName') ?? ''), recipientReference: String(data.get('recipientReference') ?? ''),
        details: { department: String(data.get('department') ?? ''), requestedBy: String(data.get('requestedBy') ?? ''), requiredDate: String(data.get('requiredDate') ?? ''), deliveryDate: String(data.get('deliveryDate') ?? ''), relatedDocumentNumber: String(data.get('relatedDocumentNumber') ?? ''), reason: String(data.get('reason') ?? ''), originWarehouse: String(data.get('originWarehouse') ?? ''), destinationWarehouse: String(data.get('destinationWarehouse') ?? ''), withholdingRate: data.has('withholdingRate') ? Number(data.get('withholdingRate')) : null },
        notes: String(data.get('notes') ?? ''),
        lines: lines.map((line) => ({ productId: line.product.id, presentationUnit: line.presentationUnit, quantity: Number(line.quantity) })),
      })
    },
    onSuccess: async (document) => { setNotice('Documento de desarrollo creado. No afecta inventario ni contabilidad.'); setSelectedId(document.id); setReviewRequested(false); setView('history'); setLines([]); await queryClient.invalidateQueries({ queryKey: ['business-documents', companyId] }) },
    onError: (error) => setNotice(error instanceof Error ? error.message : 'No se pudo crear el documento.'),
  })
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setReviewRequested(true); setNotice('Revisa el formato completo y confirma la emisión desde la vista previa.') }
  function confirmReviewedDocument(): void {
    const form = formRef.current
    if (form === null || !form.reportValidity()) return
    create.mutate(form)
  }
  const typeLabel = (value: string) => documentTypes.find((item) => item.value === value)?.label ?? value
  function addCatalogLine(product: CatalogProduct, presentationUnit: string): void {
    setLines((current) => {
      const existingIndex = current.findIndex((line) => line.product.id === product.id && line.presentationUnit === presentationUnit)
      if (existingIndex < 0) return [...current, { product, presentationUnit, quantity: 1 }]
      return current.map((line, index) => index === existingIndex ? { ...line, quantity: line.quantity + 1 } : line)
    })
  }

  return <div className={`ops-page document-center-page${embedded ? ' document-center-page--embedded' : ''}`}>
    {!embedded ? <PageIntro title="Documentos comerciales" description={`Crea y consulta formatos de ${companyName ?? 'tu empresa'} con plantillas de marca.`} action={<Link className="button button--secondary" to="/settings/templates">Administrar plantillas</Link>} /> : null}
    <DevNote>Entorno de desarrollo: los documentos muestran una marca “NO VÁLIDO” y no generan obligaciones fiscales, movimientos de inventario ni asientos.</DevNote>
    {notice ? <p role="status" className="dc-notice">{notice}</p> : null}
    <div className="dc-view-switch" role="tablist" aria-label="Vista de documentos comerciales"><button type="button" role="tab" aria-selected={view === 'create'} onClick={() => setView('create')}>Nuevo documento</button><button type="button" role="tab" aria-selected={view === 'history'} onClick={() => setView('history')}>Historial <span>{documents.data?.length ?? 0}</span></button></div>
    {view === 'create' ? <ol className="dc-operation-progress" aria-label="Progreso del documento"><li className="is-complete"><span>1</span><strong>Tipo</strong></li><li className={reviewRequested ? 'is-complete' : 'is-current'}><span>2</span><strong>Datos y artículos</strong></li><li className={reviewRequested ? 'is-current' : ''}><span>3</span><strong>Revisar y confirmar</strong></li></ol> : null}
    {view === 'create' && !reviewRequested ? <div className="dc-type-grid" aria-label="Tipo de documento">
      {visibleTypes.map((item) => <button type="button" key={item.value} className={`dc-type-card${type === item.value ? ' is-active' : ''}`} aria-pressed={type === item.value} onClick={() => { setType(item.value); setLines([]); setReviewRequested(false); setNotice('') }}><span>{item.label}</span><small>{documentActionHint(item.value)} · {(documents.data ?? []).filter((doc) => doc.documentType === item.value).length} creados</small></button>)}
    </div> : null}
    <div className={`dc-layout dc-layout--${view}`}>
      <div hidden={view !== 'create' || reviewRequested}><Panel title={`Nuevo ${typeLabel(type).toLocaleLowerCase()}`}>
        {templates.isPending ? <ListSkeleton rows={3} label="Cargando plantillas" /> : null}
        {templates.isError ? <p role="alert">No se pudieron cargar plantillas. <button type="button" onClick={() => void templates.refetch()}>Reintentar</button></p> : null}
        {!templates.isPending && usableTemplates.length === 0 ? <div className="dc-empty-template"><p>Este tipo todavía no tiene una plantilla publicada.</p><Link to="/settings/templates">Preparar plantilla</Link></div> : null}
        {usableTemplates.length > 0 ? <form ref={formRef} className="dc-form" onSubmit={submit}>
          <details className="dc-format-options"><summary>Opciones de formato</summary><label className="field">Plantilla<select name="templateId" value={selectedTemplate?.id ?? ''} onChange={(event) => setSelectedTemplateId(event.target.value)} required>{usableTemplates.map((template) => <option key={template.id} value={template.id}>{template.name} · v{template.version} · {template.pageSize}</option>)}</select></label><small>Se usa automáticamente la versión publicada más reciente.</small></details>
          <div className="dc-fields-two"><label className="field">Cliente o proveedor<input name="recipientName" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} required maxLength={200} placeholder="Nombre de la entidad" /></label><label className="field">RTN o referencia<input name="recipientReference" value={recipientReference} onChange={(event) => setRecipientReference(event.target.value)} maxLength={120} placeholder="Opcional" /></label></div>
          <DocumentSpecificFields type={type} />
          <section className="dc-catalog-picker" aria-label="Seleccionar artículos del catálogo">
            <div className="dc-line-head"><div><h3>Productos y servicios</h3><p>Los artículos, precios, costos e impuestos se toman del catálogo.</p></div></div>
            <label className="field">Buscar producto o servicio<input type="search" value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Nombre, proveedor o código" /></label>
            {catalogSearch.trim().length < 2 ? <p className="muted">Escribe al menos dos caracteres para buscar en el catálogo.</p> : null}
            {catalog.isPending && catalogSearch.trim().length >= 2 ? <ListSkeleton rows={2} label="Buscando artículos" /> : null}
            {catalog.isError ? <p role="alert">No se pudo consultar el catálogo. <button type="button" onClick={() => void catalog.refetch()}>Reintentar</button></p> : null}
            {catalog.data && catalogItems.length === 0 ? <p className="muted">No hay coincidencias con precio vigente para este tipo de documento.</p> : null}
            {catalogItems.length > 0 ? <div className="dc-catalog-results"><ItemPickerResults options={catalogItems.flatMap((product) => {
              const presentation = product.presentations.find((item) => catalogPrice(item, purchaseDocument) !== null)
              if (!presentation) return []
              return [{ id: product.id, name: product.name, details: `${product.itemType === 'service' ? 'Servicio' : 'Producto'} · ${product.supplier || product.category || 'Sin proveedor'} · Código ${product.barcode || '—'}`, value: `${money(catalogPrice(presentation, purchaseDocument) ?? 0)} / ${presentation.unit}` }]
            })} onSelect={(productId) => {
              const product = catalogItems.find((item) => item.id === productId)
              const presentation = product?.presentations.find((item) => catalogPrice(item, purchaseDocument) !== null)
              if (product && presentation) addCatalogLine(product, presentation.unit)
            }} /></div> : null}
          </section>
          <div className="dc-line-head"><h3>Detalle del documento</h3><span>{lines.length} artículos</span></div>
          {lines.length === 0 ? <p className="dc-empty-lines">Busca y agrega artículos del catálogo para continuar.</p> : null}
          {lines.map((line, index) => {
            const presentations = line.product.presentations.filter((presentation) => catalogPrice(presentation, purchaseDocument) !== null)
            const presentation = presentations.find((item) => item.unit === line.presentationUnit) ?? presentations[0]
            return <div className="dc-document-line" key={`${line.product.id}:${index}`}>
              <div className="dc-document-line-name"><strong>{line.product.name}</strong><small>{line.product.itemType === 'service' ? 'Servicio' : 'Producto'} · {line.product.taxCategoryCode}</small></div>
              <label className="field">Presentación<select value={presentation?.unit ?? ''} onChange={(event) => setLines((current) => current.map((entry, lineIndex) => lineIndex === index ? { ...entry, presentationUnit: event.target.value } : entry))}>{presentations.map((item) => <option key={item.unit} value={item.unit}>{item.unit}</option>)}</select></label>
              <label className="field">Cantidad<input type="number" min="0.0001" step="0.0001" value={line.quantity} onChange={(event) => setLines((current) => current.map((entry, lineIndex) => lineIndex === index ? { ...entry, quantity: Number(event.target.value) } : entry))} required /></label>
              <div className="dc-document-line-price"><small>Precio / costo del catálogo</small><strong>{money(catalogPrice(presentation, purchaseDocument) ?? 0)}</strong></div>
              <button type="button" className="dc-remove-line" aria-label={`Quitar ${line.product.name}`} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>×</button>
            </div>
          })}
          <label className="field">Notas<input name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} placeholder="Condiciones u observaciones" /></label>
          <Button type="submit" disabled={create.isPending || lines.length === 0}>{create.isPending ? 'Procesando…' : `Revisar ${documentSubmitLabel(type).toLocaleLowerCase()}`}</Button>
        </form> : null}
      </Panel></div>
      <div hidden={view !== 'history'}><Panel title="Documentos recientes">
        {documents.isPending ? <ListSkeleton rows={4} label="Cargando documentos" /> : null}
        {documents.isError ? <p role="alert">No se pudo cargar el historial. <button type="button" onClick={() => void documents.refetch()}>Reintentar</button></p> : null}
        {!documents.isPending && (documents.data?.length ?? 0) === 0 ? <p className="muted">Aún no hay documentos generados.</p> : null}
        <div className="dc-document-list">{documents.data?.map((document) => <button type="button" key={document.id} className={`dc-document-row${selected?.id === document.id ? ' is-selected' : ''}`} onClick={() => setSelectedId(document.id)}><span><strong>{document.snapshot.recipientName}</strong><small>{typeLabel(document.documentType)} · {document.documentNumber}</small></span><span><strong>{money(document.snapshot.total)}</strong><small>{date(document.createdAt)}</small></span></button>)}</div>
      </Panel></div>
    </div>
    {view === 'create' && reviewRequested && selectedTemplate && lines.length > 0 ? <DraftDocumentPreview type={type} template={selectedTemplate} companyName={companyName ?? ''} recipientName={recipientName} recipientReference={recipientReference} notes={notes} lines={lines} purchaseDocument={purchaseDocument} pending={create.isPending} onBack={() => setReviewRequested(false)} onConfirm={confirmReviewedDocument} /> : null}
    {view === 'history' && selected ? <DocumentPreview document={selected} companyName={companyName ?? ''} companyLogoUrl={selected.snapshot.companyLogoUrl} onClose={() => setSelectedId(null)} /> : null}
  </div>
}

function DraftDocumentPreview({ type, template, companyName, recipientName, recipientReference, notes, lines, purchaseDocument, pending, onBack, onConfirm }: {
  type: DocumentType; template: DocumentTemplate; companyName: string; recipientName: string; recipientReference: string; notes: string; lines: readonly Line[]; purchaseDocument: boolean; pending: boolean; onBack: () => void; onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!dialogRef.current?.open) dialogRef.current?.showModal()
  }, [])
  const now = new Date().toISOString()
  const previewLines = lines.flatMap((line) => {
    const presentation = line.product.presentations.find((item) => item.unit === line.presentationUnit)
    const unitPrice = presentation ? catalogPrice(presentation, purchaseDocument) : null
    if (unitPrice === null) return []
    const amount = roundMoney(line.quantity * unitPrice)
    const taxRate = line.product.taxCategoryCode === 'isv15' ? 15 : line.product.taxCategoryCode === 'isv18' ? 18 : 0
    const taxAmount = roundMoney(amount * taxRate / 100)
    return [{ productId: line.product.id, itemType: line.product.itemType, description: line.product.name, presentationUnit: line.presentationUnit, quantity: line.quantity, unitPrice, amount, taxCategoryCode: line.product.taxCategoryCode, taxRate, taxAmount }]
  })
  const subtotal = roundMoney(previewLines.reduce((sum, line) => sum + line.amount, 0))
  const taxTotal = roundMoney(previewLines.reduce((sum, line) => sum + line.taxAmount, 0))
  const context: TemplateRenderContext = {
    companyName, companyLogoUrl: null, headerText: template.headerText, footerText: template.footerText, accentColor: template.accentColor,
    documentType: type, documentNumber: 'BORRADOR', issuedAt: now, recipientName: recipientName || 'Cliente o proveedor', recipientReference,
    details: [], lines: previewLines, subtotal, taxTotal, total: subtotal + taxTotal, notes,
  }
  const canvas = isTemplateCanvasData(template.layoutDefinition) && template.layoutDefinition.content.length > 0
  return <dialog ref={dialogRef} className="dc-preview-dialog" aria-labelledby="dc-draft-preview-title" onClose={onBack} onCancel={(event) => { if (pending) event.preventDefault() }}>
    <div className="dc-preview-dialog__shell">
      <header className="dc-preview-dialog__header"><div><h2 id="dc-draft-preview-title">Revisa el documento antes de emitir</h2><p>Vista previa con los datos actuales. Todavía no reserva numeración ni crea el documento.</p></div><IconAction icon="close" label="Cerrar vista previa y volver a editar" disabled={pending} onClick={() => dialogRef.current?.close()} /></header>
      <div className="dc-preview-dialog__viewport"><article className={`dc-paper dc-paper--${template.pageSize.toLocaleLowerCase()} dc-paper--${template.orientation}`} style={{ '--dc-accent': template.accentColor, '--dc-margin': `${template.marginMm}mm` } as React.CSSProperties}>
      <div className="dc-watermark">BORRADOR · ENTORNO DE DESARROLLO</div>
      {canvas ? <TemplateCanvasPreview data={template.layoutDefinition as TemplateCanvasData} context={context} /> : <>
        <header className="dc-paper-header"><span className="dc-logo-fallback">{companyName.slice(0, 1) || 'E'}</span><div><p>{companyName}</p><strong>{documentTypes.find((item) => item.value === type)?.label ?? type}</strong></div><aside><small>Número</small><strong>BORRADOR</strong><small>Fecha: {date(now)}</small></aside></header>
        <section className="dc-paper-recipient"><small>Preparado para</small><strong>{context.recipientName}</strong>{recipientReference ? <span>RTN / referencia: {recipientReference}</span> : null}</section>
        <table className="dc-paper-table"><thead><tr><th>Descripción</th><th>Presentación</th><th>Cantidad</th><th>Precio unitario</th><th>Impuesto</th><th>Importe</th></tr></thead><tbody>{previewLines.map((line, index) => <tr key={`${line.productId}-${index}`}><td>{line.description}</td><td>{line.presentationUnit}</td><td>{line.quantity}</td><td>{money(line.unitPrice)}</td><td>{line.taxRate}% · {money(line.taxAmount)}</td><td>{money(line.amount)}</td></tr>)}</tbody></table>
        <div className="dc-paper-totals"><p><span>Subtotal</span><strong>{money(subtotal)}</strong></p><p><span>Impuestos</span><strong>{money(taxTotal)}</strong></p><p className="dc-total"><span>Total</span><strong>{money(subtotal + taxTotal)}</strong></p></div>
        {notes ? <section className="dc-paper-notes"><strong>Notas</strong><p>{notes}</p></section> : null}
      </>}
      </article></div>
      <footer className="dc-preview-dialog__footer"><span><strong>Revisión obligatoria</strong><small>Al confirmar se reservará el número y se guardará exactamente este formato.</small></span><div className="dc-preview-confirm__actions"><Button type="button" variant="quiet" disabled={pending} onClick={onBack}>Volver a editar</Button><Button type="button" disabled={pending || recipientName.trim() === ''} onClick={onConfirm}>{pending ? 'Procesando…' : 'Confirmar y emitir documento'}</Button></div></footer>
    </div>
  </dialog>
}

function DocumentPreview({ document, companyName, companyLogoUrl, onClose }: { document: BusinessDocument; companyName: string; companyLogoUrl: string | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!dialogRef.current?.open) dialogRef.current?.showModal()
  }, [])
  const snapshot = document.snapshot
  const template = snapshot.template
  const displayedCompanyName = snapshot.companyName || companyName
  const resolvedLogoUrl = companyLogoUrl ?? (displayedCompanyName.toLocaleLowerCase().includes('michelle market') ? '/brand/michelle-market-dark.jpeg' : null)
  return <dialog ref={dialogRef} className="dc-preview-dialog" aria-labelledby="dc-document-preview-title" onClose={onClose}>
    <div className="dc-preview-dialog__shell">
      <header className="dc-preview-dialog__header"><div><h2 id="dc-document-preview-title">{document.documentNumber}</h2><p>Formato {template.pageSize} · {template.orientation === 'portrait' ? 'Vertical' : 'Horizontal'} · Plantilla v{document.templateVersion}</p></div><IconAction icon="close" label="Cerrar vista previa" onClick={() => dialogRef.current?.close()} /></header>
      <div className="dc-preview-dialog__viewport"><style>{`@media print { @page { size: ${template.pageSize} ${template.orientation}; margin: 0; } }`}</style>
      <article className={`dc-paper dc-paper--${template.pageSize.toLocaleLowerCase()} dc-paper--${template.orientation}`} style={{ '--dc-accent': template.accentColor, '--dc-margin': `${template.marginMm}mm` } as React.CSSProperties}>
      <div className="dc-watermark">NO VÁLIDO · ENTORNO DE DESARROLLO</div>
      {isTemplateCanvasData(template.layoutDefinition) && template.layoutDefinition.content.length > 0
        ? <TemplateCanvasPreview data={template.layoutDefinition} context={documentRenderContext(snapshot, displayedCompanyName, resolvedLogoUrl)} />
        : <LegacyDocumentLayout document={document} displayedCompanyName={displayedCompanyName} resolvedLogoUrl={resolvedLogoUrl} />}
      </article></div>
      <footer className="dc-preview-dialog__footer"><span><strong>Documento listo para consultar</strong><small>La impresión utiliza el tamaño y orientación configurados en la plantilla.</small></span><div className="dc-preview-confirm__actions"><Button type="button" variant="quiet" onClick={() => dialogRef.current?.close()}>Cerrar</Button><Button type="button" onClick={() => window.print()}>Imprimir / Guardar PDF</Button></div></footer>
    </div>
  </dialog>
}

function LegacyDocumentLayout({ document, displayedCompanyName, resolvedLogoUrl }: { document: BusinessDocument; displayedCompanyName: string; resolvedLogoUrl: string | null }) {
  const snapshot = document.snapshot
  const template = snapshot.template
  return <><header className="dc-paper-header">{template.includeLogo && resolvedLogoUrl ? <img src={resolvedLogoUrl} alt={`Logo de ${displayedCompanyName}`} /> : <span className="dc-logo-fallback">{displayedCompanyName.slice(0, 1) || 'E'}</span>}<div><p>{displayedCompanyName}</p><strong>{documentTypes.find((item) => item.value === snapshot.documentType)?.label ?? snapshot.documentType}</strong>{template.headerText ? <small>{template.headerText}</small> : null}</div><aside><small>Número</small><strong>{snapshot.documentNumber}</strong><small>Fecha: {date(snapshot.issuedAt)}</small></aside></header>
    <section className="dc-paper-recipient"><small>Preparado para</small><strong>{snapshot.recipientName}</strong>{snapshot.recipientReference ? <span>RTN / referencia: {snapshot.recipientReference}</span> : null}</section>
    {documentDetails(snapshot.details, snapshot.documentType).length > 0 ? <section className="dc-paper-details"><strong>Información del documento</strong><dl>{documentDetails(snapshot.details, snapshot.documentType).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section> : null}
    <table className="dc-paper-table"><thead><tr><th>Descripción</th><th>Presentación</th><th>Cantidad</th><th>Precio unitario</th><th>Impuesto</th><th>Importe</th></tr></thead><tbody>{snapshot.lines.map((line, index) => <tr key={`${line.productId ?? line.description}-${index}`}><td>{line.description}</td><td>{line.presentationUnit ?? ''}</td><td>{line.quantity}</td><td>{money(line.unitPrice)}</td><td>{line.taxRate ?? 0}% · {money(line.taxAmount ?? 0)}</td><td>{money(line.amount)}</td></tr>)}</tbody></table>
    <div className="dc-paper-totals"><h2>Resumen de importes</h2><p><span>Subtotal</span><strong>{money(snapshot.subtotal)}</strong></p><p><span>Impuestos</span><strong>{money(snapshot.taxTotal)}</strong></p><p className="dc-total"><span>Total</span><strong>{money(snapshot.total)}</strong></p></div>
    {snapshot.notes ? <section className="dc-paper-notes"><strong>Notas</strong><p>{snapshot.notes}</p></section> : null}<footer>{template.footerText || 'Documento de prueba. No constituye factura fiscal ni comprobante contable.'}</footer></>
}

function documentRenderContext(snapshot: BusinessDocument['snapshot'], companyName: string, companyLogoUrl: string | null): TemplateRenderContext {
  return {
    companyName: snapshot.companyName || companyName, companyLogoUrl, headerText: snapshot.template.headerText,
    footerText: snapshot.template.footerText, accentColor: snapshot.template.accentColor, documentType: snapshot.documentType,
    documentNumber: snapshot.documentNumber, issuedAt: snapshot.issuedAt, recipientName: snapshot.recipientName,
    recipientReference: snapshot.recipientReference, details: documentDetails(snapshot.details, snapshot.documentType).map(([label, value]) => ({ label, value })), lines: snapshot.lines, subtotal: snapshot.subtotal,
    taxTotal: snapshot.taxTotal, total: snapshot.total, notes: snapshot.notes,
  }
}

function isTemplateCanvasData(value: unknown): value is TemplateCanvasData {
  return typeof value === 'object' && value !== null && 'content' in value && Array.isArray(value.content) && 'root' in value
}

function catalogPrice(presentation: CatalogPresentation, purchaseDocument: boolean): number | null {
  return purchaseDocument ? presentation.referenceUnitCost : presentation.salePrice
}

function roundMoney(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100 }

function documentActionHint(type: DocumentType): string {
  if (type === 'proforma' || type === 'quotation') return 'Documento comercial; no registra venta'
  if (type === 'requisition' || type === 'purchase_request' || type === 'purchase_order') return 'No registra compra ni ingreso de stock'
  if (type === 'warehouse_transfer') return 'Solicitud; no mueve existencias'
  return 'Documento relacionado; no ajusta saldos'
}

function documentSubmitLabel(type: DocumentType): string {
  if (type === 'quotation') return 'Crear cotización';
  if (type === 'proforma') return 'Crear proforma';
  if (type === 'requisition') return 'Crear requisición';
  if (type === 'purchase_request') return 'Solicitar compra';
  if (type === 'purchase_order') return 'Emitir orden de compra';
  if (type === 'warehouse_transfer') return 'Registrar solicitud';
  if (type === 'credit_note') return 'Preparar nota de crédito';
  if (type === 'debit_note') return 'Preparar nota de débito';
  return 'Preparar comprobante de retención';
}

function DocumentSpecificFields({ type }: { type: string }) {
  if (type === 'requisition') return <div className="dc-fields-two"><label className="field">Área solicitante<input name="department" required maxLength={200} /></label><label className="field">Solicitado por<input name="requestedBy" maxLength={200} /></label><label className="field">Motivo<input name="reason" maxLength={200} /></label><label className="field">Fecha requerida<input name="requiredDate" type="date" /></label></div>
  if (type === 'purchase_request') return <div className="dc-fields-two"><label className="field">Área solicitante<input name="department" required maxLength={200} /></label><label className="field">Solicitado por<input name="requestedBy" maxLength={200} /></label><label className="field">Fecha requerida<input name="requiredDate" type="date" /></label><label className="field">Justificación<input name="reason" required maxLength={200} /></label></div>
  if (type === 'purchase_order') return <div className="dc-fields-two"><label className="field">Fecha de entrega esperada<input name="deliveryDate" type="date" required /></label><label className="field">Solicitud de compra relacionada<input name="relatedDocumentNumber" maxLength={200} placeholder="Referencia opcional" /></label></div>
  if (type === 'warehouse_transfer') return <><div className="dc-fields-two"><label className="field">Bodega de origen<input name="originWarehouse" required maxLength={200} /></label><label className="field">Bodega de destino<input name="destinationWarehouse" required maxLength={200} /></label></div><label className="field">Motivo del traslado<input name="reason" required maxLength={200} /></label><p className="dc-inline-note">Este formato registra una solicitud de traslado de prueba; no modifica las existencias.</p></>
  if (type === 'credit_note' || type === 'debit_note') return <div className="dc-fields-two"><label className="field">Factura/documento original<input name="relatedDocumentNumber" required maxLength={200} /></label><label className="field">Motivo del ajuste<input name="reason" required maxLength={200} /></label></div>
  if (type === 'withholding') return <div className="dc-fields-two"><label className="field">Factura/documento relacionado<input name="relatedDocumentNumber" required maxLength={200} /></label><label className="field">Tasa de retención de prueba (%)<input name="withholdingRate" type="number" min="0.01" max="100" step="0.01" required /></label></div>
  return null
}

function documentDetails(details: BusinessDocument['snapshot']['details'], type: string): [string, string][] {
  const values: [string, string][] = []
  if (details.department) values.push(['Área solicitante', details.department])
  if (details.requestedBy) values.push(['Solicitado por', details.requestedBy])
  if (details.requiredDate) values.push(['Fecha requerida', details.requiredDate])
  if (details.deliveryDate) values.push(['Entrega esperada', details.deliveryDate])
  if (details.relatedDocumentNumber) values.push([type === 'purchase_order' ? 'Solicitud relacionada' : 'Documento relacionado', details.relatedDocumentNumber])
  if (details.originWarehouse) values.push(['Bodega de origen', details.originWarehouse])
  if (details.destinationWarehouse) values.push(['Bodega de destino', details.destinationWarehouse])
  if (details.reason) values.push([type === 'credit_note' || type === 'debit_note' ? 'Motivo del ajuste' : 'Motivo', details.reason])
  if (details.withholdingRate !== null) values.push(['Tasa de retención de prueba', `${details.withholdingRate}%`])
  return values
}
