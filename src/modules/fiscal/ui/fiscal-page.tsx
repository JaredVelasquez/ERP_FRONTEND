import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useSession } from '@/app/providers/session'
import { Button } from '@/shared/ui/button'
import { IconAction } from '@/shared/ui/icon-action'
import { PageIntro, Panel } from '@/shared/ui/ops'
import { ListSkeleton } from '@/shared/ui/skeleton'
import { issueSandboxFiscalDocument, listEligibleSandboxSales, listSandboxFiscalDocuments, type EligibleSandboxSale, type SandboxFiscalDocument } from '../api'
import './fiscal-page.css'

const money = new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const date = new Intl.DateTimeFormat('es-HN', { dateStyle: 'medium', timeStyle: 'short' })

export interface FiscalPreviewModel {
  companyName: string
  companyLogoUrl: string | null
  headerText: string
  footerText: string
  accentColor: string
  documentType: 'invoice'
  documentNumber: string
  issuedAt: string
  recipientName: string
  recipientReference: string
  details: readonly { label: string; value: string }[]
  lines: readonly { productId: string; description: string; presentationUnit: string; quantity: number; unitPrice: number; amount: number; taxRate: number; taxAmount: number }[]
  subtotal: number
  taxTotal: number
  total: number
  notes: string
}

interface FiscalPageProps {
  embedded?: boolean
  initialSaleId?: string | null
  focusSaleOnly?: boolean
  renderDocument?: (document: FiscalPreviewModel, watermark: string) => ReactNode
}

