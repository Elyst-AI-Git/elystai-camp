import type {Invoice, Reimbursement, Settings, Transaction} from '../types'
import {createAnonClient} from '../supabase/browser'

type DbTransaction = {
  id: string
  date: string
  direction: Transaction['direction']
  amount: number | string
  currency: Transaction['currency']
  category: string
  description: string
  party?: string | null
  invoice_id?: string | null
  reimbursement_id?: string | null
  created_by?: Transaction['createdBy'] | null
}

type DbInvoice = {
  id: string
  party: string
  description: string
  amount: number | string
  currency: Invoice['currency']
  issued_date: string
  due_date: string
  status: Invoice['status']
  received_date?: string | null
  notes?: string | null
}

type DbReimbursement = {
  id: string
  description: string
  amount: number | string
  currency: Reimbursement['currency']
  requested_by: Reimbursement['requestedBy']
  requested_date: string
  settled: boolean
  settled_date?: string | null
  notes?: string | null
}

const errorMessage = (error: unknown, fallback: string): Error | null => error ? new Error(fallback) : null

function mapTransaction(row: DbTransaction): Transaction {
  return {id:row.id,date:row.date,direction:row.direction,amount:Number(row.amount),currency:row.currency,category:row.category,description:row.description,party:row.party ?? undefined,invoiceId:row.invoice_id ?? undefined,reimbursementId:row.reimbursement_id ?? undefined,createdBy:row.created_by ?? undefined}
}

function mapInvoice(row: DbInvoice): Invoice {
  return {id:row.id,party:row.party,description:row.description,amount:Number(row.amount),currency:row.currency,issuedDate:row.issued_date,dueDate:row.due_date,status:row.status,receivedDate:row.received_date ?? undefined,notes:row.notes ?? undefined}
}

function mapReimbursement(row: DbReimbursement): Reimbursement {
  return {id:row.id,description:row.description,amount:Number(row.amount),currency:row.currency,requestedBy:row.requested_by,requestedDate:row.requested_date,settled:row.settled,settledDate:row.settled_date ?? undefined,notes:row.notes ?? undefined}
}

export async function fetchTransactions(): Promise<{data:Transaction[] | null; error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {data:null,error:null}
  const {data,error} = await supabase.from('transactions').select('*').order('date',{ascending:false})
  if (error) return {data:null,error:new Error('Could not load transactions')}
  return {data:(data as unknown as DbTransaction[]).map(mapTransaction),error:null}
}

export async function fetchInvoices(): Promise<{data:Invoice[] | null; error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {data:null,error:null}
  const {data,error} = await supabase.from('invoices').select('*').order('due_date')
  if (error) return {data:null,error:new Error('Could not load invoices')}
  return {data:(data as unknown as DbInvoice[]).map(mapInvoice),error:null}
}

export async function fetchReimbursements(): Promise<{data:Reimbursement[] | null; error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {data:null,error:null}
  const {data,error} = await supabase.from('reimbursements').select('*').order('requested_date',{ascending:false})
  if (error) return {data:null,error:new Error('Could not load reimbursements')}
  return {data:(data as unknown as DbReimbursement[]).map(mapReimbursement),error:null}
}

export async function fetchSettings(): Promise<{data:Settings | null; error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {data:null,error:null}
  const {data,error} = await supabase.from('settings').select('*').eq('id',1).maybeSingle()
  if (error) return {data:null,error:new Error('Could not load settings')}
  if (!data) return {data:null,error:null}
  const row = data as unknown as {current_balance?: number | string | null; current_balance_as_of?: string | null; monthly_burn_override?: number | string | null; fx_aed?: number | string | null; fx_usd?: number | string | null}
  const balance = row.current_balance === null || row.current_balance === undefined ? 0 : Number(row.current_balance)
  return {data:{openingBalance:balance,currentBalance:balance,currentBalanceAsOf:row.current_balance_as_of ?? undefined,monthlyBurnOverride:row.monthly_burn_override === null || row.monthly_burn_override === undefined ? undefined : Number(row.monthly_burn_override),fxRates:{AED:row.fx_aed === null || row.fx_aed === undefined ? 0 : Number(row.fx_aed),USD:row.fx_usd === null || row.fx_usd === undefined ? 0 : Number(row.fx_usd)},mustCap:5},error:null}
}

export async function saveTransaction(transaction: Transaction): Promise<{error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error:null}
  const {error} = await supabase.from('transactions').upsert({id:transaction.id,date:transaction.date,direction:transaction.direction,amount:transaction.amount,currency:transaction.currency,category:transaction.category,description:transaction.description,party:transaction.party ?? null,invoice_id:transaction.invoiceId ?? null,reimbursement_id:transaction.reimbursementId ?? null,created_by:transaction.createdBy ?? 'nihal'})
  return {error:errorMessage(error,'Could not save transaction')}
}

export async function removeLinkedTransaction(field: 'invoice_id' | 'reimbursement_id', id: string): Promise<{error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error:null}
  const {error} = await supabase.from('transactions').delete().eq(field,id)
  return {error:errorMessage(error,'Could not remove linked transaction')}
}

export async function saveInvoice(invoice: Invoice): Promise<{error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error:null}
  const status = invoice.status === 'paid' ? 'received' : invoice.status === 'overdue' ? 'sent' : invoice.status
  const {error} = await supabase.from('invoices').upsert({id:invoice.id,party:invoice.party,description:invoice.description,amount:invoice.amount,currency:invoice.currency,issued_date:invoice.issuedDate,due_date:invoice.dueDate,status,received_date:invoice.receivedDate ?? invoice.paidDate ?? null,notes:invoice.notes ?? null})
  return {error:errorMessage(error,'Could not save invoice')}
}

export async function saveReimbursement(reimbursement: Reimbursement): Promise<{error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error:null}
  const {error} = await supabase.from('reimbursements').upsert({id:reimbursement.id,description:reimbursement.description,amount:reimbursement.amount,currency:reimbursement.currency,requested_by:reimbursement.requestedBy,requested_date:reimbursement.requestedDate,settled:reimbursement.settled,settled_date:reimbursement.settledDate ?? null,notes:reimbursement.notes ?? null})
  return {error:errorMessage(error,'Could not save reimbursement')}
}

export async function saveSettings(settings: Settings): Promise<{error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error:null}
  const {error} = await supabase.from('settings').upsert({id:1,current_balance:settings.currentBalance ?? settings.openingBalance,current_balance_as_of:settings.currentBalanceAsOf ?? null,monthly_burn_override:settings.monthlyBurnOverride ?? null,fx_aed:settings.fxRates.AED,fx_usd:settings.fxRates.USD})
  return {error:errorMessage(error,'Could not save settings')}
}
