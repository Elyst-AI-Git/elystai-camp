import type {PersonalTransaction} from '../types'
import {createAnonClient} from '../supabase/browser'

type DbPersonalTransaction = {
  id: string
  person: PersonalTransaction['person']
  date: string
  direction: PersonalTransaction['direction']
  amount: number | string
  currency: PersonalTransaction['currency']
  category: string
  description: string
  created_by?: PersonalTransaction['createdBy'] | null
}

function mapEntry(row: DbPersonalTransaction): PersonalTransaction {
  return {id: row.id, person: row.person, date: row.date, direction: row.direction, amount: Number(row.amount), currency: row.currency, category: row.category as PersonalTransaction['category'], description: row.description, createdBy: row.created_by ?? undefined}
}

function isMissingTable(error: unknown): boolean {
  const candidate = error as {code?: string; message?: string}
  return candidate?.code === 'PGRST205' || candidate?.code === '42P01' || candidate?.message?.toLowerCase().includes('does not exist') === true
}

export async function fetchPersonalTransactions(): Promise<{data: PersonalTransaction[] | null; error: Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {data: null, error: null}
  const {data, error} = await supabase.from('personal_transactions').select('*').order('date', {ascending: false})
  if (error) return isMissingTable(error) ? {data: [], error: null} : {data: null, error: new Error('Could not load personal money')}
  return {data: (data as unknown as DbPersonalTransaction[]).map(mapEntry), error: null}
}

export async function savePersonalTransaction(entry: PersonalTransaction): Promise<{error: Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error: null}
  const {error} = await supabase.from('personal_transactions').upsert({
    id: entry.id,
    person: entry.person,
    date: entry.date,
    direction: entry.direction,
    amount: entry.amount,
    currency: entry.currency,
    category: entry.category,
    description: entry.description,
    created_by: entry.createdBy ?? 'nihal',
  })
  return {error: error ? new Error('Could not save personal money') : null}
}

export async function removePersonalTransaction(id: string): Promise<{error: Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error: null}
  const {error} = await supabase.from('personal_transactions').delete().eq('id', id)
  return {error: error ? new Error('Could not delete personal money') : null}
}
