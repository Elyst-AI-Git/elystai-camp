import type {Lead} from '../types'
import {createAnonClient} from '../supabase/browser'

type DbLead = {
  id: string
  company: string
  contact_name?: string | null
  stage: Lead['stage']
  owner: Lead['owner']
  source?: string | null
  next_action: string
  follow_up_date?: string | null
  estimated_value?: number | string | null
  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
}

function mapLead(row: DbLead): Lead {
  return {id: row.id, company: row.company, contactName: row.contact_name ?? undefined, stage: row.stage, owner: row.owner, source: row.source ?? undefined, nextAction: row.next_action, followUpDate: row.follow_up_date ?? undefined, estimatedValue: row.estimated_value === null || row.estimated_value === undefined ? undefined : Number(row.estimated_value), notes: row.notes ?? undefined, createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined}
}

function isMissingTable(error: unknown): boolean {
  const candidate = error as {code?: string; message?: string}
  return candidate?.code === 'PGRST205' || candidate?.code === '42P01' || candidate?.message?.toLowerCase().includes('does not exist') === true
}

export async function fetchLeads(): Promise<{data: Lead[] | null; error: Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {data: null, error: null}
  const {data, error} = await supabase.from('leads').select('*').order('updated_at', {ascending: false})
  if (error) return isMissingTable(error) ? {data: [], error: null} : {data: null, error: new Error('Could not load leads')}
  return {data: (data as unknown as DbLead[]).map(mapLead), error: null}
}

export async function saveLead(lead: Lead): Promise<{error: Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error: null}
  const {error} = await supabase.from('leads').upsert({
    id: lead.id,
    company: lead.company,
    contact_name: lead.contactName ?? null,
    stage: lead.stage,
    owner: lead.owner,
    source: lead.source ?? null,
    next_action: lead.nextAction,
    follow_up_date: lead.followUpDate ?? null,
    estimated_value: lead.estimatedValue ?? null,
    notes: lead.notes ?? null,
    created_at: lead.createdAt ?? new Date().toISOString(),
    updated_at: lead.updatedAt ?? new Date().toISOString(),
  })
  return {error: error ? new Error('Could not save lead') : null}
}

export async function removeLead(id: string): Promise<{error: Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error: null}
  const {error} = await supabase.from('leads').delete().eq('id', id)
  return {error: error ? new Error('Could not delete lead') : null}
}
