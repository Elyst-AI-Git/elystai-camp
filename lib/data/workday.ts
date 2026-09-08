import type {Person, WorkdayLog} from '../types'
import {createAnonClient} from '../supabase/browser'

type DbWorkdayLog = {
  id: string
  person: Person
  date: string
  started_at?: string | null
  ended_at?: string | null
}

function mapLog(row: DbWorkdayLog): WorkdayLog {
  return {id: row.id, person: row.person, date: row.date, startedAt: row.started_at ?? undefined, endedAt: row.ended_at ?? undefined}
}

export async function fetchWorkdayLogs(): Promise<{data: WorkdayLog[] | null; error: Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {data: null, error: null}
  const {data, error} = await supabase.from('workday_logs').select('*').order('date', {ascending: false})
  if (error) return {data: null, error: new Error('Could not load workday logs')}
  return {data: (data as unknown as DbWorkdayLog[]).map(mapLog), error: null}
}

export async function saveWorkdayLog(entry: WorkdayLog): Promise<{error: Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error: null}
  const {error} = await supabase.from('workday_logs').upsert({
    id: entry.id,
    person: entry.person,
    date: entry.date,
    started_at: entry.startedAt ?? null,
    ended_at: entry.endedAt ?? null,
  }, {onConflict: 'person,date'})
  return {error: error ? new Error('Could not save workday log') : null}
}
