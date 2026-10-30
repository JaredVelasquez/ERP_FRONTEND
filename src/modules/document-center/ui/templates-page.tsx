import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/app/providers/session'
import { Button } from '@/shared/ui/button'
import { DevNote, PageIntro, Panel } from '@/shared/ui/ops'
import { ListSkeleton } from '@/shared/ui/skeleton'
import { createVisualTemplate, documentTypes, listTemplates, publishTemplate, type DocumentTemplate, type DocumentType } from '../api'
import type { TemplateCanvasData } from '../types'
import { TemplateCanvasEditor, TemplateCanvasPreview, blankTemplateCanvas, formalTemplateCanvas } from './template-canvas'
import { currentBrandColor, htmlFromCanvas, htmlTemplateCanvas, referenceTemplateHtml } from './html-template'
import './document-center.css'
import '@puckeditor/core/puck.css'

interface BuilderDraft {
  base: DocumentTemplate | null
  templateKey: string
}

export function TemplatesPage() {
  const { companyId, companyName, logoUrl } = useSession()
  const client = useQueryClient()
  const [type, setType] = useState<DocumentType>('proforma')
  const [builder, setBuilder] = useState<BuilderDraft | null>(null)
  const [notice, setNotice] = useState('')
  const templates = useQuery({ queryKey: ['business-document-templates', companyId], queryFn: listTemplates, enabled: Boolean(companyId) })
  const selected = useMemo(() => (templates.data ?? []).filter((template) => template.documentType === type).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.version - left.version), [templates.data, type])
  const missingPublishedTypes = documentTypes.filter((item) => !(templates.data ?? []).some((template) => template.documentType === item.value && template.status === 'published'))
  const publish = useMutation({ mutationFn: publishTemplate, onSuccess: async () => { setNotice('Plantilla publicada. Las versiones usadas por documentos anteriores permanecen intactas.'); await client.invalidateQueries({ queryKey: ['business-document-templates', companyId] }) }, onError: (error) => setNotice(error instanceof Error ? error.message : 'No se pudo publicar.') })
  const createMissingStandards = useMutation({
    mutationFn: async () => {
      for (const item of documentTypes) await publishStandardTemplate(item.value, companyName, Boolean(logoUrl))
      return documentTypes.length
    },
    onSuccess: async (count) => { setNotice(`${count} formatos estándar preparados y publicados.`); await client.invalidateQueries({ queryKey: ['business-document-templates', companyId] }) },
    onError: async (error) => { setNotice(error instanceof Error ? error.message : 'No se pudieron preparar los formatos.'); await client.invalidateQueries({ queryKey: ['business-document-templates', companyId] }) },
  })

  if (builder !== null) return <TemplateBuilder
    key={`${type}:${builder.templateKey}`}
    type={type}
    base={builder.base}
    templateKey={builder.templateKey}
    companyName={companyName ?? 'Tu empresa'}
    logoUrl={logoUrl ?? null}
    onClose={() => setBuilder(null)}
    onSaved={async () => {
      setBuilder(null)
      setNotice('Borrador visual guardado. Publícalo desde las versiones para usarlo en nuevos documentos.')
      await client.invalidateQueries({ queryKey: ['business-document-templates', companyId] })
    }}
  />

  return <div className="ops-page document-center-page">
    <PageIntro title="Plantillas de documentos" description={`Diseña formatos propios para ${companyName ?? 'tu empresa'} y conserva cada versión.`} />
    <DevNote>Los documentos de este entorno son ficticios y no tienen validez fiscal. El diseñador usa bloques controlados por el ERP; los formatos y sus versiones quedan guardados en la empresa.</DevNote>
    {notice ? <p role="status" className="dc-notice">{notice}</p> : null}
    <Panel title="Formatos estándar"><div className="dc-bulk-standard"><p>Publica una nueva versión formal y monocromática para los {documentTypes.length} tipos. Los documentos históricos conservan su plantilla original.{missingPublishedTypes.length > 0 ? ` Faltan ${missingPublishedTypes.length} formatos iniciales.` : ''}</p><Button type="button" variant="quiet" disabled={createMissingStandards.isPending} onClick={() => createMissingStandards.mutate()}>{createMissingStandards.isPending ? 'Actualizando formatos…' : 'Actualizar formatos estándar'}</Button></div></Panel>
    <div className="dc-type-grid dc-type-grid--templates">{documentTypes.map((item) => <button type="button" key={item.value} className={`dc-type-card${type === item.value ? ' is-active' : ''}`} onClick={() => setType(item.value)}><span>{item.label}</span><small>{(templates.data ?? []).filter((template) => template.documentType === item.value && template.status === 'published').length} publicadas</small></button>)}</div>
    <Panel title="Diseña el formato">
      <div className="dc-builder-launch"><div><h2>{documentTypes.find((item) => item.value === type)?.label}</h2><p className="muted">Empieza con un lienzo vacío o crea otra versión a partir de una existente. Arrastra bloques, cambia textos y previsualiza en papel.</p></div><Button type="button" onClick={() => setBuilder({ base: null, templateKey: `${type}-${crypto.randomUUID().slice(0, 8)}` })}>Crear desde cero</Button></div>
    </Panel>
    <Panel title="Versiones disponibles">
      {templates.isPending ? <ListSkeleton rows={4} label="Cargando plantillas" /> : null}
      {templates.isError ? <p role="alert">No se pudo cargar. <button type="button" onClick={() => void templates.refetch()}>Reintentar</button></p> : null}
      {selected.length === 0 && !templates.isPending ? <p className="muted">Todavía no hay versiones guardadas para este documento.</p> : null}
      <div className="dc-template-list">{selected.map((template) => <article className="dc-template-version" key={`${template.id}:${template.version}`}><div><strong>{template.name} · v{template.version}</strong><span>{template.pageSize} · {template.orientation === 'portrait' ? 'Vertical' : 'Horizontal'} · {template.status === 'published' ? 'Publicada' : template.status === 'draft' ? 'Borrador' : 'Archivada'} · {template.layoutDefinition ? 'Diseño visual' : 'Formato estándar'}</span></div><div className="dc-template-actions"><Button type="button" variant="quiet" onClick={() => setBuilder({ base: template, templateKey: template.templateKey })}>Crear versión</Button><Button type="button" variant="quiet" onClick={() => setBuilder({ base: template, templateKey: `${type}-${crypto.randomUUID().slice(0, 8)}` })}>Duplicar diseño</Button>{template.status === 'draft' ? <Button type="button" disabled={publish.isPending} onClick={() => publish.mutate(template.id)}>Publicar</Button> : null}</div></article>)}</div>
    </Panel>
  </div>
}

