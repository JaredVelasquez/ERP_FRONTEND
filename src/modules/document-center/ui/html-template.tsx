import DOMPurify from 'dompurify'
import type { TemplateRenderContext } from './template-canvas'
import type { TemplateCanvasData } from '../types'

export interface HtmlTemplateProps { html: string }

type ReferenceType = 'invoice' | 'proforma' | 'quotation' | 'requisition' | 'purchase_request' | 'purchase_order' | 'warehouse_transfer' | 'credit_note' | 'debit_note' | 'withholding'

const DOCUMENT_TITLES: Record<ReferenceType, string> = {
  invoice: 'Factura', proforma: 'Proforma', quotation: 'Cotización', requisition: 'Requisición',
  purchase_request: 'Solicitud de compra', purchase_order: 'Orden de compra', warehouse_transfer: 'Traslado entre bodegas',
  credit_note: 'Nota de crédito', debit_note: 'Nota de débito', withholding: 'Comprobante de retención',
}

export function htmlTemplateCanvas(html: string): TemplateCanvasData {
  return { content: [{ type: 'HtmlTemplate', props: { id: 'html-template', html } }], root: {} } as TemplateCanvasData
}

export function htmlFromCanvas(data: TemplateCanvasData): string | null {
  const block = data.content.find((item) => typeof item === 'object' && item !== null && 'type' in item && item.type === 'HtmlTemplate')
  if (!block || typeof block !== 'object' || !('props' in block) || typeof block.props !== 'object' || block.props === null || !('html' in block.props)) return null
  return typeof block.props.html === 'string' ? block.props.html : null
}

