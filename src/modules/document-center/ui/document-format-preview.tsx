import { useQuery } from '@tanstack/react-query'
import type { CSSProperties } from 'react'
import { useSession } from '@/app/providers/session'
import { ListSkeleton } from '@/shared/ui/skeleton'
import { listTemplates, type DocumentTemplate, type DocumentType } from '../api'
import type { TemplateCanvasData } from '../types'
import { currentBrandColor, htmlTemplateCanvas, referenceTemplateHtml } from './html-template'
import { TemplateCanvasPreview, type TemplateRenderContext } from './template-canvas'

export type PrintableDocumentType = DocumentType

interface DocumentFormatPreviewProps {
  documentType: PrintableDocumentType
  context: TemplateRenderContext
  watermark?: string
}

export function DocumentFormatPreview({ documentType, context, watermark }: DocumentFormatPreviewProps) {
  const { companyId } = useSession()
  const templates = useQuery({
    queryKey: ['business-document-templates', companyId],
    queryFn: listTemplates,
    enabled: Boolean(companyId),
  })

  if (templates.isPending) return <div className="dc-format-loading"><ListSkeleton rows={6} label="Preparando formato del documento" /></div>

  const template = latestPublishedTemplate(templates.data ?? [], documentType)
  const canvas = templateCanvas(template, documentType)
  const accentColor = template?.accentColor ?? (context.accentColor || currentBrandColor())
  const renderedContext = {
    ...context,
    accentColor,
    headerText: template?.headerText ?? context.headerText,
    footerText: template?.footerText ?? context.footerText,
  }
  const style = { '--dc-accent': accentColor, '--dc-margin': `${template?.marginMm ?? 10}mm` } as CSSProperties

  return <article className={`dc-paper dc-paper--${(template?.pageSize ?? 'A4').toLocaleLowerCase()} dc-paper--${template?.orientation ?? 'portrait'}`} style={style}>
    {watermark ? <div className="dc-watermark">{watermark}</div> : null}
    <TemplateCanvasPreview data={canvas} context={renderedContext} />
  </article>
}

function latestPublishedTemplate(templates: readonly DocumentTemplate[], documentType: PrintableDocumentType): DocumentTemplate | null {
  return templates
    .filter((template) => template.documentType === documentType && template.status === 'published')
    .sort((left, right) => publicationTime(right) - publicationTime(left) || right.version - left.version)[0] ?? null
}

function publicationTime(template: DocumentTemplate): number {
  return Date.parse(template.publishedAt ?? template.createdAt)
}

function templateCanvas(template: DocumentTemplate | null, documentType: PrintableDocumentType): TemplateCanvasData {
  if (template !== null && isTemplateCanvasData(template.layoutDefinition) && template.layoutDefinition.content.length > 0) return template.layoutDefinition
  return htmlTemplateCanvas(referenceTemplateHtml(documentType))
}

function isTemplateCanvasData(value: unknown): value is TemplateCanvasData {
  return typeof value === 'object' && value !== null && 'content' in value && Array.isArray(value.content) && 'root' in value
}