export function FiscalPage({ embedded = false, initialSaleId = null, focusSaleOnly = false, renderDocument }: FiscalPageProps) {
  const { companyName, logoUrl } = useSession()
  const queryClient = useQueryClient()
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<SandboxFiscalDocument | null>(null)
  const [view, setView] = useState<'pending' | 'history'>('pending')
  const sales = useQuery({ queryKey: ['fiscal-sandbox', 'eligible-sales'], queryFn: listEligibleSandboxSales })
  const documents = useQuery({ queryKey: ['fiscal-sandbox', 'documents'], queryFn: listSandboxFiscalDocuments })
  const selectedSale = sales.data?.find((sale) => sale.id === selectedSaleId) ?? null

  useEffect(() => {
    if (initialSaleId && sales.data?.some((sale) => sale.id === initialSaleId)) {
      setSelectedSaleId(initialSaleId)
      return
    }
    if (selectedSaleId === null && (sales.data?.length ?? 0) > 0) setSelectedSaleId(sales.data?.[0]?.id ?? null)
    if (selectedSaleId !== null && !sales.data?.some((sale) => sale.id === selectedSaleId)) setSelectedSaleId(sales.data?.[0]?.id ?? null)
  }, [initialSaleId, sales.data, selectedSaleId])

  const issue = useMutation({
    mutationFn: issueSandboxFiscalDocument,
    onSuccess: async (document) => {
      setSelectedDocument(document)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['fiscal-sandbox', 'eligible-sales'] }),
        queryClient.invalidateQueries({ queryKey: ['fiscal-sandbox', 'documents'] }),
      ])
    },
  })
  const Element = embedded ? 'section' : 'main'
  const previewModel = selectedDocument
    ? documentPreviewModel(selectedDocument, logoUrl)
    : selectedSale ? salePreviewModel(selectedSale, companyName ?? 'Michelle Market', logoUrl) : null
  const watermark = selectedDocument ? 'DOCUMENTO FICTICIO · NO VÁLIDO FISCALMENTE' : 'BORRADOR · AÚN NO EMITIDO'

  return <Element className={`ops-page fiscal-page${embedded ? ' fiscal-page--embedded' : ''}`}>
    {!embedded ? <PageIntro title="Documentos fiscales" description="Selecciona una venta, revisa el formato completo y confirma la emisión desde esta misma pantalla." /> : null}
    <section className="fiscal-sandbox-alert" role="note" aria-label="Entorno de pruebas fiscales">
      <span className="fiscal-sandbox-alert__icon" aria-hidden="true">DEV</span>
      <div><strong>Entorno de desarrollo · sin validez fiscal</strong><p>Los datos, impuestos y autorizaciones son ficticios. Nada se transmite al SAR ni sirve como comprobante legal.</p></div>
    </section>

    {!focusSaleOnly ? <div className="fiscal-view-switch" role="tablist" aria-label="Vista de documentos fiscales">
      <button type="button" role="tab" aria-selected={view === 'pending'} onClick={() => setView('pending')}>Pendientes <span>{sales.data?.length ?? 0}</span></button>
      <button type="button" role="tab" aria-selected={view === 'history'} onClick={() => setView('history')}>Emitidos <span>{documents.data?.length ?? 0}</span></button>
    </div> : null}

    {view === 'pending' || focusSaleOnly ? <section className="fiscal-flow" aria-label="Emisión de factura">
      <ol className="fiscal-steps" aria-label="Pasos para emitir">
        <li className={selectedSale || selectedDocument ? 'is-complete' : 'is-current'}><span>1</span><div><strong>Venta</strong><small>Seleccionar operación</small></div></li>
        <li className={previewModel ? selectedDocument ? 'is-complete' : 'is-current' : ''}><span>2</span><div><strong>Revisión</strong><small>Validar datos y formato</small></div></li>
        <li className={selectedDocument ? 'is-current' : ''}><span>3</span><div><strong>Emisión</strong><small>Confirmar documento</small></div></li>
      </ol>

      {!focusSaleOnly && selectedDocument === null ? <Panel title="1. Selecciona la venta que deseas facturar">
        {sales.isPending ? <ListSkeleton rows={3} /> : null}
        {sales.isError ? <LoadError message={sales.error.message} onRetry={() => void sales.refetch()} /> : null}
        {sales.data?.length === 0 ? <p className="fiscal-empty">No hay ventas confirmadas pendientes de documento de prueba.</p> : null}
        {sales.data && sales.data.length > 0 ? <div className="fiscal-sale-list" role="group" aria-label="Ventas confirmadas pendientes">
          {sales.data.map((sale) => <button type="button" aria-pressed={selectedSaleId === sale.id} className="fiscal-sale-row" key={sale.id} onClick={() => { setSelectedSaleId(sale.id); setSelectedDocument(null) }}>
            <span className="fiscal-sale-row__selection" aria-hidden="true" />
            <span className="fiscal-sale-row__main"><strong>Venta {sale.id.slice(0, 8)}</strong><small>{date.format(new Date(sale.occurredAt))} · {sale.lineCount} artículos</small></span>
            <span className="fiscal-sale-row__total"><small>Total con impuesto</small><strong>{money.format(sale.total)}</strong></span>
          </button>)}
        </div> : null}
      </Panel> : null}

      {previewModel ? <Panel title={selectedDocument ? 'Factura emitida' : '2. Revisa la factura completa antes de emitir'}>
        <div className="fiscal-preview-toolbar">
          <div><strong>{selectedDocument ? `Factura ${selectedDocument.documentNumber}` : 'Vista previa con datos reales de la venta'}</strong><small>{selectedDocument ? 'El correlativo y la autorización ya fueron reservados.' : 'Revisar no consume correlativo, CAI ni modifica inventario.'}</small></div>
          <div className="fiscal-preview-toolbar__actions">
            {selectedDocument ? <Button type="button" variant="quiet" onClick={() => window.print()}>Imprimir / guardar PDF</Button> : null}
            {!selectedDocument ? <Button type="button" disabled={issue.isPending} onClick={() => selectedSale && issue.mutate(selectedSale.id)}>{issue.isPending ? 'Emitiendo…' : 'Confirmar y emitir factura'}</Button> : null}
          </div>
        </div>
        <div className="fiscal-document-canvas">
          {renderDocument ? renderDocument(previewModel, watermark) : <FallbackPreview document={previewModel} watermark={watermark} />}
        </div>
        {issue.isError ? <p className="form-alert" role="alert">{issue.error.message}</p> : null}
        {selectedDocument ? <div className="fiscal-success" role="status"><strong>Factura emitida correctamente</strong><span>La venta quedó vinculada al documento {selectedDocument.documentNumber}.</span></div> : null}
      </Panel> : null}

      {!sales.isPending && selectedSale === null && selectedDocument === null ? <Panel title="Factura pendiente"><p className="fiscal-empty">La venta ya fue procesada o dejó de estar disponible. Selecciona otra venta pendiente.</p></Panel> : null}
    </section> : null}

    {!focusSaleOnly && view === 'history' ? <Panel title="Facturas emitidas">
      {documents.isPending ? <ListSkeleton rows={4} /> : null}
      {documents.isError ? <LoadError message={documents.error.message} onRetry={() => void documents.refetch()} /> : null}
      {documents.data?.length === 0 ? <p className="fiscal-empty">Los comprobantes emitidos aparecerán aquí.</p> : null}
      {documents.data && documents.data.length > 0 ? <div className="table-scroll"><table className="ui-table fiscal-table">
        <thead><tr><th>Número</th><th>Emisión</th><th>CAI / autorización</th><th>Total</th><th aria-label="Acciones" /></tr></thead>
        <tbody>{documents.data.map((document) => <tr key={document.id} aria-selected={selectedDocument?.id === document.id}>
          <td><strong>{document.documentNumber}</strong><small>NO VÁLIDO</small></td><td>{date.format(new Date(document.issuedAt))}</td><td>{document.authorizationCode}</td><td>{money.format(document.total)}</td>
          <td><IconAction icon="preview" label={`Ver documento ${document.documentNumber}`} onClick={() => setSelectedDocument(document)} /></td>
        </tr>)}</tbody>
      </table></div> : null}
      {selectedDocument ? <div className="fiscal-history-preview"><div className="fiscal-preview-toolbar"><div><strong>{selectedDocument.documentNumber}</strong><small>Documento emitido · snapshot histórico</small></div><div className="fiscal-preview-toolbar__actions"><Button type="button" variant="quiet" onClick={() => window.print()}>Imprimir / guardar PDF</Button><IconAction icon="close" label="Cerrar vista previa" onClick={() => setSelectedDocument(null)} /></div></div><div className="fiscal-document-canvas">{renderDocument ? renderDocument(documentPreviewModel(selectedDocument, logoUrl), 'DOCUMENTO FICTICIO · NO VÁLIDO FISCALMENTE') : <FallbackPreview document={documentPreviewModel(selectedDocument, logoUrl)} watermark="DOCUMENTO FICTICIO · NO VÁLIDO FISCALMENTE" />}</div></div> : null}
    </Panel> : null}
  </Element>
}

