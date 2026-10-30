import { Puck, Render, type Config } from '@puckeditor/core'
import type { TemplateCanvasData } from '../types'
import { HtmlTemplateFrame, htmlTemplateCanvas, referenceTemplateHtml } from './html-template'

export type { TemplateCanvasData } from '../types'

export interface TemplateRenderContext {
  companyName: string
  companyLogoUrl: string | null
  headerText: string
  footerText: string
  accentColor: string
  documentType: string
  documentNumber: string
  issuedAt: string
  recipientName: string
  recipientReference: string
  details: readonly { label: string; value: string }[]
  lines: readonly { productId?: string; itemType?: 'product' | 'service'; description: string; presentationUnit?: string; quantity: number; unitPrice: number; amount: number; taxCategoryCode?: string; taxRate?: number; taxAmount?: number }[]
  subtotal: number
  taxTotal: number
  total: number
  notes: string
}

interface TemplateComponents {
  HtmlTemplate: { html: string }
  CompanyHeader: { caption: string }
  DocumentTitle: { title: string; subtitle: string }
  DocumentMetadata: { numberLabel: string; dateLabel: string }
  RecipientDetails: { title: string }
  DocumentDetails: { title: string }
  DocumentItems: { heading: string }
  DocumentTotals: { totalLabel: string }
  DocumentNotes: { title: string }
  TextBlock: { title: string; body: string }
  Divider: Record<string, never>
  SignatureBlock: { caption: string }
  FooterBlock: { text: string }
}

