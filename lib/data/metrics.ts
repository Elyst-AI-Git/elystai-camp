import type {Metric, Person} from '../types'
import {createAnonClient} from '../supabase/browser'

type DbMetric = {
  id: string
  sprint_id: string | null
  date: string
  key: Metric['key']
  value: number | string
  logged_by: Person
}

const genericError = (error: unknown, fallback: string): Error | null => error ? new Error(fallback) : null

function mapMetric(row: DbMetric): Metric {
  return {id: row.id, sprintId: row.sprint_id ?? '', date: row.date, key: row.key, value: Number(row.value), loggedBy: row.logged_by}
}

export async function fetchMetrics(): Promise<{data: Metric[] | null; error: Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {data: null, error: null}
  const {data, error} = await supabase.from('metrics').select('*').order('date', {ascending: false})
  if (error) return {data: null, error: new Error('Could not load metrics')}
  return {data: (data as unknown as DbMetric[]).map(mapMetric), error: null}
}

export async function saveMetric(metric: Metric): Promise<{error: Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error: null}
  const {error} = await supabase.from('metrics').upsert({
    id: metric.id,
    sprint_id: metric.sprintId,
    date: metric.date,
    key: metric.key,
    value: metric.value,
    logged_by: metric.loggedBy ?? 'nihal',
  })
  return {error: genericError(error, 'Could not save metric')}
}

export async function removeMetric(id: string): Promise<{error: Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error: null}
  const {error} = await supabase.from('metrics').delete().eq('id', id)
  return {error: error ? new Error('Could not remove metric') : null}
}
