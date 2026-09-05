'use client'

import {useMemo, useState, type FormEvent} from 'react'
import {useCamp} from '../lib/context'
import {committedOutflows, collectedThisMonth, daysOverdue, formatINR, formatOriginal, monthKey, originalWithINR, receivablesOutstanding, runwayWeeks, runningBalance, toINR, todayISO} from '../lib/finance'
import type {Invoice, Person, PersonalFinanceCategory, PersonalTransaction, Reimbursement, Settings, Transaction} from '../lib/types'
import SelectMenu from './SelectMenu'

const money = (value: number) => formatINR(value)
const dateAfter = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return todayISO(date) }
type SaveFormResult = {ok: boolean; error?: string}
const personalCategories: PersonalFinanceCategory[] = ['Salary','Food (Lunch)','Food (Dinner)','Food (Breakfast)','Food (Tea/Snacks)','Travel','Rent','Mess','Groceries','Cosmetics','Health','Savings']

function MetricCard({label,value,tint}:{label:string;value:string;tint?:'mint'|'coral'|'butter'|'lilac'|'sky'}) {
  return <article className={`finance-metric ${tint ?? ''}`}><p className="eyebrow">{label}</p><strong>{value}</strong></article>
}

export default function FinanceScreen() {
  const {transactions,invoices,reimbursements,personalTransactions,settings,currentPerson,addTransaction,updateTransaction,addInvoice,addReimbursement,setInvoiceSent,setInvoiceReceived,settleReimbursement,updateSettings,addPersonalTransaction,updatePersonalTransaction,deletePersonalTransaction} = useCamp()
  const [direction,setDirection] = useState<'all'|'in'|'out'>('all')
  const [category,setCategory] = useState('all')
  const [fromDate,setFromDate] = useState('')
  const [toDate,setToDate] = useState('')
  const [showTransactionModal,setShowTransactionModal] = useState(false)
  const [editingTransaction,setEditingTransaction] = useState<Transaction | null>(null)
  const [showInvoiceModal,setShowInvoiceModal] = useState(false)
  const [showReimbursementModal,setShowReimbursementModal] = useState(false)
  const [savingMessage,setSavingMessage] = useState('')
  const [busyId,setBusyId] = useState<string | null>(null)
  const [showSettings,setShowSettings] = useState(false)
  const [showAllTransactions,setShowAllTransactions] = useState(false)
  const [categoryMonth,setCategoryMonth] = useState(monthKey(todayISO()))
  const [personalPerson,setPersonalPerson] = useState<Person>(currentPerson)
  const [showPersonalModal,setShowPersonalModal] = useState(false)
  const [editingPersonal,setEditingPersonal] = useState<PersonalTransaction | null>(null)
  const today = todayISO()
  const snapshot = useMemo(() => ({
    balance: runningBalance(transactions, settings),
    collected: collectedThisMonth(transactions, settings),
    receivables: receivablesOutstanding(invoices, settings),
    committed: committedOutflows(reimbursements, settings),
    runway: runwayWeeks(transactions, settings),
  }), [transactions, invoices, reimbursements, settings])
  const categories = useMemo(() => Array.from(new Set(['Services', 'Content', 'Website', 'Training', 'Other', ...transactions.map((transaction) => transaction.category)])).sort(), [transactions])
  const filteredTransactions = useMemo(() => transactions.filter((transaction) => {
    if (direction !== 'all' && transaction.direction !== direction) return false
    if (category !== 'all' && transaction.category !== category) return false
    if (fromDate && transaction.date < fromDate) return false
    if (toDate && transaction.date > toDate) return false
    return true
  }).sort((a,b) => b.date.localeCompare(a.date)), [transactions, direction, category, fromDate, toDate])
  const overdueInvoices = invoices.filter((invoice) => daysOverdue(invoice) > 0)
  const missingFx = [...transactions,...invoices,...reimbursements].some((row) => row.currency !== 'INR' && toINR(row.amount, row.currency, settings.fxRates) === null)
  const monthly = useMemo(() => {
    const current = new Date()
    return Array.from({length:3},(_,index) => {
      const date = new Date(current.getFullYear(), current.getMonth() - (2 - index), 1)
      const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`
      const inTotal = transactions.filter((transaction) => transaction.direction === 'in' && monthKey(transaction.date) === key).reduce((sum, transaction) => sum + (toINR(transaction.amount, transaction.currency, settings.fxRates) ?? 0),0)
      const outTotal = transactions.filter((transaction) => transaction.direction === 'out' && monthKey(transaction.date) === key).reduce((sum, transaction) => sum + (toINR(transaction.amount, transaction.currency, settings.fxRates) ?? 0),0)
      return {key,label:date.toLocaleDateString('en-IN',{month:'short'}),inTotal,outTotal}
    })
  }, [transactions, settings.fxRates])
  const categorySpend = useMemo(() => {
    const totals = new Map<string,number>()
    transactions.forEach((transaction) => {
      if (transaction.direction !== 'out' || monthKey(transaction.date) !== categoryMonth) return
      totals.set(transaction.category,(totals.get(transaction.category) ?? 0) + (toINR(transaction.amount, transaction.currency, settings.fxRates) ?? 0))
    })
    return Array.from(totals.entries()).sort((a,b) => b[1] - a[1])
  }, [transactions, settings.fxRates, categoryMonth])
  const categoryRevenue = useMemo(() => {
    const totals = new Map<string,number>()
    transactions.forEach((transaction) => {
      if (transaction.direction !== 'in' || monthKey(transaction.date) !== categoryMonth) return
      totals.set(transaction.category,(totals.get(transaction.category) ?? 0) + (toINR(transaction.amount, transaction.currency, settings.fxRates) ?? 0))
    })
    return Array.from(totals.entries()).sort((a,b) => b[1] - a[1])
  }, [transactions, settings.fxRates, categoryMonth])
  const maxMonthly = Math.max(1,...monthly.flatMap((month) => [month.inTotal,month.outTotal]))
  const maxCategory = Math.max(1,...categorySpend.map(([,value]) => value))
  const maxRevenue = Math.max(1,...categoryRevenue.map(([,value]) => value))
  const visibleTransactions = showAllTransactions ? filteredTransactions : filteredTransactions.slice(0, 5)
  const personalRows = useMemo(() => personalTransactions.filter((entry) => entry.person === personalPerson).sort((a,b) => b.date.localeCompare(a.date)), [personalTransactions, personalPerson])
  const personalMonth = monthKey(today)
  const personalIn = personalRows.filter((entry) => entry.direction === 'in' && monthKey(entry.date) === personalMonth).reduce((sum, entry) => sum + (toINR(entry.amount, entry.currency, settings.fxRates) ?? 0), 0)
  const personalOut = personalRows.filter((entry) => entry.direction === 'out' && monthKey(entry.date) === personalMonth).reduce((sum, entry) => sum + (toINR(entry.amount, entry.currency, settings.fxRates) ?? 0), 0)

  function shiftCategoryMonth(delta: number) {
    const [year, month] = categoryMonth.split('-').map(Number)
    const next = new Date(year, month - 1 + delta, 1)
    setCategoryMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
  }

  const categoryMonthLabel = new Date(`${categoryMonth}-15T12:00:00`).toLocaleDateString('en-IN', {month: 'long', year: 'numeric'})

  async function saveNewTransaction(transaction: Transaction): Promise<SaveFormResult> {
    setSavingMessage('')
    try {
      const result = await addTransaction(transaction)
      if (result.error) { setSavingMessage(result.error); return {ok: false, error: result.error} }
      setSavingMessage('Transaction saved')
      return {ok: true}
    } catch {
      setSavingMessage('Could not save transaction')
      return {ok: false, error: 'Could not save transaction'}
    }
  }

  async function saveEditedTransaction(transaction: Transaction): Promise<SaveFormResult> {
    setSavingMessage('')
    try {
      const result = await updateTransaction(transaction.id, transaction)
      if (result.error) { setSavingMessage(result.error); return {ok: false, error: result.error} }
      setSavingMessage('Transaction updated')
      return {ok: true}
    } catch {
      setSavingMessage('Could not update transaction')
      return {ok: false, error: 'Could not update transaction'}
    }
  }

  async function saveNewInvoice(invoice: Invoice): Promise<SaveFormResult> {
    setSavingMessage('')
    try {
      const result = await addInvoice(invoice)
      if (result.error) { setSavingMessage(result.error); return {ok: false, error: result.error} }
      setSavingMessage('Invoice saved')
      return {ok: true}
    } catch {
      setSavingMessage('Could not save invoice')
      return {ok: false, error: 'Could not save invoice'}
    }
  }

  async function saveNewReimbursement(reimbursement: Reimbursement): Promise<SaveFormResult> {
    setSavingMessage('')
    try {
      const result = await addReimbursement(reimbursement)
      if (result.error) { setSavingMessage(result.error); return {ok: false, error: result.error} }
      setSavingMessage('Reimbursement saved')
      return {ok: true}
    } catch {
      setSavingMessage('Could not save reimbursement')
      return {ok: false, error: 'Could not save reimbursement'}
    }
  }

  async function savePersonal(entry: PersonalTransaction): Promise<SaveFormResult> {
    setSavingMessage('')
    try {
      const result = personalTransactions.some((item) => item.id === entry.id)
        ? await updatePersonalTransaction(entry.id, entry)
        : await addPersonalTransaction(entry)
      if (result.error) { setSavingMessage(result.error); return {ok: false, error: result.error} }
      setSavingMessage('Personal entry saved')
      return {ok: true}
    } catch {
      setSavingMessage('Could not save personal entry')
      return {ok: false, error: 'Could not save personal entry'}
    }
  }

  async function removePersonal(entry: PersonalTransaction) {
    if (!window.confirm(`Delete “${entry.description}”?`)) return
    setSavingMessage('Deleting…')
    try {
      const result = await deletePersonalTransaction(entry.id)
      setSavingMessage(result.error ?? 'Personal entry deleted')
    } catch {
      setSavingMessage('Could not delete personal entry')
    }
  }

  async function changeInvoice(invoice: Invoice) {
    const received = !(invoice.status === 'received' || invoice.status === 'paid')
    const prompt = received ? `Mark ${invoice.party} as received? This creates a money-in transaction.` : `Reverse the received payment from ${invoice.party}? The linked transaction will be removed.`
    if (!window.confirm(prompt)) return
    setSavingMessage('Saving…'); setBusyId(invoice.id)
    try {
      const result = await setInvoiceReceived(invoice.id, received)
      setSavingMessage(result.error ?? (received ? 'Invoice received' : 'Payment reversed'))
    } catch {
      setSavingMessage('Could not update invoice')
    } finally { setBusyId(null) }
  }

  async function sendInvoice(invoice: Invoice) {
    if (invoice.status !== 'draft' || !window.confirm(`Mark ${invoice.party} as sent?`)) return
    setSavingMessage('Saving…'); setBusyId(invoice.id)
    try {
      const result = await setInvoiceSent(invoice.id)
      setSavingMessage(result.error ?? 'Invoice marked sent')
    } catch {
      setSavingMessage('Could not mark invoice sent')
    } finally { setBusyId(null) }
  }

  async function changeReimbursement(reimbursement: Reimbursement) {
    const settled = !reimbursement.settled
    const prompt = settled ? `Settle “${reimbursement.description}”? This creates a money-out transaction.` : `Reverse settlement for “${reimbursement.description}”? The linked transaction will be removed.`
    if (!window.confirm(prompt)) return
    setSavingMessage('Saving…'); setBusyId(reimbursement.id)
    try {
      const result = await settleReimbursement(reimbursement.id, settled)
      setSavingMessage(result.error ?? (settled ? 'Reimbursement settled' : 'Settlement reversed'))
    } catch {
      setSavingMessage('Could not update reimbursement')
    } finally { setBusyId(null) }
  }

  return <div className="finance-page">
    <section className="finance-intro">
      <div><p className="eyebrow light">Money, with the story intact</p><h2>Cash position</h2><p>Running balance is anchored in Settings, then updated by every real transaction.</p></div>
      <button type="button" className="button dark" onClick={() => setShowSettings((open) => !open)}>{showSettings ? 'Close settings' : 'Finance settings'}</button>
    </section>

    {showSettings&&<SettingsForm settings={settings} onSave={updateSettings} onMessage={setSavingMessage}/>}

    <section className="finance-metrics">
      <MetricCard label="Cash available" value={money(snapshot.balance)} tint="sky"/>
      <MetricCard label="Revenue this month" value={money(snapshot.collected)} tint="mint"/>
      <MetricCard label="Receivables outstanding" value={money(snapshot.receivables)} tint="lilac"/>
      <MetricCard label="Expenses so far this month" value={money(transactions.filter((transaction) => transaction.direction === 'out' && monthKey(transaction.date) === monthKey(today)).reduce((sum, transaction) => sum + (toINR(transaction.amount, transaction.currency, settings.fxRates) ?? 0), 0))} tint="coral"/>
      <MetricCard label="Unsettled reimbursements" value={money(snapshot.committed)} tint="butter"/>
    </section>
    <section className={`runway-strip ${snapshot.runway !== null && snapshot.runway < 8 ? 'is-risk' : ''}`}><div><p className="eyebrow">Estimated runway</p><h2>{snapshot.runway === null ? '—' : `${Math.round(snapshot.runway)} weeks`}</h2></div><p>Based on the latest closed-month spend average.</p></section>
    {missingFx&&<p className="finance-note">Some non-INR rows have no manual FX rate yet; their INR equivalent is excluded until a rate is set.</p>}

    <section className="finance-grid">
      <article className="finance-panel ledger-panel">
        <div className="section-head"><div><p className="eyebrow">Ledger</p><h2>Money in and out</h2></div><button type="button" className="button dark" onClick={() => setShowTransactionModal(true)}>+ Transaction</button></div>
        <div className="finance-filters"><SelectMenu value={direction} options={[{value:'all',label:'All directions'},{value:'in',label:'Money in'},{value:'out',label:'Money out'}]} ariaLabel="Transaction direction" onChange={setDirection}/><SelectMenu value={category} options={[{value:'all',label:'All categories'}, ...categories.map((item) => ({value:item,label:item}))]} ariaLabel="Transaction category" onChange={setCategory}/><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="From date"/><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="To date"/></div>
        <div className="ledger-head"><span>Date</span><span>Entry</span><span>Category</span><span>Amount</span></div>
        {filteredTransactions.length === 0&&<p className="finance-empty">No transactions match these filters.</p>}
        {visibleTransactions.map((transaction) => <div className="finance-ledger-row" key={transaction.id}><span>{transaction.date}</span><div><b>{transaction.description}</b>{transaction.party&&<small>{transaction.party}</small>}</div><span>{transaction.category}</span><strong className={transaction.direction}>{transaction.direction === 'in' ? '+' : '−'} {originalWithINR(transaction.amount,transaction.currency,settings.fxRates)}</strong>{!transaction.invoiceId && !transaction.reimbursementId && <button type="button" className="ledger-edit-button" aria-label={`Edit ${transaction.description}`} onClick={() => setEditingTransaction(transaction)}>Edit</button>}</div>)}
        {filteredTransactions.length > 5 && <button type="button" className="view-all-button" onClick={() => setShowAllTransactions((value) => !value)}>{showAllTransactions ? 'Show latest five' : `View all transactions (${filteredTransactions.length})`}</button>}
      </article>
    </section>

    <article className="finance-panel chart-panel"><p className="eyebrow">Last three months</p><h2>In vs out</h2><p className="chart-note">Monthly totals in INR; original currencies remain in the ledger.</p><div className="legend"><span className="legend-in">Money in</span><span className="legend-out">Money out</span></div><div className="month-chart">{monthly.map((month) => <div className="month-column" key={month.key}><div className="month-bars"><i className="bar-in" style={{height:`${Math.max(4,month.inTotal/maxMonthly*100)}%`}} title={`${money(month.inTotal)} in`}/><i className="bar-out" style={{height:`${Math.max(4,month.outTotal/maxMonthly*100)}%`}} title={`${money(month.outTotal)} out`}/></div><small>{month.label}</small><em>₹{Math.round(month.inTotal).toLocaleString('en-IN')} in · ₹{Math.round(month.outTotal).toLocaleString('en-IN')} out</em></div>)}</div></article>

    <section className="finance-grid lower">
      <article className="finance-panel"><div className="section-head"><div><p className="eyebrow">Invoices</p><h2>Sent is not collected</h2></div><div className="section-actions"><span className="count-pill">{overdueInvoices.length} overdue</span><button type="button" className="button quiet" onClick={() => setShowInvoiceModal(true)}>+ Invoice</button></div></div>{invoices.length === 0&&<p className="finance-empty">No invoices yet.</p>}{invoices.map((invoice) => {const overdue = daysOverdue(invoice); const received = invoice.status === 'received' || invoice.status === 'paid'; const draft = invoice.status === 'draft'; return <div className={`invoice-row ${overdue ? 'is-overdue' : ''}`} key={invoice.id}><div><b>{invoice.party}</b><small>{invoice.description}</small></div><div><strong>{formatOriginal(invoice.amount,invoice.currency)}</strong><small>{toINR(invoice.amount,invoice.currency,settings.fxRates) === null ? 'INR rate not set' : money(toINR(invoice.amount,invoice.currency,settings.fxRates) ?? 0)} · due {invoice.dueDate}</small></div><span className="status-pill">{overdue ? `${overdue} days overdue` : received ? 'Received' : invoice.status}</span><button type="button" className="text-button" disabled={busyId===invoice.id} onClick={() => void (draft ? sendInvoice(invoice) : changeInvoice(invoice))}>{busyId===invoice.id ? 'Saving…' : draft ? 'Mark sent' : received ? 'Reverse received' : 'Mark received'}</button></div>})}</article>
      <article className="finance-panel"><div className="section-head"><div><p className="eyebrow">Reimbursements</p><h2>Pending outflows</h2></div><div className="section-actions"><span className="count-pill">{reimbursements.filter((item) => !item.settled).length} pending</span><button type="button" className="button quiet" onClick={() => setShowReimbursementModal(true)}>+ Reimbursement</button></div></div>{reimbursements.length === 0&&<p className="finance-empty">No reimbursements yet.</p>}{reimbursements.map((reimbursement) => <div className="invoice-row" key={reimbursement.id}><div><b>{reimbursement.description}</b><small>{reimbursement.requestedBy === 'nihal' ? 'Nihal' : 'Shirin'} · requested {reimbursement.requestedDate}</small></div><div><strong>{formatOriginal(reimbursement.amount,reimbursement.currency)}</strong><small>{toINR(reimbursement.amount,reimbursement.currency,settings.fxRates) === null ? 'INR rate not set' : money(toINR(reimbursement.amount,reimbursement.currency,settings.fxRates) ?? 0)}</small></div><span className={`status-pill ${reimbursement.settled ? '' : 'pending'}`}>{reimbursement.settled ? 'Settled' : 'Pending'}</span><button type="button" className="text-button" disabled={busyId===reimbursement.id} onClick={() => void changeReimbursement(reimbursement)}>{busyId===reimbursement.id ? 'Saving…' : reimbursement.settled ? 'Undo reimbursement settled' : 'Mark reimbursement settled'}</button></div>)}</article>
    </section>

    <section className="finance-grid charts"><article className="finance-panel"><div className="category-panel-head"><div><p className="eyebrow">Spend by category</p><h2>Outflows</h2></div><div className="category-month-nav"><button type="button" aria-label="Previous month" onClick={() => shiftCategoryMonth(-1)}>‹</button><strong>{categoryMonthLabel}</strong><button type="button" aria-label="Next month" onClick={() => shiftCategoryMonth(1)}>›</button></div></div>{categorySpend.length === 0&&<p className="finance-empty">No outflows recorded for this month.</p>}{categorySpend.map(([name,value]) => <div className="category-bar" key={name}><div><span>{name}</span><b>{money(value)}</b></div><i style={{width:`${Math.max(4,value/maxCategory*100)}%`}}/></div>)}</article><article className="finance-panel"><div className="category-panel-head"><div><p className="eyebrow">Revenue by category</p><h2>Inflows</h2></div><div className="category-month-nav"><button type="button" aria-label="Previous month" onClick={() => shiftCategoryMonth(-1)}>‹</button><strong>{categoryMonthLabel}</strong><button type="button" aria-label="Next month" onClick={() => shiftCategoryMonth(1)}>›</button></div></div>{categoryRevenue.length === 0&&<p className="finance-empty">No money received for this month.</p>}{categoryRevenue.map(([name,value]) => <div className="category-bar revenue" key={name}><div><span>{name}</span><b>{money(value)}</b></div><i style={{width:`${Math.max(4,value/maxRevenue*100)}%`}}/></div>)}</article></section>

    <section className="personal-money-panel">
      <div className="personal-money-head">
        <div><p className="eyebrow">Personal money</p><h2>Keep personal spending separate.</h2><p>Private-to-the-person ledger. It never changes Camp’s business cash position.</p></div>
        <button type="button" className="button dark" onClick={() => {setEditingPersonal(null);setShowPersonalModal(true)}}>+ Personal entry</button>
      </div>
      <div className="personal-money-toolbar"><div className="personal-person-switch" role="tablist" aria-label="Personal money owner"><button type="button" className={personalPerson === 'nihal' ? 'active' : ''} onClick={() => setPersonalPerson('nihal')}>Nihal</button><button type="button" className={personalPerson === 'shirin' ? 'active' : ''} onClick={() => setPersonalPerson('shirin')}>Shirin</button></div><div className="personal-summary"><span><small>In this month</small><b>{money(personalIn)}</b></span><span><small>Out this month</small><b>{money(personalOut)}</b></span></div></div>
      {personalRows.length === 0 ? <p className="personal-empty">No personal entries for {personalPerson === 'nihal' ? 'Nihal' : 'Shirin'} yet.</p> : <div className="personal-ledger">{personalRows.map((entry) => <div className="personal-ledger-row" key={entry.id}><span>{entry.date}</span><div><b>{entry.description}</b><small>{entry.category}</small></div><strong className={entry.direction}>{entry.direction === 'in' ? '+' : '−'} {originalWithINR(entry.amount, entry.currency, settings.fxRates)}</strong><button type="button" className="ledger-edit-button" onClick={() => setEditingPersonal(entry)}>Edit</button><button type="button" className="ledger-delete-button" onClick={() => void removePersonal(entry)}>Delete</button></div>)}</div>}
    </section>

    {savingMessage&&<p className="finance-toast" role="status">{savingMessage}</p>}
    {showTransactionModal&&<TransactionModal close={() => setShowTransactionModal(false)} save={saveNewTransaction} currentPerson={currentPerson}/>}
    {editingTransaction&&<TransactionModal close={() => setEditingTransaction(null)} save={saveEditedTransaction} currentPerson={currentPerson} initial={editingTransaction}/>}
    {showInvoiceModal&&<InvoiceModal close={() => setShowInvoiceModal(false)} save={saveNewInvoice}/>}
    {showReimbursementModal&&<ReimbursementModal close={() => setShowReimbursementModal(false)} save={saveNewReimbursement} currentPerson={currentPerson}/>}
    {showPersonalModal&&<PersonalTransactionModal close={() => setShowPersonalModal(false)} save={savePersonal} currentPerson={personalPerson}/>}
    {editingPersonal&&<PersonalTransactionModal close={() => setEditingPersonal(null)} save={savePersonal} currentPerson={personalPerson} initial={editingPersonal}/>}
  </div>
}

function SettingsForm({settings,onSave,onMessage}:{settings:Settings;onSave:(settings:Settings)=>Promise<{error:string|null}>;onMessage:(message:string)=>void}) {
  const [balance,setBalance] = useState(String(settings.currentBalance ?? settings.openingBalance))
  const [asOf,setAsOf] = useState(settings.currentBalanceAsOf ?? todayISO())
  const [aed,setAed] = useState(String(settings.fxRates.AED))
  const [usd,setUsd] = useState(String(settings.fxRates.USD))
  const [busy,setBusy] = useState(false)
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); onMessage('')
    const nextBalance = Number(balance)
    const nextAed = Number(aed)
    const nextUsd = Number(usd)
    if (!asOf || !Number.isFinite(nextBalance) || nextBalance < 0 || !Number.isFinite(nextAed) || nextAed < 0 || !Number.isFinite(nextUsd) || nextUsd < 0) {
      onMessage('Enter valid settings values.')
      return
    }
    setBusy(true)
    try {
      const result = await onSave({...settings,currentBalance:nextBalance,currentBalanceAsOf:asOf,fxRates:{AED:nextAed,USD:nextUsd}})
      onMessage(result.error ?? 'Finance settings saved')
    } catch {
      onMessage('Could not save settings')
    } finally {
      setBusy(false)
    }
  }
  return <form className="settings-form" noValidate onSubmit={(event) => void submit(event)}><div><p className="eyebrow">Settings</p><h2>Anchor the cash view</h2></div><label>Current balance<input type="number" min="0" step="1" value={balance} onChange={(event) => setBalance(event.target.value)}/></label><label>Balance as of<input type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)}/></label><label>1 AED in INR<input type="number" min="0" step="0.01" value={aed} onChange={(event) => setAed(event.target.value)}/></label><label>1 USD in INR<input type="number" min="0" step="0.01" value={usd} onChange={(event) => setUsd(event.target.value)}/></label><button type="submit" className="button dark" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></form>
}

function TransactionModal({close,save,currentPerson,initial}:{close:()=>void;save:(transaction:Transaction)=>Promise<SaveFormResult>;currentPerson:Person;initial?:Transaction}) {
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [direction,setDirection] = useState<Transaction['direction']>(initial?.direction ?? 'out')
  const [currency,setCurrency] = useState<Transaction['currency']>(initial?.currency ?? 'INR')
  const [category,setCategory] = useState(initial?.category ?? 'Services')
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    const date = String(form.get('date') ?? '')
    const amount = Number(form.get('amount'))
    const category = String(form.get('category') ?? '').trim()
    const description = String(form.get('description') ?? '').trim()
    if (!date || !Number.isFinite(amount) || amount <= 0 || !category || !description) { setError('Complete the date, amount, category, and description.'); return }
    setBusy(true)
    try {
      const result = await save({id:initial?.id ?? crypto.randomUUID(),date,direction:String(form.get('direction')) as Transaction['direction'],amount,currency:String(form.get('currency')) as Transaction['currency'],category,description,party:String(form.get('party') ?? '').trim() || undefined,createdBy:initial?.createdBy ?? currentPerson})
      if (result.ok) close()
      else setError(result.error ?? 'Could not save transaction')
    } finally {
      setBusy(false)
    }
  }
  return <div className="modal-bg"><section className="modal finance-modal"><button className="modal-close" onClick={close} type="button" disabled={busy}>×</button><p className="eyebrow">Camp finance</p><h2>{initial ? 'Edit transaction' : 'Log money'}</h2>{error&&<p className="login-error" role="alert">{error}</p>}<form className="modal-form" noValidate onSubmit={(event) => void submit(event)}><label>Date<input name="date" type="date" defaultValue={initial?.date ?? todayISO()}/></label><label>Direction<SelectMenu value={direction} options={[{value:'out',label:'Money out'},{value:'in',label:'Money in'}]} ariaLabel="Transaction direction" name="direction" onChange={setDirection}/></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" defaultValue={initial?.amount ?? ''} placeholder="Amount"/></label><label>Currency<SelectMenu value={currency} options={[{value:'INR',label:'INR'},{value:'AED',label:'AED'},{value:'USD',label:'USD'}]} ariaLabel="Transaction currency" name="currency" onChange={setCurrency}/></label><label>Category<SelectMenu value={category} options={['Services','Content','Website','Training','Salary','Tools','Travel','Legal','Other'].map((item) => ({value:item,label:item}))} ariaLabel="Transaction category" name="category" onChange={setCategory}/></label><label>Description<input name="description" defaultValue={initial?.description ?? ''} placeholder="What moved?"/></label><label>Party <span className="optional">optional</span><input name="party" defaultValue={initial?.party ?? ''} placeholder="Client or supplier"/></label><button type="submit" className="button dark" disabled={busy}>{busy ? 'Saving…' : initial ? 'Update transaction' : 'Save transaction'}</button></form></section></div>
}

function InvoiceModal({close,save}:{close:()=>void;save:(invoice:Invoice)=>Promise<SaveFormResult>}) {
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [currency,setCurrency] = useState<Invoice['currency']>('INR')
  const [status,setStatus] = useState<'draft'|'sent'>('sent')
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const form = new FormData(event.currentTarget)
    const party = String(form.get('party') ?? '').trim()
    const description = String(form.get('description') ?? '').trim()
    const amount = Number(form.get('amount'))
    const issuedDate = String(form.get('issuedDate') ?? '')
    const dueDate = String(form.get('dueDate') ?? '')
    if (!party || !description || !Number.isFinite(amount) || amount <= 0 || !issuedDate || !dueDate || dueDate < issuedDate) { setError('Complete the invoice details with a valid date range.'); return }
    setBusy(true)
    try {
      const result = await save({id:crypto.randomUUID(),party,description,amount,currency:String(form.get('currency')) as Invoice['currency'],issuedDate,dueDate,status:String(form.get('status')) as Invoice['status'],notes:String(form.get('notes') ?? '').trim() || undefined})
      if (result.ok) close()
      else setError(result.error ?? 'Could not save invoice')
    } catch { setError('Could not save invoice') } finally { setBusy(false) }
  }
  return <div className="modal-bg"><section className="modal finance-modal"><button className="modal-close" onClick={close} type="button" disabled={busy}>×</button><p className="eyebrow">Camp finance</p><h2>Add an invoice</h2>{error&&<p className="login-error" role="alert">{error}</p>}<form className="modal-form" noValidate onSubmit={(event) => void submit(event)}><label>Party<input name="party" autoFocus placeholder="Client or customer"/></label><label>Description<input name="description" placeholder="What is this for?"/></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" placeholder="Amount"/></label><label>Currency<SelectMenu value={currency} options={[{value:'INR',label:'INR'},{value:'AED',label:'AED'},{value:'USD',label:'USD'}]} ariaLabel="Invoice currency" name="currency" onChange={setCurrency}/></label><label>Status<SelectMenu value={status} options={[{value:'sent',label:'Sent'},{value:'draft',label:'Draft'}]} ariaLabel="Invoice status" name="status" onChange={setStatus}/></label><label>Issued date<input name="issuedDate" type="date" defaultValue={todayISO()}/></label><label>Due date<input name="dueDate" type="date" defaultValue={dateAfter(14)}/></label><label>Notes <span className="optional">optional</span><textarea name="notes" rows={3} placeholder="Payment context"/></label><button type="submit" className="button dark" disabled={busy}>{busy ? 'Saving…' : 'Save invoice'}</button></form></section></div>
}

function ReimbursementModal({close,save,currentPerson}:{close:()=>void;save:(reimbursement:Reimbursement)=>Promise<SaveFormResult>;currentPerson:Person}) {
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [currency,setCurrency] = useState<Reimbursement['currency']>('INR')
  const [requestedBy,setRequestedBy] = useState<Person>(currentPerson)
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const form = new FormData(event.currentTarget)
    const description = String(form.get('description') ?? '').trim()
    const amount = Number(form.get('amount'))
    const requestedDate = String(form.get('requestedDate') ?? '')
    if (!description || !Number.isFinite(amount) || amount <= 0 || !requestedDate) { setError('Complete the reimbursement details.'); return }
    setBusy(true)
    try {
      const result = await save({id:crypto.randomUUID(),description,amount,currency:String(form.get('currency')) as Reimbursement['currency'],requestedBy:String(form.get('requestedBy')) as Person,requestedDate,settled:false,notes:String(form.get('notes') ?? '').trim() || undefined})
      if (result.ok) close()
      else setError(result.error ?? 'Could not save reimbursement')
    } catch { setError('Could not save reimbursement') } finally { setBusy(false) }
  }
  return <div className="modal-bg"><section className="modal finance-modal"><button className="modal-close" onClick={close} type="button" disabled={busy}>×</button><p className="eyebrow">Camp finance</p><h2>Add a reimbursement</h2>{error&&<p className="login-error" role="alert">{error}</p>}<form className="modal-form" noValidate onSubmit={(event) => void submit(event)}><label>Description<input name="description" autoFocus placeholder="What should be reimbursed?"/></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" placeholder="Amount"/></label><label>Currency<SelectMenu value={currency} options={[{value:'INR',label:'INR'},{value:'AED',label:'AED'},{value:'USD',label:'USD'}]} ariaLabel="Reimbursement currency" name="currency" onChange={setCurrency}/></label><label>Requested by<SelectMenu value={requestedBy} options={[{value:'nihal',label:'Nihal'},{value:'shirin',label:'Shirin'}]} ariaLabel="Requested by" name="requestedBy" onChange={setRequestedBy}/></label><label>Requested date<input name="requestedDate" type="date" defaultValue={todayISO()}/></label><label>Notes <span className="optional">optional</span><textarea name="notes" rows={3} placeholder="A little context"/></label><button type="submit" className="button dark" disabled={busy}>{busy ? 'Saving…' : 'Save reimbursement'}</button></form></section></div>
}

function PersonalTransactionModal({close, save, currentPerson, initial}: {close: () => void; save: (entry: PersonalTransaction) => Promise<SaveFormResult>; currentPerson: Person; initial?: PersonalTransaction}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [person, setPerson] = useState<Person>(initial?.person ?? currentPerson)
  const [direction, setDirection] = useState<PersonalTransaction['direction']>(initial?.direction ?? 'out')
  const [currency, setCurrency] = useState<PersonalTransaction['currency']>(initial?.currency ?? 'INR')
  const [category, setCategory] = useState<PersonalFinanceCategory>(initial?.category ?? 'Food (Lunch)')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const form = new FormData(event.currentTarget)
    const date = String(form.get('date') ?? '')
    const amount = Number(form.get('amount'))
    const description = String(form.get('description') ?? '').trim()
    if (!date || !Number.isFinite(amount) || amount <= 0 || !description) { setError('Complete the date, amount, and description.'); return }
    setBusy(true)
    try {
      const result = await save({id: initial?.id ?? crypto.randomUUID(), person: String(form.get('person')) as Person, date, direction: String(form.get('direction')) as PersonalTransaction['direction'], amount, currency: String(form.get('currency')) as PersonalTransaction['currency'], category: String(form.get('category')) as PersonalFinanceCategory, description, createdBy: initial?.createdBy ?? currentPerson})
      if (result.ok) close()
      else setError(result.error ?? 'Could not save personal entry')
    } catch {
      setError('Could not save personal entry')
    } finally { setBusy(false) }
  }

  return <div className="modal-bg"><section className="modal finance-modal"><button className="modal-close" onClick={close} type="button" disabled={busy}>×</button><p className="eyebrow">Personal money</p><h2>{initial ? 'Edit personal entry' : 'Add personal entry'}</h2>{error && <p className="login-error" role="alert">{error}</p>}<form className="modal-form" noValidate onSubmit={(event) => void submit(event)}><label>Person<SelectMenu value={person} options={[{value:'nihal',label:'Nihal'},{value:'shirin',label:'Shirin'}]} ariaLabel="Personal money person" name="person" onChange={setPerson}/></label><label>Date<input name="date" type="date" defaultValue={initial?.date ?? todayISO()}/></label><label>Direction<SelectMenu value={direction} options={[{value:'out',label:'Money out'},{value:'in',label:'Money in'}]} ariaLabel="Personal money direction" name="direction" onChange={setDirection}/></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" defaultValue={initial?.amount ?? ''} placeholder="Amount"/></label><label>Currency<SelectMenu value={currency} options={[{value:'INR',label:'INR'},{value:'AED',label:'AED'},{value:'USD',label:'USD'}]} ariaLabel="Personal money currency" name="currency" onChange={setCurrency}/></label><label>Category<SelectMenu value={category} options={personalCategories.map((item) => ({value:item,label:item}))} ariaLabel="Personal money category" name="category" onChange={setCategory}/></label><label>Description<input name="description" defaultValue={initial?.description ?? ''} placeholder="What was this for?"/></label><button type="submit" className="button dark" disabled={busy}>{busy ? 'Saving…' : initial ? 'Update entry' : 'Save entry'}</button></form></section></div>
}
