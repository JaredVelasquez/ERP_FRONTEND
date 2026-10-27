import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { useSession } from '@/app/providers/session'
import { Button } from '@/shared/ui/button'
import { PageIntro, Panel } from '@/shared/ui/ops'
import { ListSkeleton, TableSkeleton } from '@/shared/ui/skeleton'
import type { AccountNode } from '../account'
import { useAccountTree } from '../hooks/use-account-tree'
import { journalMessages as messages } from '../journal-messages'
import { listJournalEntries, postJournalEntry, voidJournalEntry, type JournalEntry, type JournalLine } from '../journal-api'

type EntryMode = 'income' | 'expense' | 'manual'
type DraftLine = { id: string; accountCode: string; side: 'debit' | 'credit'; amount: string }

const money = new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL', minimumFractionDigits: 2 })
const OTHER_INCOME = '4.02.01.001'
const GENERAL_EXPENSE = '6.02.01.001'
const CASH_ACCOUNT = '1.01.01.001'

export function JournalEntriesPage() {
  const { companyId, grants } = useSession()
  const queryClient = useQueryClient()
  const chart = useAccountTree(companyId)
  const [mode, setMode] = useState<EntryMode>('expense')
  const [occurredAt, setOccurredAt] = useState(localDay(new Date()))
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [cashAccount, setCashAccount] = useState(CASH_ACCOUNT)
  const [lines, setLines] = useState<DraftLine[]>([newLine(CASH_ACCOUNT, 'debit'), newLine(GENERAL_EXPENSE, 'credit')])
  const [notice, setNotice] = useState('')
  const canEdit = grants?.some((grant) => grant.module === 'accounting' && grant.access === 'edit') ?? false
  const accounts = useMemo(() => flatten(chart.data ?? []), [chart.data])
  const postableAccounts = accounts.filter((account) => account.postable)
  const cashAccounts = postableAccounts.filter((account) => account.code.startsWith('1.01.01.'))
  const entries = useQuery({ queryKey: ['accounting', 'journal-entries', companyId], queryFn: listJournalEntries, enabled: Boolean(companyId) })
  const save = useMutation({
    mutationFn: postJournalEntry,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounting', 'journal-entries', companyId] }),
        queryClient.invalidateQueries({ queryKey: ['reports', 'financial', companyId] }),
      ])
      setDescription('')
      setAmount('')
      setNotice(messages.saved)
    },
    onError: (error: Error) => setNotice(error.message || messages.saveFailed),
  })
  const reverse = useMutation({
    mutationFn: voidJournalEntry,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounting', 'journal-entries', companyId] }),
        queryClient.invalidateQueries({ queryKey: ['reports', 'financial', companyId] }),
      ])
      setNotice(messages.voidedNotice)
    },
    onError: (error: Error) => setNotice(error.message || messages.voidFailed),
  })
  const totals = lineTotals(lines)
  const balanced = totals.debit > 0 && totals.debit === totals.credit

  function chooseMode(next: EntryMode) {
    setMode(next)
    setNotice('')
    setLines([newLine(next === 'income' ? CASH_ACCOUNT : GENERAL_EXPENSE, 'debit'),
      newLine(next === 'income' ? OTHER_INCOME : CASH_ACCOUNT, 'credit')])
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canEdit || companyId === null || companyId === '' || !occurredAt || description.trim() === '') return
    const journalLines = buildLines(mode, amount, cashAccount, lines)
    if (journalLines === null) {
      setNotice(messages.unbalanced)
      return
    }
    save.mutate({ occurredAt: occurredAt + 'T12:00:00.000Z', description: description.trim(), idempotencyKey: crypto.randomUUID(), lines: journalLines })
  }

  function requestVoid(entry: JournalEntry) {
    if (window.confirm(messages.confirmVoid)) reverse.mutate(entry.id)
  }

  return <main className="ops-page journal-page">
    <PageIntro title={messages.title} description={messages.description} />
    {!canEdit ? <p className="journal-note">{messages.viewerNote}</p> : null}
    {notice ? <p className="journal-notice" role="status">{notice}</p> : null}
    {chart.isError ? <Panel><p role="alert">{messages.noAccounts}</p></Panel> : null}
    {canEdit && chart.isPending ? <Panel title="Nuevo movimiento"><ListSkeleton rows={3} label="Cargando cuentas para el asiento…" /></Panel> : null}
    {canEdit && chart.data ? <Panel title="Nuevo movimiento">
      <div className="journal-mode-tabs" role="tablist" aria-label="Tipo de asiento">
        <button type="button" role="tab" aria-selected={mode === 'expense'} onClick={() => chooseMode('expense')}>{messages.expense}</button>
        <button type="button" role="tab" aria-selected={mode === 'income'} onClick={() => chooseMode('income')}>{messages.income}</button>
        <button type="button" role="tab" aria-selected={mode === 'manual'} onClick={() => chooseMode('manual')}>{messages.manual}</button>
      </div>
      <form className="journal-form" onSubmit={submit}>
        <div className="journal-form-meta">
          <label className="field">{messages.date}<input type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required /></label>
          <label className="field journal-description">{messages.descriptionLabel}<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={250} placeholder={messages.descriptionPlaceholder} required /></label>
        </div>
        {mode === 'manual' ? <ManualLines accounts={postableAccounts} lines={lines} onChange={setLines} /> : <QuickLines
          mode={mode} amount={amount} cashAccount={cashAccount} accounts={cashAccounts}
          onAmount={setAmount} onCashAccount={setCashAccount}
        />}
        <div className="journal-form-footer">
          {mode === 'manual' ? <div className="journal-totals"><span>{messages.totalDebit} <strong>{money.format(totals.debit)}</strong></span><span>{messages.totalCredit} <strong>{money.format(totals.credit)}</strong></span></div>
            : <p className="journal-accounting-hint">{mode === 'expense' ? messages.generalExpense + ' → ' + messages.cashAccount.toLowerCase() : messages.cashAccount + ' → ' + messages.otherIncome}</p>}
          {mode === 'manual' && !balanced ? <span className="journal-validation">{messages.unbalanced}</span> : null}
          <Button type="submit" disabled={save.isPending || (mode === 'manual' && !balanced) || postableAccounts.length === 0}>
            {save.isPending ? 'Guardando…' : messages.save}
          </Button>
        </div>
      </form>
    </Panel> : null}
    <Panel title={messages.history}>
      {entries.isPending ? <TableSkeleton columns={6} label={messages.loading} /> : null}
      {entries.isError ? <div className="table-load-error" role="alert"><p>{messages.unavailable}</p><Button type="button" variant="quiet" onClick={() => void entries.refetch()}>{messages.retry}</Button></div> : null}
      {entries.data?.length === 0 ? <p className="empty-row">{messages.empty}</p> : null}
      {entries.data && entries.data.length > 0 ? <div className="table-scroll"><table className="ui-table journal-table">
        <thead><tr><th>Fecha</th><th>Descripción</th><th>Debe</th><th>Haber</th><th>{messages.status}</th><th>{messages.actions}</th></tr></thead>
        <tbody>{entries.data.map((entry) => <EntryRow key={entry.id} entry={entry} canEdit={canEdit} busy={reverse.isPending} onVoid={requestVoid} />)}</tbody>
      </table></div> : null}
    </Panel>
  </main>
}