export function referenceTemplateHtml(type: string): string {
  const documentType = isReferenceType(type) ? type : 'invoice'
  const title = DOCUMENT_TITLES[documentType]
  const subtitle = documentType === 'proforma'
    ? 'Cotización comercial · No válida como factura'
    : documentType === 'invoice'
      ? 'Documento fiscal autorizado · entorno de desarrollo'
      : documentType === 'withholding'
        ? 'Documento fiscal autorizado · entorno de desarrollo'
        : 'Documento comercial de desarrollo'
  const itemHeading = documentType === 'withholding' ? 'Detalle de la retención' : 'Detalle de bienes o servicios'
  const totalLabel = documentType === 'withholding' ? 'Total retenido' : documentType === 'proforma' ? 'Total estimado' : 'Total a pagar'
  return `
<!-- erp-template-revision: 20261028-v6 -->
<style>
:root{color-scheme:light;--accent:{{accentColor}};--ink:color-mix(in srgb,var(--accent) 72%,#10263c);--muted:color-mix(in srgb,var(--accent) 38%,#64748b);--line:color-mix(in srgb,var(--accent) 21%,white);--tint:color-mix(in srgb,var(--accent) 8%,white);--soft:color-mix(in srgb,var(--accent) 4%,white)}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:var(--ink);font:11px/1.38 Arial,Helvetica,sans-serif}.sheet{display:flex;width:100%;max-width:190mm;min-height:272mm;margin:0 auto;padding:1mm 1mm 0;flex-direction:column}.topline{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;padding:0 0 7px;border-bottom:1px solid var(--line);color:var(--muted);font-size:8px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.topline strong{color:var(--ink);font-size:12px;letter-spacing:.1em;white-space:nowrap}.topline span:last-child{text-align:right;letter-spacing:.035em;font-weight:600}
.brand{display:grid;grid-template-columns:62px minmax(0,1fr) auto;align-items:center;gap:12px;padding:10px 0 8px}.brand img{width:58px;height:48px;object-fit:contain}.issuer{display:grid;gap:1px}.label{color:var(--muted);font-size:8px;font-weight:700;letter-spacing:.07em;text-transform:uppercase}.issuer strong{font-size:15px;letter-spacing:.01em}.issuer small{color:var(--muted);font-size:9px}.authority{padding-left:16px;border-left:2px solid var(--accent);text-align:right}.authority strong{display:block;font-size:9px;letter-spacing:.08em;text-transform:uppercase}.authority small{display:block;margin-top:2px;color:var(--muted);font-size:8px;text-transform:uppercase}
.heading{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:9px 10px;background:var(--tint);border:1px solid var(--line);border-radius:4px}.heading h1{margin:0;color:var(--accent);font-size:31px;line-height:.95;text-transform:uppercase;letter-spacing:-.035em}.heading p{margin:5px 0 0;color:var(--ink);font-size:10px;font-weight:700}.number{display:grid;gap:2px;text-align:right}.number span{color:var(--muted);font-size:8px;text-transform:uppercase;letter-spacing:.06em}.number strong{font-size:12px}
.grid{display:grid;grid-template-columns:1.15fr .85fr;gap:7px;margin:7px 0}.panel{min-width:0;padding:7px 9px;background:var(--soft);border:1px solid var(--line);border-radius:4px}.panel h2{margin:0 0 5px;color:var(--accent);font-size:8px;letter-spacing:.06em;text-transform:uppercase}.panel dl{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;margin:0}.panel dl div{min-width:0;display:grid;gap:1px}.panel dt{color:var(--muted);font-size:8px}.panel dd{margin:0;font-size:9px;font-weight:700;overflow-wrap:anywhere}.details{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin:0 0 7px}.details:empty{display:none}.details div{padding:5px 7px;background:#fff;border:1px solid var(--line);border-radius:3px}.details small{display:block;color:var(--muted);font-size:7px;text-transform:uppercase}.details strong{display:block;margin-top:1px;font-size:9px;overflow-wrap:anywhere}
.section-title{margin:7px 0 4px;color:var(--accent);font-size:8px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}.items{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:8px;border:1px solid var(--line);border-radius:4px;overflow:hidden}.items th{padding:5px 4px;background:var(--tint);color:var(--ink);text-align:left;font-size:7px;line-height:1.2;font-weight:800}.items td{height:20px;padding:4px;border-top:1px solid color-mix(in srgb,var(--line) 70%,white);overflow-wrap:anywhere}.items tbody tr:nth-child(even){background:var(--soft)}.items th:not(:first-child),.items td:not(:first-child){text-align:right}.items th:first-child,.items td:first-child{width:5%}.items th:nth-child(2),.items td:nth-child(2){width:31%;text-align:left}.items th:nth-child(3),.items td:nth-child(3){width:12%}.items th:nth-child(4),.items td:nth-child(4){width:8%}.items th:nth-child(5),.items td:nth-child(5){width:14%}.items th:nth-child(6),.items td:nth-child(6){width:15%}.items th:nth-child(7),.items td:nth-child(7){width:15%}.items .empty-row td{color:transparent}
.bottom{display:grid;grid-template-columns:minmax(0,1fr) minmax(205px,250px);gap:8px;margin-top:7px;align-items:stretch}.summary,.totals{border:1px solid var(--line);border-radius:4px;overflow:hidden}.summary h2,.totals h2{margin:0;padding:5px 7px;background:var(--tint);color:var(--accent);font-size:7px;text-transform:uppercase;letter-spacing:.05em}.summary-grid{display:grid;grid-template-columns:1fr auto;gap:0}.summary-grid span,.summary-grid strong{padding:4px 7px;border-top:1px solid color-mix(in srgb,var(--line) 65%,white);font-size:8px}.summary-grid strong{text-align:right}.totals{display:grid;align-content:start}.totals p{display:flex;justify-content:space-between;gap:12px;margin:0;padding:5px 8px;border-top:1px solid color-mix(in srgb,var(--line) 65%,white)}.totals .grand{padding:8px;background:var(--accent);color:#fff;font-size:11px;font-weight:800;text-transform:uppercase;border:0}.words{grid-column:1/-1;padding:6px 8px;background:var(--soft);border:1px solid var(--line);border-radius:4px}.words small{display:block;color:var(--muted);font-size:7px;text-transform:uppercase}.words strong{display:block;margin-top:2px;font-size:8px}
.signature{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin:22px 8px 10px;margin-top:auto;padding-top:18px}.signature span{padding-top:4px;border-top:1px solid var(--muted);text-align:center;color:var(--muted);font-size:7px}.foot{display:flex;justify-content:space-between;gap:10px;padding-top:6px;border-top:1px solid var(--line);color:var(--muted);font-size:7px}.foot span:last-child{text-align:right}
@media(max-width:560px){.sheet{padding:7px}.topline{grid-template-columns:1fr auto}.topline span:last-child{display:none}.brand{grid-template-columns:44px 1fr}.brand img{width:42px;height:38px}.authority{grid-column:2;text-align:left}.heading{align-items:flex-start;flex-direction:column}.heading h1{font-size:24px}.number{text-align:left}.grid,.bottom{grid-template-columns:1fr}.details{grid-template-columns:1fr 1fr}.items{font-size:7px}.items th:nth-child(3),.items td:nth-child(3){display:none}.words{grid-column:auto}}
@media print{@page{size:A4 portrait;margin:10mm}.sheet{max-width:none;padding:0}.brand,.heading,.grid,.details,.items,.bottom,.signature,.foot{break-inside:avoid}}
</style>
<main class="sheet">
  <div class="topline"><span>Plantilla referencial</span><strong>Honduras / SAR</strong><span>Factura · Proforma · comprobante de retención</span></div>
  <header class="brand">{{companyLogoMarkup}}<div class="issuer"><span class="label">Emisor</span><strong>{{companyName}}</strong><small>{{headerText}}</small></div><div class="authority"><strong>República de Honduras</strong><small>Documento de desarrollo · SAR</small></div></header>
  <section class="heading"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="number"><span>N.º de documento</span><strong>{{documentNumber}}</strong></div></section>
  <section class="grid"><div class="panel"><h2>Cliente / destinatario</h2><dl><div><dt>Nombre</dt><dd>{{recipientName}}</dd></div><div><dt>RTN / referencia</dt><dd>{{recipientReference}}</dd></div></dl></div><div class="panel"><h2>Datos del documento</h2><dl><div><dt>Fecha de emisión</dt><dd>{{issuedAt}}</dd></div><div><dt>Tipo</dt><dd>{{documentType}}</dd></div></dl></div></section>
  <div class="details">{{documentDetails}}</div>
  <h2 class="section-title">${itemHeading}</h2>
  {{itemsTable}}
  <section class="bottom"><div class="summary"><h2>Resumen de importes</h2><div class="summary-grid"><span>Base imponible / subtotal</span><strong>{{subtotal}}</strong><span>Impuestos</span><strong>{{taxTotal}}</strong><span>Moneda</span><strong>HNL</strong></div></div><div class="totals"><h2>Totalización</h2><p><span>Subtotal</span><strong>{{subtotal}}</strong></p><p><span>Impuestos</span><strong>{{taxTotal}}</strong></p><p class="grand"><span>${totalLabel}</span><strong>{{total}}</strong></p></div><div class="words"><small>Condiciones / observaciones</small><strong>{{notes}}</strong></div></section>
  <section class="signature"><span>Nombre y firma de quien entrega</span><span>Nombre y firma de quien recibe</span></section>
  <footer class="foot"><span>{{footerText}}</span><span>Documento ficticio · No válido para uso fiscal</span></footer>
</main>`
}