function salePreviewModel(sale: EligibleSandboxSale, companyName: string, logoUrl: string | null): FiscalPreviewModel {
  return {
    companyName,
    companyLogoUrl: logoUrl,
    headerText: 'RTN: DEV-NOT-VALID · Domicilio ficticio · Solo desarrollo',
    footerText: 'Original: cliente · Copia: emisor · Documento ficticio sin validez fiscal.',
    accentColor: '',
    documentType: 'invoice',
    documentNumber: 'BORRADOR',
    issuedAt: sale.occurredAt,
    recipientName: 'Consumidor final',
    recipientReference: 'RTN / identidad no registrada',
    details: sandboxAuthorizationDetails('Pendiente de asignar'),
    lines: sale.lines.map((line) => ({
      productId: line.productId,
      description: line.description,
      presentationUnit: 'unidad',
      quantity: line.quantity,
      unitPrice: line.quantity === 0 ? 0 : line.subtotal / line.quantity,
      amount: line.subtotal,
      taxRate: sale.taxRate,
      taxAmount: line.tax,
    })),
    subtotal: sale.subtotal,
    taxTotal: sale.taxTotal,
    total: sale.total,
    notes: 'Venta confirmada pendiente de emisión fiscal de prueba.',
  }
}

function documentPreviewModel(document: SandboxFiscalDocument, logoUrl: string | null): FiscalPreviewModel {
  return {
    companyName: document.issuer.name,
    companyLogoUrl: logoUrl,
    headerText: `RTN: ${document.issuer.taxId} · ${document.issuer.address}`,
    footerText: `Huella de snapshot: ${document.snapshotHash.slice(0, 20)}…`,
    accentColor: '',
    documentType: 'invoice',
    documentNumber: document.documentNumber,
    issuedAt: document.issuedAt,
    recipientName: 'Consumidor final',
    recipientReference: 'RTN / identidad no registrada',
    details: sandboxAuthorizationDetails(String(document.authorizationNumber)),
    lines: document.lines.map((line) => ({
      productId: line.productId,
      description: line.description,
      presentationUnit: 'unidad',
      quantity: line.quantity,
      unitPrice: line.quantity === 0 ? 0 : line.subtotal / line.quantity,
      amount: line.subtotal,
      taxRate: document.taxRate,
      taxAmount: line.tax,
    })),
    subtotal: document.subtotal,
    taxTotal: document.taxTotal,
    total: document.total,
    notes: 'Documento fiscal ficticio generado en entorno de desarrollo.',
  }
}

function sandboxAuthorizationDetails(correlative: string): readonly { label: string; value: string }[] {
  return [
    { label: 'CAI de prueba', value: 'DEV-NOT-VALID' },
    { label: 'Fecha límite', value: '31/12/2099' },
    { label: 'Rango autorizado', value: '001-001-01-00000001 a 001-001-01-00999999' },
    { label: 'Correlativo', value: correlative },
  ]
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="table-load-error" role="alert"><p>{message}</p><IconAction icon="refresh" label="Volver a cargar" onClick={onRetry} /></div>
}

function FallbackPreview({ document, watermark }: { document: FiscalPreviewModel; watermark: string }) {
  return <article className="fiscal-preview-fallback"><p>{watermark}</p><h2>{document.documentNumber}</h2><strong>{document.companyName}</strong><span>{document.lines.length} artículos · {money.format(document.total)}</span></article>
}