function TemplateBuilder({ type, base, templateKey, companyName, logoUrl, onClose, onSaved }: {
  type: DocumentType
  base: DocumentTemplate | null
  templateKey: string
  companyName: string
  logoUrl: string | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState(base ? `${base.name} · Diseño` : `${documentTypes.find((item) => item.value === type)?.label ?? type} · Personalizada`)
  const [pageSize, setPageSize] = useState<'A4' | 'LETTER'>(base?.pageSize ?? 'A4')
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(base?.orientation ?? 'portrait')
  const [marginMm, setMarginMm] = useState(base?.marginMm ?? 14)
  const [accentColor, setAccentColor] = useState(base?.accentColor ?? currentBrandColor())
  const [includeLogo, setIncludeLogo] = useState(base?.includeLogo ?? Boolean(logoUrl))
  const [headerText, setHeaderText] = useState(base?.headerText ?? '')
  const [footerText, setFooterText] = useState(base?.footerText ?? 'Gracias por su preferencia.')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [layoutData, setLayoutData] = useState<TemplateCanvasData>(() => {
    if (isTemplateCanvasData(base?.layoutDefinition)) return base.layoutDefinition
    if (base !== null) return formalTemplateCanvas(type)
    return blankTemplateCanvas
  })
  const [editorMode, setEditorMode] = useState<'visual' | 'html'>('visual')
  const [htmlSource, setHtmlSource] = useState(() => {
    if (isTemplateCanvasData(base?.layoutDefinition)) return htmlFromCanvas(base.layoutDefinition) ?? referenceTemplateHtml(type)
    return referenceTemplateHtml(type)
  })
  const context = {
    companyName, companyLogoUrl: includeLogo ? logoUrl : null, headerText, footerText, accentColor,
    documentType: documentTypes.find((item) => item.value === type)?.label ?? type,
    documentNumber: 'BORRADOR-0001', issuedAt: new Date().toISOString(),
    recipientName: 'Cliente de ejemplo', recipientReference: 'RTN / referencia', details: [{ label: 'Condición', value: 'Ejemplo de desarrollo' }],
    lines: [{ description: 'Producto de ejemplo', quantity: 2, unitPrice: 125, amount: 250 }],
    subtotal: 250, taxTotal: 0, total: 250, notes: 'Texto de notas del documento',
  }
  async function saveLayout(layoutDefinition: TemplateCanvasData): Promise<void> {
    if (name.trim() === '') { setError('Escribe un nombre antes de guardar el diseño.'); return }
    setError('')
    setSaving(true)
    try {
      await createVisualTemplate({
        documentType: type, templateKey, name: name.trim(), pageSize, orientation, marginMm, accentColor,
        includeLogo, headerText, footerText, layoutDefinition,
      })
      await onSaved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el diseño.')
    } finally {
      setSaving(false)
    }
  }

  function chooseHtmlMode(): void {
    const html = htmlFromCanvas(layoutData) ?? referenceTemplateHtml(type)
    setHtmlSource(html)
    setLayoutData(htmlTemplateCanvas(html))
    setEditorMode('html')
  }

  function updateHtml(value: string): void {
    setHtmlSource(value)
    setLayoutData(htmlTemplateCanvas(value))
  }

  return <main className="dc-builder-screen">
    <header className="dc-builder-toolbar">
      <div className="dc-builder-titlebar">
        <div>
          <button type="button" className="dc-builder-back" onClick={onClose}>← Plantillas</button>
          <strong>Diseñador · {documentTypes.find((item) => item.value === type)?.label}</strong>
          <div className="dc-builder-mode" role="group" aria-label="Modo de edición">
            <button type="button" aria-pressed={editorMode === 'visual'} onClick={() => setEditorMode('visual')}>Lienzo visual</button>
            <button type="button" aria-pressed={editorMode === 'html'} onClick={chooseHtmlMode}>Código HTML</button>
          </div>
        </div>
        <Button type="button" disabled={saving} onClick={() => void saveLayout(layoutData)}>{saving ? 'Guardando…' : 'Guardar borrador'}</Button>
      </div>
      <div className="dc-builder-options">
        <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} /></label>
        <label>Papel<select value={pageSize} onChange={(event) => setPageSize(event.target.value as 'A4' | 'LETTER')}><option value="A4">A4</option><option value="LETTER">Carta</option></select></label>
        <label>Orientación<select value={orientation} onChange={(event) => setOrientation(event.target.value as 'portrait' | 'landscape')}><option value="portrait">Vertical</option><option value="landscape">Horizontal</option></select></label>
        <label>Color<input aria-label="Color principal" type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} /></label>
        <label>Margen<input aria-label="Margen en milímetros" type="number" min="5" max="30" value={marginMm} onChange={(event) => setMarginMm(Number(event.target.value))} /></label>
        <label className="dc-builder-logo"><input type="checkbox" checked={includeLogo} onChange={(event) => setIncludeLogo(event.target.checked)} />Logo</label>
      </div>
    </header>
    {error ? <p role="alert" className="dc-notice dc-notice--error">{error}</p> : null}
    {editorMode === 'visual' ? <TemplateCanvasEditor data={layoutData} context={context} onChange={setLayoutData} /> : <section className="dc-html-workbench">
      <div className="dc-html-code">
        <div className="dc-html-code-head"><div><strong>Editar código HTML</strong><small>La vista previa descarta scripts, formularios y contenido activo.</small></div><div><Button type="button" variant="quiet" onClick={() => updateHtml(referenceTemplateHtml(type))}>Restaurar referencia</Button><Button type="button" variant="quiet" onClick={() => updateHtml('')}>Vaciar</Button></div></div>
        <label className="dc-html-label" htmlFor="template-html-source">Código de la plantilla</label>
        <textarea id="template-html-source" className="dc-html-source" value={htmlSource} maxLength={40_000} spellCheck={false} autoCapitalize="off" autoCorrect="off" onChange={(event) => updateHtml(event.target.value)} />
        <div className="dc-html-help"><p>Variables disponibles: <code>{'{{companyName}}'}</code> <code>{'{{companyLogoMarkup}}'}</code> <code>{'{{headerText}}'}</code> <code>{'{{accentColor}}'}</code> <code>{'{{documentType}}'}</code> <code>{'{{documentNumber}}'}</code> <code>{'{{issuedAt}}'}</code> <code>{'{{recipientName}}'}</code> <code>{'{{recipientReference}}'}</code> <code>{'{{documentDetails}}'}</code> <code>{'{{itemsTable}}'}</code> <code>{'{{subtotal}}'}</code> <code>{'{{taxTotal}}'}</code> <code>{'{{total}}'}</code> <code>{'{{notes}}'}</code> <code>{'{{footerText}}'}</code></p><span>{htmlSource.length.toLocaleString('es-HN')} / 40,000 caracteres</span></div>
      </div>
      <div className="dc-html-preview"><div className="dc-html-preview-head"><strong>Vista previa</strong><span>A4 · datos de ejemplo</span></div><div className="dc-html-preview-paper"><TemplateCanvasPreview data={layoutData} context={context} /></div></div>
    </section>}
    <footer className="dc-builder-footer"><label>Texto de encabezado<input value={headerText} onChange={(event) => setHeaderText(event.target.value)} maxLength={500} placeholder="RTN, dirección o contacto" /></label><label>Pie de página<input value={footerText} onChange={(event) => setFooterText(event.target.value)} maxLength={500} /></label><span>El borrador conserva el diseño; publícalo después para usarlo.</span></footer>
  </main>
}

function isTemplateCanvasData(value: unknown): value is TemplateCanvasData {
  return typeof value === 'object' && value !== null && 'content' in value && Array.isArray(value.content) && 'root' in value
}

async function publishStandardTemplate(type: DocumentType, companyName: string | null, includeLogo: boolean): Promise<void> {
  const label = documentTypes.find((item) => item.value === type)?.label ?? type
  const draft = await createVisualTemplate({
    documentType: type, templateKey: `${type}-standard`, name: `${label} · Formato estándar · ${companyName ?? 'Empresa'}`,
    pageSize: 'A4', orientation: 'portrait', marginMm: 14, accentColor: currentBrandColor(), includeLogo,
    headerText: 'Documento preparado por la empresa', footerText: 'Documento de desarrollo. No válido para uso fiscal.',
    layoutDefinition: formalTemplateCanvas(type),
  })
  await publishTemplate(draft.id)
}


