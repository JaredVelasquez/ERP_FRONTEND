import { createContext, useContext, useRef } from 'react'
import { Tree, type NodeRendererProps, type TreeApi } from 'react-arborist'
import { accountLevel, type AccountNode } from '../account'
import { accountingMessages } from '../messages'

const EditContext = createContext<(account: AccountNode) => void>(() => undefined)

export function AccountTree({
  nodes,
  onEdit,
}: {
  nodes: readonly AccountNode[]
  onEdit: (account: AccountNode) => void
}) {
  const treeRef = useRef<TreeApi<AccountNode> | undefined>(undefined)
  if (nodes.length === 0) {
    return <p className="empty-row">{accountingMessages.empty}</p>
  }
  return (
    <div className="account-tree-wrap">
      <div className="toolbar">
        <button type="button" className="ghost-button" onClick={() => treeRef.current?.openAll()}>
          {accountingMessages.expandAll}
        </button>
        <button type="button" className="ghost-button" onClick={() => treeRef.current?.closeAll()}>
          {accountingMessages.collapseAll}
        </button>
      </div>
      <p className="account-hint">{accountingMessages.keyboard}</p>
      <EditContext.Provider value={onEdit}>
        <Tree<AccountNode>
          ref={treeRef}
          data={nodes}
          idAccessor="code"
          childrenAccessor="children"
          openByDefault={false}
          width="100%"
          height={560}
          indent={20}
          rowHeight={44}
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
    </div>
  )
}

function toggleInternal(node: { isLeaf: boolean; toggle: () => void }): void {
  if (node.isLeaf) {
    return
  }
  node.toggle()
}

function AccountRow({ node, style }: NodeRendererProps<AccountNode>) {
  const onEdit = useContext(EditContext)
  const level = accountLevel(node.data.code)
  const openLabel = node.isOpen ? accountingMessages.closeNode : accountingMessages.openNode
  return (
    <div className="account-row" style={style} data-selected={node.isSelected ? 'true' : 'false'}>
      {node.isLeaf ? <span className="account-toggle" aria-hidden="true" /> : (
        <button
          type="button"
          className="account-toggle"
          aria-expanded={node.isOpen}
          aria-label={`${openLabel} ${node.data.code}`}
          onClick={(event) => {
            event.stopPropagation()
            node.toggle()
          }}
        >
          {node.isOpen ? '▾' : '▸'}
        </button>
      )}
      <span className="account-code">{node.data.code}</span>
      <span className="account-name">{node.data.name}</span>
      <span className="account-meta">{accountingMessages.levels[level]}</span>
      <span className={node.data.postable ? 'account-open' : 'account-closed'}>
        {node.data.postable ? accountingMessages.acceptsEntries : accountingMessages.closed}
      </span>
      <button
        type="button"
        className="account-edit"
        onClick={(event) => {
          event.stopPropagation()
          onEdit(node.data)
        }}
      >
        {accountingMessages.edit}
      </button>
    </div>
  )
}
