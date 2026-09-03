import type {Invoice, Reimbursement, Settings, Transaction} from './types'

export type FinanceRates = Settings['fxRates']

export function todayISO(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function toINR(amount: number, currency: Transaction['currency'], rates: FinanceRates): number | null {
  if (currency === 'INR') return amount
  const rate = rates[currency]
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? amount * rate : null
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 0}).format(amount)
}

export function formatOriginal(amount: number, currency: Transaction['currency']): string {
  return new Intl.NumberFormat('en-IN', {style: 'currency', currency, maximumFractionDigits: 0}).format(amount)
}

export function runningBalance(transactions: Transaction[], settings: Settings): number {
  const anchor = settings.currentBalance ?? settings.openingBalance
  const asOf = settings.currentBalanceAsOf ?? '0000-01-01'
  return transactions.reduce((balance, transaction) => {
    if (transaction.date < asOf) return balance
    const value = toINR(transaction.amount, transaction.currency, settings.fxRates)
    if (value === null) return balance
    return balance + (transaction.direction === 'in' ? value : -value)
  }, anchor)
}

export function monthKey(date: string): string {
  return date.slice(0, 7)
}

export function isMonthClosed(month: string, now = new Date()): boolean {
  const current = monthKey(todayISO(now))
  if (month < current) return true
  if (month > current) return false
  return now.getDate() >= 6
}

export function closedMonthlyOuts(transactions: Transaction[], settings: Settings, now = new Date()): number[] {
  const current = new Date(now.getFullYear(), now.getMonth(), 1)
  const totals: number[] = []
  for (let index = 0; index < 6; index += 1) {
    const month = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
    if (isMonthClosed(month, now)) {
      const rows = transactions.filter((transaction) => transaction.direction === 'out' && monthKey(transaction.date) === month)
      const total = rows.reduce<number | null>((sum, transaction) => {
        const value = toINR(transaction.amount, transaction.currency, settings.fxRates)
        if (value === null) return sum
        return (sum ?? 0) + value
      }, 0)
      if (total !== null) totals.push(total)
    }
    current.setMonth(current.getMonth() - 1)
  }
  return totals.reverse()
}

export function runwayWeeks(transactions: Transaction[], settings: Settings, now = new Date()): number | null {
  // Keep closed zero-spend months in the sample. Filtering them would make a
  // genuinely quiet month disappear and overstate the burn average.
  const monthlyOuts = closedMonthlyOuts(transactions, settings, now)
  if (!monthlyOuts.length) return null
  const sample = monthlyOuts.slice(-3)
  const averageMonthlyOut = sample.reduce((sum, value) => sum + value, 0) / sample.length
  if (!averageMonthlyOut) return null
  return runningBalance(transactions, settings) / (averageMonthlyOut / 4.33)
}

export function collectedThisMonth(transactions: Transaction[], settings: Settings, now = new Date()): number {
  const month = monthKey(todayISO(now))
  return transactions.reduce((sum, transaction) => {
    if (transaction.direction !== 'in' || monthKey(transaction.date) !== month) return sum
    return sum + (toINR(transaction.amount, transaction.currency, settings.fxRates) ?? 0)
  }, 0)
}

export function receivablesOutstanding(invoices: Invoice[], settings: Settings): number {
  return invoices.reduce((sum, invoice) => {
    // A draft is not yet a receivable, and an overdue label is derived at
    // render time rather than stored as a separate money state.
    if (invoice.status !== 'sent') return sum
    return sum + (toINR(invoice.amount, invoice.currency, settings.fxRates) ?? 0)
  }, 0)
}

export function committedOutflows(reimbursements: Reimbursement[], settings: Settings): number {
  return reimbursements.reduce((sum, reimbursement) => {
    if (reimbursement.settled) return sum
    return sum + (toINR(reimbursement.amount, reimbursement.currency, settings.fxRates) ?? 0)
  }, 0)
}

export function daysOverdue(invoice: Invoice, now = new Date()): number {
  // Only sent invoices can be overdue. Drafts are still internal work and
  // must not interrupt the Today insight or receivables totals.
  if (invoice.status !== 'sent') return 0
  const due = new Date(`${invoice.dueDate}T12:00:00`)
  const today = new Date(`${todayISO(now)}T12:00:00`)
  return due < today ? Math.floor((today.getTime() - due.getTime()) / 86400000) : 0
}

export function originalWithINR(amount: number, currency: Transaction['currency'], rates: FinanceRates): string {
  const original = formatOriginal(amount, currency)
  if (currency === 'INR') return `${original} (INR)`
  const converted = toINR(amount, currency, rates)
  return converted === null ? `${original} · INR rate not set` : `${original} · ${formatINR(converted)}`
}
