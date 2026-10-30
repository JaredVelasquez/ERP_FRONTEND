import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useSession } from '@/app/providers/session'
import { visibleModules } from '@/modules/access'
import { DocumentCenterPage, DocumentFormatPreview, type DocumentType } from '@/modules/document-center'
import { FiscalPage, type FiscalPreviewModel } from '@/modules/fiscal'
import { ScanPage } from '@/modules/scan'
import { readPaymentSettings } from '@/modules/settings'
import { PageIntro } from '@/shared/ui/ops'
import './sales-fiscal-workspace.css'

type WorkspaceCategory = 'inventory' | 'fiscal' | 'sales' | 'purchasing' | 'warehouse' | 'adjustments'
const categoryCopy: Record<WorkspaceCategory, { title: string; description: string; types: readonly DocumentType[] }> = {
  inventory: { title: 'Movimientos de inventario', description: 'Registra salidas y entradas reales; actualizan existencias y su registro contable.', types: [] },
  fiscal: { title: 'Facturación de ventas', description: 'Emite una factura de prueba a partir de una venta confirmada. No duplica el movimiento de inventario.', types: [] },
  sales: { title: 'Documentos de venta', description: 'Prepara proformas y cotizaciones con productos o servicios del catálogo. No registra una venta.', types: ['proforma', 'quotation'] },
  purchasing: { title: 'Compras', description: 'Prepara requisiciones, solicitudes y órdenes. El inventario cambia al registrar la recepción.', types: ['requisition', 'purchase_request', 'purchase_order'] },
  warehouse: { title: 'Bodegas', description: 'Registra una solicitud de traslado entre bodegas. Esta solicitud no mueve existencias todavía.', types: ['warehouse_transfer'] },
  adjustments: { title: 'Ajustes y retenciones', description: 'Documenta notas y retenciones asociadas. La creación del documento no modifica saldos ni existencias.', types: ['credit_note', 'debit_note', 'withholding'] },
}

export function SalesFiscalWorkspace() {
  const { grants, companyId } = useSession()
  const location = useLocation()
  const queryClient = useQueryClient()
  const modules = visibleModules(grants ?? [])
  const categories = availableCategories(modules)
  const paymentConfiguration = useQuery({
    queryKey: ['payment-settings', companyId],
    queryFn: () => readPaymentSettings(companyId ?? ''),
    enabled: modules.includes('inventory') && Boolean(companyId),
  })
  const [activeCategory, setActiveCategory] = useState<WorkspaceCategory>(() => initialCategory(location.pathname, categories))
  const [pendingFiscalSaleId, setPendingFiscalSaleId] = useState<string | null>(null)
  const inlineFiscalRef = useRef<HTMLDivElement>(null)
  const activeCopy = categoryCopy[activeCategory]

  useEffect(() => {
    if (pendingFiscalSaleId === null || activeCategory !== 'inventory') return
    inlineFiscalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeCategory, pendingFiscalSaleId])

  async function movementPosted(document: { id: string; type: string }, prepareInvoice: boolean): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['fiscal-sandbox', 'eligible-sales'] })
    if (document.type !== 'sale') return
    if (!prepareInvoice) { setPendingFiscalSaleId(null); return }
    if (document.id !== '') setPendingFiscalSaleId(document.id)
  }

  return <main className="sales-fiscal-workspace">
    <PageIntro title="Operaciones y documentos" description="Elige una operación. Cada flujo indica qué registra y qué deja pendiente." />
    <nav className="operations-category-grid" aria-label="Categorías de operaciones">
      {categories.map((category) => <button type="button" key={category} className={`operations-category-card${activeCategory === category ? ' is-active' : ''}`} aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)}>
        <strong>{categoryCopy[category].title}</strong><span>{categoryCopy[category].description}</span>
      </button>)}
    </nav>
    <section className="operations-section" aria-labelledby="operations-section-title">
      <header className="operations-section__header"><div><h2 id="operations-section-title">{activeCopy.title}</h2><p>{activeCopy.description}</p></div></header>
      {activeCategory === 'inventory' ? <>
        {paymentConfiguration.isError ? <p className="form-alert" role="alert">No se cargaron métodos de pago. <Link to="/settings/payments">Revisar configuración</Link></p> : null}
        <ScanPage embedded paymentMethods={paymentConfiguration.data?.settings.paymentMethods ?? []} onMovementPosted={(document, prepareInvoice) => { void movementPosted(document, prepareInvoice) }} />
        {pendingFiscalSaleId ? <div ref={inlineFiscalRef} className="operations-inline-fiscal"><FiscalPage embedded initialSaleId={pendingFiscalSaleId} focusSaleOnly renderDocument={renderFiscalDocument} /></div> : null}
      </> : null}
      {activeCategory === 'fiscal' ? <FiscalPage embedded initialSaleId={pendingFiscalSaleId} renderDocument={renderFiscalDocument} /> : null}
      {activeCopy.types.length > 0 ? <DocumentCenterPage key={activeCategory} embedded allowedTypes={activeCopy.types} initialType={activeCopy.types[0]} /> : null}
    </section>
  </main>
}

function renderFiscalDocument(document: FiscalPreviewModel, watermark: string) {
  return <DocumentFormatPreview documentType="invoice" context={document} watermark={watermark} />
}

function availableCategories(modules: readonly string[]): WorkspaceCategory[] {
  const available: WorkspaceCategory[] = []
  if (modules.includes('inventory')) available.push('inventory')
  if (modules.includes('accounting')) available.push('fiscal')
  if (modules.includes('documents')) available.push('sales', 'purchasing', 'warehouse', 'adjustments')
  return available
}

function initialCategory(pathname: string, available: WorkspaceCategory[]): WorkspaceCategory {
  if (pathname === '/fiscal' && available.includes('fiscal')) return 'fiscal'
  if (pathname === '/business-documents') return available.find((category) => category !== 'inventory' && category !== 'fiscal') ?? available[0] ?? 'inventory'
  return available[0] ?? 'inventory'
}