function QuickLines({ mode, amount, cashAccount, accounts, onAmount, onCashAccount }: {
  mode: Exclude<EntryMode, 'manual'>; amount: string; cashAccount: string; accounts: AccountNode[];
  onAmount: (value: string) => void; onCashAccount: (value: string) => void;
}) {
  return <div className="journal-quick-grid">
    <label className="field">{messages.amount}<input type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => onAmount(event.target.value)} required /></label>
    <label className="field">{messages.cashAccount}<select className="ui-control" value={cashAccount} onChange={(event) => onCashAccount(event.target.value)}>
      {accounts.map((account) => <option key={account.code} value={account.code}>{account.code} · {account.name}</option>)}
    </select></label>
    <div className="journal-preview-lines" aria-label="Partidas generadas">
      <span>{mode === 'income' ? cashAccount + ' · Debe' : GENERAL_EXPENSE + ' · Debe'}</span>
      <span>{mode === 'income' ? OTHER_INCOME + ' · Haber' : cashAccount + ' · Haber'}</span>
    </div>
  </div>
}

function ManualLines({ accounts, lines, onChange }: { accounts: AccountNode[]; lines: DraftLine[]; onChange: (next: DraftLine[]) => void }) {
  return <div className="journal-lines-editor">
    <div className="journal-lines-heading"><span>{messages.account}</span><span>{messages.side}</span><span>{messages.amount}</span><span /></div>
    {lines.map((line) => <div className="journal-line" key={line.id}>
      <select className="ui-control" aria-label={messages.account} value={line.accountCode} onChange={(event) => onChange(lines.map((current) => current.id === line.id ? { ...current, accountCode: event.target.value } : current))} required>
        {accounts.map((account) => <option key={account.code} value={account.code}>{account.code} · {account.name}</option>)}
      </select>
      <select className="ui-control" aria-label={messages.side} value={line.side} onChange={(event) => onChange(lines.map((current) => current.id === line.id ? { ...current, side: event.target.value as DraftLine['side'] } : current))}>
        <option value="debit">{messages.debit}</option><option value="credit">{messages.credit}</option>
      </select>
      <input className="ui-control" aria-label={messages.amount} type="number" min="0.01" step="0.01" value={line.amount} onChange={(event) => onChange(lines.map((current) => current.id === line.id ? { ...current, amount: event.target.value } : current))} required />
      <button type="button" className="journal-remove" aria-label={messages.removeLine} disabled={lines.length <= 2} onClick={() => onChange(lines.filter((current) => current.id !== line.id))}>×</button>
    </div>)}
    <Button type="button" variant="quiet" onClick={() => onChange([...lines, newLine(accounts[0]?.code ?? '', 'debit')])}>{messages.addLine}</Button>
  </div>
}

