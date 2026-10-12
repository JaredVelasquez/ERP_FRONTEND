import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable, type VisibilityState } from '@tanstack/react-table'
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  saveTableLayout,
  readTableLayout,
  type ColumnSetting,
  type TableLayout,
} from '@/shared/api/layouts'
import { shellMessages, tableMessages } from '@/shared/i18n/messages'
import {
  canHideColumn,
  hiddenColumnSettings,
  placeColumnMenu,
  reorderColumnSettings,
  sameColumnLayout,
  sortTableRows,
  withVisibility,
  type ColumnSort,
} from '@/shared/lib/table-columns'
import { Button } from '@/shared/ui/button'
import { SearchField, SelectField } from '@/shared/ui/fields'
import { Panel } from '@/shared/ui/ops'

export interface TableColumn {
  key: string
  label: string
}

export interface TableRow {
  id: string
  cells: Record<string, string>
}

export interface PageQuery {
  page: number
  pageSize: number
  search: string
  sort: ColumnSort | null
}

export interface PageResult {
  items: TableRow[]
  page: number
  pageSize: number
  total: number
}

type ServerTableProps = {
  tableKey: string
  companyId: string | null
  columns: readonly TableColumn[]
  queryKey: string
  empty: string
  searchHint?: string
  remoteSort?: boolean
  load: (query: PageQuery) => Promise<PageResult>
}

type OpenMenu = {
  columnKey: string
  x: number
  y: number
  opener: HTMLElement
}

const helper = createColumnHelper<TableRow>()