export function renderSafeHtmlTemplate(html: string, context: TemplateRenderContext): string {
  const lines = context.lines.map((line, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(line.description)}</td><td>${escapeHtml(line.presentationUnit ?? '')}</td><td>${formatQuantity(line.quantity)}</td><td>${money(line.unitPrice)}</td><td>${line.taxRate ?? 0}% · ${money(line.taxAmount ?? 0)}</td><td>${money(line.amount)}</td></tr>`).join('')
  const emptyLineCount = Math.max(0, 8 - context.lines.length)
  const emptyLines = Array.from({ length: emptyLineCount }, (_, index) => `<tr class="empty-row" aria-hidden="true"><td>${context.lines.length + index + 1}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`).join('')
  const logoUrl = safeLogoUrl(context.companyLogoUrl)
  const values: Record<string, string> = {
    companyName: escapeHtml(context.companyName),
    accentColor: safeAccentColor(context.accentColor),
    companyLogoMarkup: logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="">` : '<span aria-hidden="true"></span>',
    headerText: escapeHtml(context.headerText),
    footerText: escapeHtml(context.footerText),
    documentType: escapeHtml(context.documentType),
    documentNumber: escapeHtml(context.documentNumber),
    issuedAt: escapeHtml(formatDate(context.issuedAt)),
    recipientName: escapeHtml(context.recipientName),
    recipientReference: escapeHtml(context.recipientReference),
    subtotal: money(context.subtotal),
    taxTotal: money(context.taxTotal),
    total: money(context.total),
    notes: escapeHtml(context.notes),
    itemsTable: `<table class="items"><thead><tr><th>N.º</th><th>Descripción del bien o servicio</th><th>Presentación</th><th>Cantidad</th><th>Precio unitario (L)</th><th>Impuesto</th><th>Importe (L)</th></tr></thead><tbody>${lines}${emptyLines}</tbody></table>`,
    documentDetails: context.details.map((detail) => `<div><small>${escapeHtml(detail.label)}</small><strong>${escapeHtml(detail.value)}</strong></div>`).join(''),
  }
  const interpolated = html.replace(/\{\{([a-zA-Z]+)\}\}/g, (_match, key: string) => values[key] ?? '')
  const parsedTemplate = new DOMParser().parseFromString(interpolated, 'text/html')
  const styleBlocks = Array.from(parsedTemplate.querySelectorAll('style'), (style) => style.textContent ?? '')
  parsedTemplate.querySelectorAll('style').forEach((style) => style.remove())
  const clean = DOMPurify.sanitize(parsedTemplate.body.innerHTML, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'base', 'meta', 'link'],
    FORBID_ATTR: ['srcdoc', 'formaction', 'target'],
    ALLOW_DATA_ATTR: false,
  })
  // DOMPurify deliberately drops stylesheet contents. Keep the CSS separately
  // and place it in the isolated document, where CSP blocks remote styles/fonts
  // and the iframe sandbox prevents script execution.
  const safeStyles = styleBlocks.map((style) => `<style>${style.replace(/<\/style/gi, '\\3C /style')}</style>`).join('')
  const imageOrigin = allowedLogoOrigin(logoUrl)
  const policy = `default-src 'none'; img-src data: blob: ${imageOrigin}; style-src 'unsafe-inline'; font-src data:; object-src 'none'; base-uri 'none'; form-action 'none'; connect-src 'none'; frame-src 'none'`
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}">${safeStyles}</head><body>${clean}</body></html>`
}