const config: Config<TemplateComponents> = {
  categories: {
    empresa: { title: 'Empresa', components: ['CompanyHeader'] },
    documento: { title: 'Documento', components: ['DocumentTitle', 'DocumentMetadata', 'RecipientDetails', 'DocumentDetails'] },
    contenido: { title: 'Contenido', components: ['DocumentItems', 'DocumentTotals', 'DocumentNotes', 'TextBlock', 'Divider'] },
    cierre: { title: 'Cierre', components: ['SignatureBlock', 'FooterBlock'] },
  },
  components: {
    HtmlTemplate: {
      label: 'Documento HTML personalizado',
      fields: { html: { type: 'textarea' as const } },
      defaultProps: { html: '' },
      render: ({ html, puck }) => <HtmlTemplateFrame html={html} context={readContext(puck.metadata)} />,
    },
    CompanyHeader: {
      label: 'Encabezado de empresa',
      fields: { caption: { type: 'text' as const } },
      defaultProps: { caption: 'Datos de contacto y registro' },
      render: ({ caption, puck }) => {
        const context = readContext(puck.metadata)
        return <header className="dc-layout-block dc-layout-company"><div>{context.companyLogoUrl ? <img src={context.companyLogoUrl} alt="Logotipo de la empresa" /> : null}<div><strong>{context.companyName}</strong><p>{context.headerText || caption}</p></div></div></header>
      },
    },
    DocumentTitle: {
      label: 'Título del documento',
      fields: { title: { type: 'text' as const }, subtitle: { type: 'text' as const } },
      defaultProps: { title: 'Documento', subtitle: 'Original · copia para el cliente' },
      render: ({ title, subtitle }) => <section className="dc-layout-block dc-layout-title"><h1>{title}</h1><p>{subtitle}</p></section>,
    },
    DocumentMetadata: {
      label: 'Número y fecha',
      fields: { numberLabel: { type: 'text' as const }, dateLabel: { type: 'text' as const } },
      defaultProps: { numberLabel: 'Número', dateLabel: 'Fecha' },
      render: ({ numberLabel, dateLabel, puck }) => {
        const context = readContext(puck.metadata)
        return <div className="dc-layout-block dc-layout-metadata"><span><small>{numberLabel}</small><strong>{context.documentNumber}</strong></span><span><small>{dateLabel}</small><strong>{formatDate(context.issuedAt)}</strong></span></div>
      },
    },
    RecipientDetails: {
      label: 'Cliente o proveedor',
      fields: { title: { type: 'text' as const } },
      defaultProps: { title: 'Preparado para' },
      render: ({ title, puck }) => {
        const context = readContext(puck.metadata)
        return <section className="dc-layout-block dc-layout-recipient"><small>{title}</small><strong>{context.recipientName}</strong>{context.recipientReference ? <span>{context.recipientReference}</span> : null}</section>
      },
    },
    DocumentDetails: {
      label: 'Datos adicionales',
      fields: { title: { type: 'text' as const } },
      defaultProps: { title: 'Información del documento' },
      render: ({ title, puck }) => {
        const details = readContext(puck.metadata).details
        if (details.length === 0) return <></>
        return <section className="dc-layout-block dc-layout-details"><strong>{title}</strong><dl>{details.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></section>
      },
    },
    DocumentItems: {
      label: 'Detalle de productos',
      fields: { heading: { type: 'text' as const } },
      defaultProps: { heading: 'Detalle' },
      render: ({ heading, puck }) => {
        const context = readContext(puck.metadata)
        return <section className="dc-layout-block"><h2 className="dc-layout-section-title">{heading}</h2><table className="dc-paper-table"><thead><tr><th>Descripción del bien o servicio</th><th>Presentación</th><th>Cantidad</th><th>Precio unitario</th><th>Impuesto</th><th>Importe</th></tr></thead><tbody>{context.lines.map((line, index) => <tr key={`${line.productId ?? line.description}-${index}`}><td>{line.description}</td><td>{line.presentationUnit ?? ''}</td><td>{line.quantity}</td><td>{money(line.unitPrice)}</td><td>{line.taxRate ?? 0}% · {money(line.taxAmount ?? 0)}</td><td>{money(line.amount)}</td></tr>)}</tbody></table></section>
      },
    },
    DocumentTotals: {
      label: 'Subtotal e impuestos',
      fields: { totalLabel: { type: 'text' as const } },
      defaultProps: { totalLabel: 'Total' },
      render: ({ totalLabel, puck }) => {
        const context = readContext(puck.metadata)
        return <div className="dc-layout-block dc-paper-totals"><p><span>Subtotal</span><strong>{money(context.subtotal)}</strong></p><p><span>Impuestos</span><strong>{money(context.taxTotal)}</strong></p><p className="dc-total"><span>{totalLabel}</span><strong>{money(context.total)}</strong></p></div>
      },
    },
    DocumentNotes: {
      label: 'Notas y condiciones',
      fields: { title: { type: 'text' as const } },
      defaultProps: { title: 'Notas y condiciones' },
      render: ({ title, puck }) => {
        const notes = readContext(puck.metadata).notes
        return notes ? <section className="dc-layout-block dc-layout-text"><strong>{title}</strong><p>{notes}</p></section> : <></>
      },
    },
    TextBlock: {
      label: 'Texto libre',
      fields: { title: { type: 'text' as const }, body: { type: 'text' as const } },
      defaultProps: { title: 'Información adicional', body: 'Escribe aquí las condiciones o información del documento.' },
      render: ({ title, body }) => <section className="dc-layout-block dc-layout-text"><strong>{title}</strong><p>{body}</p></section>,
    },
    Divider: { label: 'Separador', render: () => <hr className="dc-layout-block dc-layout-divider" /> },
    SignatureBlock: {
      label: 'Línea de firma',
      fields: { caption: { type: 'text' as const } },
      defaultProps: { caption: 'Recibido conforme' },
      render: ({ caption }) => <div className="dc-layout-block dc-layout-signature"><span />{caption}</div>,
    },
    FooterBlock: {
      label: 'Pie de página',
      fields: { text: { type: 'text' as const } },
      defaultProps: { text: 'Gracias por su preferencia.' },
      render: ({ text, puck }) => <footer className="dc-layout-block dc-layout-footer">{text || readContext(puck.metadata).footerText}</footer>,
    },
  },
}

export const blankTemplateCanvas: TemplateCanvasData = { content: [], root: {} }

export function formalTemplateCanvas(documentType = 'invoice'): TemplateCanvasData {
  return htmlTemplateCanvas(referenceTemplateHtml(documentType))
}
export function TemplateCanvasEditor({ data, context, onChange }: {
  data: TemplateCanvasData
  context: TemplateRenderContext
  onChange: (data: TemplateCanvasData) => void
}) {
  return <Puck config={config} data={data} metadata={context} height="calc(100vh - 112px)" headerTitle="Lienzo de la plantilla" onChange={onChange} />
}

export function TemplateCanvasPreview({ data, context }: { data: TemplateCanvasData; context: TemplateRenderContext }) {
  if (data.content.length === 0) return <div className="dc-canvas-empty">Arrastra un bloque desde la barra izquierda para empezar a diseñar.</div>
  return <Render config={config} data={data} metadata={context} />
}

function readContext(value: unknown): TemplateRenderContext {
  if (typeof value === 'object' && value !== null) return value as TemplateRenderContext
  return { companyName: '', companyLogoUrl: null, headerText: '', footerText: '', accentColor: '', documentType: '', documentNumber: '', issuedAt: '', recipientName: '', recipientReference: '', details: [], lines: [], subtotal: 0, taxTotal: 0, total: 0, notes: '' }
}

function money(value: number): string { return `L ${value.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function formatDate(value: string): string { return value ? new Date(value).toLocaleDateString('es-HN') : '27 oct. 2026' }