function EntryRow({ entry, canEdit, busy, onVoid }: { entry: JournalEntry; canEdit: boolean; busy: boolean; onVoid: (entry: JournalEntry) => void }) {
  const totalDebit = entry.lines.reduce((total, line) => total + line.debit, 0)
  const totalCredit = entry.lines.reduce((total, line) => total + line.credit, 0)
  const title = entry.reversalOf ? messages.reversal + ' de ' + entry.description.replace(/^Anulación:\s*/, '') : entry.description
  const state = entry.status === 'voided' ? messages.voided : entry.reversalOf ? messages.reversal : 'Confirmado'
  return <tr>
    <td>{entry.occurredAt.slice(0, 10)}</td><td className="journal-description-cell">{title}<small>{entry.id.slice(0, 8)}</small></td>
    <td>{money.format(totalDebit)}</td><td>{money.format(totalCredit)}</td><td><span className={'journal-status' + (entry.status === 'voided' ? ' journal-status--voided' : '')}>{state}</span></td>
    <td>{canEdit && entry.status === 'confirmed' && entry.reversalOf === null ? <Button type="button" variant="quiet" disabled={busy} onClick={() => onVoid(entry)}>{messages.void}</Button> : '—'}</td>
  </tr>
}

function buildLines(mode: EntryMode, amount: string, cashAccount: string, manual: DraftLine[]): JournalLine[] | null {
  if (mode !== 'manual') {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0 || cashAccount === '') return null
    const rounded = Math.round(value * 100) / 100
    if (mode === 'income') return [{ accountCode: cashAccount, debit: rounded, credit: 0 }, { accountCode: OTHER_INCOME, debit: 0, credit: rounded }]
    return [{ accountCode: GENERAL_EXPENSE, debit: rounded, credit: 0 }, { accountCode: cashAccount, debit: 0, credit: rounded }]
  }
  if (manual.length < 2 || manual.some((line) => line.accountCode === '' || !Number.isFinite(Number(line.amount)) || Number(line.amount) <= 0)) return null
  const result = manual.map((line) => ({
    accountCode: line.accountCode,
    debit: line.side === 'debit' ? Math.round(Number(line.amount) * 100) / 100 : 0,
    credit: line.side === 'credit' ? Math.round(Number(line.amount) * 100) / 100 : 0,
  }))
  const totals = lineTotals(manual)
  return totals.debit > 0 && totals.debit === totals.credit ? result : null
}

function lineTotals(lines: readonly DraftLine[]) {
  const totals = lines.reduce((sum, line) => {
    const amount = Number(line.amount)
    const cents = Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) : 0
    return { debit: sum.debit + (line.side === 'debit' ? cents : 0), credit: sum.credit + (line.side === 'credit' ? cents : 0) }
  }, { debit: 0, credit: 0 })
  return { debit: totals.debit / 100, credit: totals.credit / 100 }
}

function flatten(nodes: readonly AccountNode[]): AccountNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)])
}

function newLine(accountCode: string, side: DraftLine['side']): DraftLine {
  return { id: crypto.randomUUID(), accountCode, side, amount: '' }
}

function localDay(date: Date): string {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
}