export function ServerTable({ tableKey, companyId, columns, queryKey, empty, searchHint, remoteSort = false, load }: ServerTableProps) {
  const queryClient = useQueryClient()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const columnsButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuStateRef = useRef<OpenMenu | null>(null)
  const settingsRef = useRef<ColumnSetting[]>([])
  const pageSizeRef = useRef(25)
  const sortRef = useRef<ColumnSort | null>(null)
  const saveSeq = useRef(0)
  const [page, setPage] = useState(1)
  const [searchDraft, setSearchDraft] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [sort, setSort] = useState<ColumnSort | null>(null)
  const [menu, setMenu] = useState<OpenMenu | null>(null)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const [layoutError, setLayoutError] = useState<string | null>(null)
  const enabled = companyId !== null && companyId !== ''
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    setPage(1)
  }, [queryKey])

  const layout = useQuery({
    queryKey: ['table-layout', companyId, tableKey],
    enabled,
    queryFn: () => readTableLayout(tableKey),
    retry: false,
  })
  const pageSize = layout.data?.pageSize ?? 25
  const rows = useQuery({
    queryKey: [queryKey, companyId, page, pageSize, appliedSearch, remoteSort ? sort : null],
    enabled,
    queryFn: () => load({ page, pageSize, search: appliedSearch, sort: remoteSort ? sort : null }),
    retry: false,
  })
  const result = rows.data
  const total = result?.total ?? 0
  const settings = mergeColumns(columns, layout.data?.columns)
  const sortedItems = useMemo(
    () => remoteSort ? (result?.items ?? []) : sortTableRows(result?.items ?? [], sort),
    [remoteSort, result?.items, sort],
  )
  const columnOrder = settings.map((column) => column.key)
  const columnVisibility = visibilityOf(settings)
  const defs = useMemo(() => columns.map((column) => helper.accessor((row) => row.cells[column.key] ?? '', {
    id: column.key,
    header: column.label,
    cell: (info) => cellOf(column.key, info.getValue()),
  })), [columns])
  const table = useReactTable({
    data: sortedItems,
    columns: defs,
    state: { columnOrder, columnVisibility },
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualPagination: true,
  })
  const visibleColumns = table.getVisibleLeafColumns()
  const hidden = hiddenColumnSettings(settings)
  const layoutReady = layout.isSuccess
  settingsRef.current = settings
  pageSizeRef.current = pageSize
  sortRef.current = sort
  menuStateRef.current = menu

  useEffect(() => {
    if (menu === null) {
      return
    }
    const node = menuRef.current
    node?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
    function onPointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      if (node?.contains(target) || menuStateRef.current?.opener.contains(target)) {
        return
      }
      dismissMenu()
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return
      }
      event.preventDefault()
      dismissMenu()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  function dismissMenu() {
    const opener = menuStateRef.current?.opener ?? null
    setMenu(null)
    if (opener !== null && opener.isConnected) {
      opener.focus()
      return
    }
    columnsButtonRef.current?.focus()
  }

  async function persist(nextPageSize: number, nextColumns: ColumnSetting[], resetPage: boolean) {
    if (!enabled || layout.data === undefined) {
      return
    }
    const seq = saveSeq.current + 1
    saveSeq.current = seq
    const layoutKey = ['table-layout', companyId, tableKey]
    const previous = queryClient.getQueryData<TableLayout>(layoutKey)
    const optimistic: TableLayout = { tableKey, pageSize: nextPageSize, columns: nextColumns }
    queryClient.setQueryData(layoutKey, optimistic)
    try {
      const saved = await saveTableLayout(tableKey, { pageSize: nextPageSize, columns: nextColumns })
      if (seq !== saveSeq.current) {
        return
      }
      queryClient.setQueryData(layoutKey, saved)
      setLayoutError(null)
    } catch {
      if (seq !== saveSeq.current) {
        return
      }
      if (previous !== undefined) {
        queryClient.setQueryData(layoutKey, previous)
      }
      setLayoutError(tableMessages.layoutFailed)
    }
    if (resetPage) {
      setPage(1)
    }
  }

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppliedSearch(searchDraft.trim())
    setPage(1)
  }

  function onDragStart(event: DragStartEvent) {
    if (typeof event.active.id !== 'string') {
      return
    }
    setDraggingKey(event.active.id)
    setMenu(null)
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingKey(null)
    const activeKey = event.active.id
    const overKey = event.over?.id
    if (typeof activeKey !== 'string' || typeof overKey !== 'string') {
      return
    }
    const next = reorderColumnSettings(settingsRef.current, activeKey, overKey)
    if (sameColumnLayout(next, settingsRef.current)) {
      return
    }
    void persist(pageSizeRef.current, next, false)
  }

  function onOpenMenu(columnKey: string, opener: HTMLButtonElement) {
    const current = menuStateRef.current
    if (current?.columnKey === columnKey && current.opener === opener) {
      dismissMenu()
      return
    }
    const rect = opener.getBoundingClientRect()
    const point = placeColumnMenu(rect.left, rect.bottom + 4, window.innerWidth, window.innerHeight)
    setMenu({ columnKey, x: point.x, y: point.y, opener })
  }

  function onHeaderContextMenu(columnKey: string, opener: HTMLElement, event: MouseEvent<HTMLTableCellElement>) {
    event.preventDefault()
    const point = placeColumnMenu(event.clientX, event.clientY, window.innerWidth, window.innerHeight)
    setMenu({ columnKey, x: point.x, y: point.y, opener })
  }

  function hideColumn(columnKey: string) {
    const next = withVisibility(settingsRef.current, columnKey, false)
    setMenu(null)
    columnsButtonRef.current?.focus()
    if (sameColumnLayout(next, settingsRef.current)) {
      return
    }
    if (sortRef.current?.column === columnKey) {
      setSort(null)
      resetSortedPage()
    }
    void persist(pageSizeRef.current, next, false)
  }

  function showColumn(columnKey: string) {
    const next = withVisibility(settingsRef.current, columnKey, true)
    if (sameColumnLayout(next, settingsRef.current)) {
      return
    }
    void persist(pageSizeRef.current, next, false)
  }

  function chooseSort(columnKey: string, direction: 'asc' | 'desc') {
    setSort({ column: columnKey, direction })
    resetSortedPage()
    dismissMenu()
  }

  function clearSort() {
    setSort(null)
    resetSortedPage()
    dismissMenu()
  }

  function resetSortedPage() {
    if (!remoteSort) {
      return
    }
    setPage(1)
  }

  const menuColumn = columns.find((column) => column.key === menu?.columnKey)

  return (
    <Panel>
      <form className="toolbar" onSubmit={onSearch}>
        <div className="min-w-[min(280px,100%)] flex-1">
          <SearchField
            id={`${tableKey}-search`}
            label={tableMessages.search}
            hint={searchHint}
            value={searchDraft}
            onValue={setSearchDraft}
          />
        </div>
        <Button type="submit" variant="quiet">{tableMessages.searchAction}</Button>
        <SelectField
          id={`${tableKey}-size`}
          name="pageSize"
          label={tableMessages.pageSize}
          value={String(pageSize)}
          onValue={(value) => {
            void persist(Number(value), settings, true)
          }}
          options={[
            { value: '25', label: '25' },
            { value: '50', label: '50' },
            { value: '100', label: '100' },
          ]}
        />
        <button
          ref={columnsButtonRef}
          type="button"
          className="ghost-button"
          onClick={() => {
            setMenu(null)
            dialogRef.current?.showModal()
          }}
        >
          {tableMessages.columns}
        </button>
      </form>
      {rows.isFetching ? <p role="status">{shellMessages.loading}</p> : null}
      {rows.isError ? <p className="form-alert" role="status">{empty}</p> : null}
      {layoutError ? <p className="form-alert" role="status">{layoutError}</p> : null}
      {visibleColumns.length === 0 || (result?.items.length ?? 0) === 0 ? <p className="empty-row">{empty}</p> : null}
      {visibleColumns.length > 0 && (result?.items.length ?? 0) > 0 ? (
        <div className="table-scroll">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            accessibility={{
              screenReaderInstructions: { draggable: tableMessages.dragInstructions },
              announcements: columnAnnouncements((key) => labelFor(columns, key)),
            }}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setDraggingKey(null)}
          >
            <table className="ui-table">
              <thead>
                <tr>
                  <SortableContext items={visibleColumns.map((column) => column.id)} strategy={horizontalListSortingStrategy}>
                    {visibleColumns.map((column) => (
                      <SortableColumnHeader
                        key={column.id}
                        columnKey={column.id}
                        label={String(column.columnDef.header)}
                        sort={sort}
                        menuOpen={menu?.columnKey === column.id}
                        dragDisabled={!layoutReady}
                        onOpenMenu={onOpenMenu}
                        onContextMenu={onHeaderContextMenu}
                      />
                    ))}
                  </SortableContext>
                </tr>
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <DragOverlay dropAnimation={null}>
              {draggingKey === null ? null : <div className="col-drag-preview">{labelFor(columns, draggingKey)}</div>}
            </DragOverlay>
          </DndContext>
        </div>
      ) : null}
      <div className="table-footer">
        <p>{tableMessages.range(rangeFrom(page, pageSize, total), rangeTo(page, pageSize, total), total)}</p>
        <div className="pager">
          <button type="button" className="ghost-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {tableMessages.previous}
          </button>
          <button type="button" className="ghost-button" disabled={page * pageSize >= total} onClick={() => setPage(page + 1)}>
            {tableMessages.next}
          </button>
        </div>
      </div>
      {menu !== null && menuColumn !== undefined ? createPortal(
        <div
          ref={menuRef}
          id={`${tableKey}-column-menu`}
          className="col-menu"
          role="menu"
          aria-label={`${tableMessages.columnOptions} ${menuColumn.label}`}
          style={{ left: menu.x, top: menu.y }}
          onKeyDown={onMenuKeyDown}
        >
          <button type="button" role="menuitem" disabled={!canHideColumn(settings)} onClick={() => hideColumn(menu.columnKey)}>
            {tableMessages.hide}
          </button>
          <button type="button" role="menuitem" onClick={() => chooseSort(menu.columnKey, 'asc')}>
            {tableMessages.sortAsc}
          </button>
          <button type="button" role="menuitem" onClick={() => chooseSort(menu.columnKey, 'desc')}>
            {tableMessages.sortDesc}
          </button>
          <button type="button" role="menuitem" disabled={sort === null} onClick={clearSort}>
            {tableMessages.clearSort}
          </button>
        </div>,
        document.body,
      ) : null}
      <dialog ref={dialogRef} className="dialog" aria-labelledby={`${tableKey}-columns-title`}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
          }}
        >
          <h2 id={`${tableKey}-columns-title`}>{tableMessages.columns}</h2>
          {hidden.length === 0 ? <p>{tableMessages.allVisible}</p> : null}
          {hidden.map((column) => (
            <div className="column-row" key={column.key}>
              <span>{labelFor(columns, column.key)}</span>
              <button type="button" className="ghost-button" onClick={() => showColumn(column.key)}>
                {tableMessages.show}
              </button>
            </div>
          ))}
          <div className="dialog-actions">
            <button type="button" className="ghost-button" onClick={() => dialogRef.current?.close()}>{tableMessages.close}</button>
          </div>
        </form>
      </dialog>
    </Panel>
  )
}

