import type {Sprint} from '../types'
import {createAnonClient} from '../supabase/browser'

type DbSprint = {
  id: string
  name: string
  start_date: string
  end_date: string
  goal: string
  target_calls: number
  is_active: boolean
  changes_next_sprint?: string | null
}

const genericError = (error: unknown, fallback: string): Error | null => error ? new Error(fallback) : null

function mapSprint(row: DbSprint): Sprint {
  return {id: row.id, name: row.name, startDate: row.start_date, endDate: row.end_date, goal: row.goal, targetCalls: Number(row.target_calls), isActive: row.is_active, changesNextSprint: row.changes_next_sprint ?? undefined}
}

export async function fetchSprints(): Promise<{data: Sprint[] | null; error: Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {data: null, error: null}
  const {data, error} = await supabase.from('sprints').select('*').order('start_date', {ascending: false})
  if (error) return {data: null, error: new Error('Could not load sprints')}
  return {data: (data as unknown as DbSprint[]).map(mapSprint), error: null}
}

export async function saveSprintChanges(id: string, changesNextSprint: string): Promise<{error: Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error: null}
  const {error} = await supabase.from('sprints').update({changes_next_sprint: changesNextSprint || null}).eq('id', id)
  return {error: genericError(error, 'Could not save sprint reflection')}
}

export async function saveSprint(sprint: Sprint): Promise<{error: Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error: null}
  const {error} = await supabase.from('sprints').upsert({id:sprint.id,name:sprint.name,start_date:sprint.startDate,end_date:sprint.endDate,goal:sprint.goal,target_calls:sprint.targetCalls,is_active:sprint.isActive,changes_next_sprint:sprint.changesNextSprint ?? null})
  return {error: genericError(error, 'Could not save sprint')}
}

export async function activateSprint(id: string): Promise<{error: Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error: null}
  const deactivate = await supabase.from('sprints').update({is_active:false}).neq('id', id)
  if (deactivate.error) return {error: new Error('Could not switch sprint')}
  const activate = await supabase.from('sprints').update({is_active:true}).eq('id', id)
  return {error: genericError(activate.error, 'Could not switch sprint')}
}
