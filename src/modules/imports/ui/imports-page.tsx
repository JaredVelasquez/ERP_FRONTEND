import { useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/app/providers/session'
import { Button } from '@/shared/ui/button'
import { PageIntro, Panel } from '@/shared/ui/ops'
import { downloadCatalogTemplate, importCatalog } from '../api'

type Draft = { name: string; rows: string[][]; count: number }
const headers = 'sku,nombre,categoria,unidad_base,presentacion,factor,costo,precio,cantidad,vencimiento,codigo_fabricante'
const labels = ['SKU', 'Producto', 'Categoría', 'Unidad base', 'Presentación', 'Factor', 'Costo', 'Precio', 'Cantidad', 'Vencimiento', 'Código fabricante']
const pageSize = 15

export function ImportsPage() {
  const { companyId } = useSession()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(1)

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setDraft(null)
    setNotice('')
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setNotice('La importación de catálogo requiere un archivo CSV de la plantilla.')
      return
    }
    const csv = await file.text()
    const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim() !== '')
    if (lines.length < 2) {
      setNotice('El archivo debe contener encabezados y al menos una fila de productos.')
      return
    }
    if (lines[0]?.trim() !== headers) {
      setNotice('Los encabezados no coinciden con la plantilla. Descarga la plantilla actual y vuelve a intentarlo.')
      return
    }
    const rows = lines.slice(1).map((line) => line.split(','))
    if (rows.some((row) => row.length !== labels.length)) {
      setNotice('El CSV contiene filas con un número de columnas distinto a la plantilla. Corrige el archivo y vuelve a cargarlo.')
      return
    }
    setPage(1)
    setDraft({ name: file.name, rows, count: rows.length })
  }

  function editCell(rowIndex: number, columnIndex: number, value: string) {
    setDraft((current) => {
      if (!current) return null
      const rows = current.rows.slice()
      rows[rowIndex] = [...(rows[rowIndex] ?? [])]
      rows[rowIndex][columnIndex] = value.replace(/[\r\n,]/g, ' ')
      return { ...current, rows }
    })
  }

  async function onImport() {
    if (!draft || !companyId) return
    setBusy(true)
    setNotice('')
    try {
      await importCatalog(companyId, `${headers}\n${draft.rows.map((row) => row.join(',')).join('\n')}\n`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products', companyId] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-documents', companyId] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] }),
      ])
      setNotice(`${draft.count} filas enviadas. Revisa el catálogo y el inventario para confirmar el resultado.`)
      setDraft(null)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo importar el catálogo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ops-page imports-page">
      <PageIntro title="Importar catálogo" description="Carga productos y su inventario inicial desde la plantilla CSV de tu empresa. Revisa el archivo antes de confirmar." action={<Button type="button" variant="quiet" onClick={() => { void downloadCatalogTemplate().catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'No se pudo descargar la plantilla.')) }}>Descargar plantilla</Button>} />
      <div className="import-layout">
        <Panel title="1. Selecciona el archivo">
          <p className="section-copy">Usa la plantilla descargable. El archivo se envía al servidor únicamente al pulsar “Importar catálogo”.</p>
          <label className="import-dropzone" htmlFor="catalog-file">
            <span className="import-dropzone-icon" aria-hidden="true">↥</span>
            <strong>{draft?.name ?? 'Seleccionar CSV'}</strong>
            <small>Archivo .csv con encabezados de la plantilla</small>
            <input id="catalog-file" type="file" accept=".csv,text/csv" onChange={(event) => { void onFile(event) }} />
          </label>
        </Panel>
        <Panel title="2. Revisa y confirma">
          {draft ? <>
            <div className="import-summary"><strong>{draft.count}</strong><span>filas de productos detectadas</span></div>
            <p className="section-copy">Puedes corregir las celdas antes de importar. La validación final se realiza en el servidor.</p>
            <div className="import-preview table-scroll" aria-label="Productos del archivo editables"><table className="ui-table"><thead><tr><th scope="col">Fila</th>{labels.map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{draft.rows.slice((page - 1) * pageSize, page * pageSize).map((row, offset) => {
              const rowIndex = (page - 1) * pageSize + offset
              return <tr key={rowIndex}><th scope="row">{rowIndex + 2}</th>{row.map((cell, columnIndex) => <td key={columnIndex}><input className="import-cell" aria-label={`${labels[columnIndex]} fila ${rowIndex + 2}`} value={cell} onChange={(event) => editCell(rowIndex, columnIndex, event.target.value)} /></td>)}</tr>
            })}</tbody></table></div>
            <div className="table-footer"><p>Página {page} de {Math.ceil(draft.rows.length / pageSize)}</p><div className="pager"><Button type="button" variant="quiet" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button><Button type="button" variant="quiet" disabled={page * pageSize >= draft.rows.length} onClick={() => setPage(page + 1)}>Siguiente</Button></div></div>
            <Button type="button" disabled={busy || !companyId} onClick={() => { void onImport() }}>{busy ? 'Importando…' : 'Importar catálogo'}</Button>
          </> : <div className="workflow-empty"><span aria-hidden="true">02</span><p>Selecciona un CSV para ver un resumen antes de importarlo.</p></div>}
        </Panel>
      </div>
      {notice ? <p className="dev-note" role="status">{notice}</p> : null}
    </div>
  )
}