function SortableColumnHeader({
  columnKey,
  label,
  sort,
  menuOpen,
  dragDisabled,
  onOpenMenu,
  onContextMenu,
}: {
  columnKey: string
  label: string
  sort: ColumnSort | null
  menuOpen: boolean
  dragDisabled: boolean
  onOpenMenu: (columnKey: string, opener: HTMLButtonElement) => void
  onContextMenu: (columnKey: string, opener: HTMLElement, event: MouseEvent<HTMLTableCellElement>) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: columnKey, disabled: dragDisabled })
  return (
    <th
      ref={setNodeRef}
      scope="col"
      tabIndex={attributes.tabIndex}
      aria-label={label}
      aria-roledescription="columna movible"
      aria-sort={ariaSortOf(sort, columnKey)}
      className={isDragging ? 'col-draggable is-dragging' : 'col-draggable'}
      onContextMenu={(event) => onContextMenu(columnKey, event.currentTarget, event)}
      {...(listeners ?? {})}
    >
      <span className="col-head">
        <span className="col-head-label">
          {label}
          {sort?.column === columnKey ? <span className="col-sort-mark" aria-hidden="true">{sort.direction === 'asc' ? '↑' : '↓'}</span> : null}
        </span>
        <button
          type="button"
          className="col-menu-button"
          aria-label={`${tableMessages.columnOptions} ${label}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={(event) => onOpenMenu(columnKey, event.currentTarget)}
        >
          <ColumnMenuIcon />
        </button>
      </span>
    </th>
  )
}

function ColumnMenuIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="3.5" r="1.2" fill="currentColor" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
      <circle cx="8" cy="12.5" r="1.2" fill="currentColor" />
    </svg>
  )
}

function columnAnnouncements(labelOf: (key: string) => string): Announcements {
  return {
    onDragStart({ active }) {
      return tableMessages.pickedUp(labelOf(String(active.id)))
    },
    onDragOver({ active, over }) {
      const label = labelOf(String(active.id))
      if (over === null) {
        return tableMessages.draggedOff(label)
      }
      return tableMessages.draggedOver(label, labelOf(String(over.id)))
    },
    onDragEnd({ active, over }) {
      const label = labelOf(String(active.id))
      if (over === null) {
        return tableMessages.dropped(label)
      }
      return tableMessages.droppedOn(label, labelOf(String(over.id)))
    },
    onDragCancel({ active }) {
      return tableMessages.dragCancelled(labelOf(String(active.id)))
    },
  }
}

function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
  if (event.key === 'Escape') {
    return
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
    return
  }
  event.preventDefault()
  const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')]
  const current = items.indexOf(document.activeElement as HTMLButtonElement)
  items[nextMenuIndex(current, items.length, event.key === 'ArrowDown')]?.focus()
}

function nextMenuIndex(current: number, length: number, forward: boolean): number {
  if (length === 0) {
    return 0
  }
  if (current < 0) {
    return forward ? 0 : length - 1
  }
  const step = forward ? 1 : -1
  return (current + step + length) % length
}

function ariaSortOf(sort: ColumnSort | null, columnKey: string): 'ascending' | 'descending' | 'none' {
  if (sort === null || sort.column !== columnKey) {
    return 'none'
  }
  if (sort.direction === 'asc') {
    return 'ascending'
  }
  return 'descending'
}

function cellOf(key: string, value: string) {
  if (key !== 'status') {
    return value
  }
  return <span className="status-chip">{value}</span>
}

function visibilityOf(columns: readonly ColumnSetting[]): VisibilityState {
  const visibility: VisibilityState = {}
  for (const column of columns) {
    visibility[column.key] = column.visible
  }
  return visibility
}

function defaultColumns(columns: readonly TableColumn[]): ColumnSetting[] {
  return columns.map((column, sortOrder) => ({ key: column.key, visible: true, sortOrder }))
}

function mergeColumns(defined: readonly TableColumn[], saved: readonly ColumnSetting[] | undefined): ColumnSetting[] {
  const source = saved ?? defaultColumns(defined)
  return appendMissing(source, defined)
}

function appendMissing(source: readonly ColumnSetting[], defined: readonly TableColumn[]): ColumnSetting[] {
  const known = new Set(source.map((column) => column.key))
  const missing = defined.filter((column) => !known.has(column.key))
  return [
    ...[...source].sort((left, right) => left.sortOrder - right.sortOrder),
    ...missing.map((column, index) => ({ key: column.key, visible: true, sortOrder: source.length + index })),
  ]
}

function labelFor(columns: readonly TableColumn[], key: string): string {
  return columns.find((column) => column.key === key)?.label ?? key
}

function rangeFrom(page: number, pageSize: number, total: number): number {
  if (total === 0) {
    return 0
  }
  return (page - 1) * pageSize + 1
}

function rangeTo(page: number, pageSize: number, total: number): number {
  return Math.min(page * pageSize, total)
}