export function HtmlTemplateFrame({ html, context }: { html: string; context: TemplateRenderContext }) {
  return <iframe className="dc-html-template-frame" title="Vista previa del formato HTML" sandbox="allow-modals" referrerPolicy="no-referrer" srcDoc={renderSafeHtmlTemplate(html, context)} />
}

function allowedLogoOrigin(value: string | null): string {
  if (value === null) return ''
  try {
    const parsed = new URL(value, window.location.origin)
    if (parsed.protocol !== 'https:' && parsed.origin !== window.location.origin) return ''
    return parsed.origin
  } catch {
    return ''
  }
}

function safeLogoUrl(value: string | null): string | null {
  if (value === null || value.trim() === '') return null
  try {
    const parsed = new URL(value, window.location.origin)
    if (parsed.protocol !== 'https:' && parsed.origin !== window.location.origin) return null
    return parsed.href
  } catch {
    return null
  }
}

function isReferenceType(value: string): value is ReferenceType {
  return value in DOCUMENT_TITLES
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}

function money(value: number): string {
  return `L ${value.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(value: string): string {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('es-HN')
}

function formatQuantity(value: number): string {
  return value.toLocaleString('es-HN', { maximumFractionDigits: 4 })
}

function safeAccentColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : currentBrandColor()
}

export function currentBrandColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()
}
