import type {SlipReason, TaskSlipReason} from '../types'
import {createAnonClient} from '../supabase/browser'

type DbTaskSlipReason = {
  id: string
  task_id: string
  reason: SlipReason
  moved_at: string
  moved_from_day: string
  moved_to_day: string
}

const genericError = (error: unknown, fallback: string): Error | null => error ? new Error(fallback) : null

function mapSlipReason(row: DbTaskSlipReason): TaskSlipReason {
  return {id: row.id, taskId: row.task_id, reason: row.reason, movedAt: row.moved_at, movedFromDay: row.moved_from_day, movedToDay: row.moved_to_day}
}

export async function fetchSlipReasons(): Promise<{data: TaskSlipReason[] | null; error: Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {data: null, error: null}
  const {data, error} = await supabase.from('task_slip_reasons').select('*').order('moved_at', {ascending: false})
  if (error) return {data: null, error: new Error('Could not load slip reasons')}
  return {data: (data as unknown as DbTaskSlipReason[]).map(mapSlipReason), error: null}
}

export async function saveSlipReason(slip: TaskSlipReason): Promise<{error: Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error: null}
  const {error} = await supabase.from('task_slip_reasons').insert({
    id: slip.id,
    task_id: slip.taskId,
    reason: slip.reason,
    moved_at: slip.movedAt,
    moved_from_day: slip.movedFromDay,
    moved_to_day: slip.movedToDay,
  })
  return {error: genericError(error, 'Could not save slip reason')}
}

export async function removeSlipReason(id: string): Promise<{error: Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error: null}
  const {error} = await supabase.from('task_slip_reasons').delete().eq('id', id)
  return {error: genericError(error, 'Could not remove slip reason')}
}
