import { createContext, useContext, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Tree, type NodeRendererProps, type TreeApi } from 'react-arborist'
import { accountLevel, type AccountNode } from '../account'
import { accountingMessages } from '../messages'

const EditContext = createContext<(account: AccountNode) => void>(() => undefined)

export function AccountTree({ nodes, onEdit }: { nodes: readonly AccountNode[]; onEdit: (account: AccountNode) => void }) {
  const treeRef = useRef<TreeApi<AccountNode> | undefined>(undefined)
  const [search, setSearch] = useState('')
  const total = useMemo(() => countNodes(nodes), [nodes])
  const matches = useMemo(() => search.trim() ? countMatches(nodes, search.trim()) : total, [nodes, search, total])

  return (
    <div className="account-tree-wrap">
      <div className="account-tools">
        <label className="account-search">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="8.8" cy="8.8" r="5.7" /><path d="m13 13 4 4" /></svg>
          <span className="sr-only">Buscar cuenta por código o nombre</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código o nombre…" />
          {search ? <button type="button" aria-label="Limpiar búsqueda" onClick={() => setSearch('')}>×</button> : null}
        </label>
        <span className="account-count" role="status">{search.trim() ? `${matches} coincidencias` : `${total} cuentas`}</span>
        <div className="account-tree-actions">
          <button type="button" onClick={() => treeRef.current?.openAll()} disabled={nodes.length === 0}>{accountingMessages.expandAll}</button>
          <button type="button" onClick={() => treeRef.current?.closeAll()} disabled={nodes.length === 0}>{accountingMessages.collapseAll}</button>
        </div>
      </div>
      <div className="account-column-head" aria-hidden="true"><span>Cuenta</span><span>Nivel</span><span>Asientos</span><span>Editar</span></div>
      {nodes.length === 0 ? <p className="account-empty">{accountingMessages.empty}</p> : matches === 0 ? <p className="account-empty">No hay cuentas que coincidan con «{search.trim()}».</p> : (
        <EditContext.Provider value={onEdit}>
          <Tree<AccountNode>
            ref={treeRef}
            data={nodes}
            idAccessor="code"
            childrenAccessor={(account) => accountLevel(account.code) === 'subaccount' || account.children.length === 0 ? null : account.children}
            openByDefault={false}
            searchTerm={search}
            searchMatch={(node, term) => `${node.data.code} ${node.data.name}`.toLocaleLowerCase('es-HN').includes(term.toLocaleLowerCase('es-HN'))}
            width="100%"
            height={Math.min(620, Math.max(340, total * 58))}
            indent={22}
            rowHeight={58}
            disableDrag
            disableDrop
            disableEdit
            selectionFollowsFocus
            aria-label={accountingMessages.chart}
            className="account-tree"
            onActivate={(node) => toggleInternal(node)}
          >
            {AccountRow}
          </Tree>
        </EditContext.Provider>
      )}
      <p className="account-keyboard">{accountingMessages.keyboard}</p>
    </div>
  )
}

function countNodes(nodes: readonly AccountNode[]): number {
  return nodes.reduce((count, node) => count + 1 + countNodes(node.children), 0)
}

function countMatches(nodes: readonly AccountNode[], term: string): number {
  const needle = term.toLocaleLowerCase('es-HN')
  return nodes.reduce((count, node) => count + Number(`${node.code} ${node.name}`.toLocaleLowerCase('es-HN').includes(needle)) + countMatches(node.children, term), 0)
}

function toggleInternal(node: { isLeaf: boolean; toggle: () => void }): void {
  if (!node.isLeaf) node.toggle()
}

function AccountRow({ node, style }: NodeRendererProps<AccountNode>) {
  const onEdit = useContext(EditContext)
  const level = accountLevel(node.data.code)
  const openLabel = node.isOpen ? accountingMessages.closeNode : accountingMessages.openNode
  return (
    <div className="account-row" style={{ ...style, '--account-depth': node.level } as CSSProperties} data-level={level} data-selected={node.isSelected ? 'true' : 'false'}>
      <div className="account-identity">
        {node.isLeaf ? <span className="account-toggle account-toggle--leaf" aria-hidden="true" /> : (
          <button type="button" className="account-toggle" aria-expanded={node.isOpen} aria-label={`${openLabel} ${node.data.code}`} onClick={(event) => { event.stopPropagation(); node.toggle() }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5.5 3.5 4.5 4.5-4.5 4.5" /></svg>
          </button>
        )}
        <span className="account-icon" aria-hidden="true">
          {node.isLeaf ? <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 3.5h7l3 3v10H5z" /><path d="M12 3.5v3h3M7.5 10h5M7.5 13h5" /></svg> : <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h4l1.7 2H16a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5z" /><path d="M2.5 8h15" /></svg>}
        </span>
        <span className="account-code">{node.data.code}</span>
        <span className="account-name" title={node.data.name}>{node.data.name}</span>
      </div>
      <span className="account-meta">{accountingMessages.levels[level]}</span>
      <span className={node.data.postable ? 'account-open' : 'account-closed'}>{node.data.postable ? 'Habilitada' : 'Agrupadora'}</span>
      <button type="button" className="account-edit" aria-label={`Editar ${node.data.code} ${node.data.name}`} title={accountingMessages.edit} onClick={(event) => { event.stopPropagation(); onEdit(node.data) }}>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m11.5 5 3.5 3.5M3.5 16.5l3.8-.7L16 7.1a1.5 1.5 0 0 0 0-2.1l-1-1a1.5 1.5 0 0 0-2.1 0l-8.7 8.7z" /></svg>
      </button>
    </div>
  )
}
