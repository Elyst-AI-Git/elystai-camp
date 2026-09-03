import type {Task} from '../types'
import {createAnonClient} from '../supabase/browser'

type DbTask = {
  id: string
  sprint_id: string | null
  owner: Task['owner']
  title: string
  notes?: string | null
  day: string
  tier: Task['tier']
  category: Task['category']
  status: Task['status']
  waiting_on?: string | null
  blocked_by?: string | null
  completed_at?: string | null
  completed_by?: Task['completedBy'] | null
  carried_count?: number | null
}

const genericError = (error: unknown, fallback: string): Error | null => error ? new Error(fallback) : null

function mapTask(row: DbTask): Task {
  return {id:row.id,sprintId:row.sprint_id ?? '',owner:row.owner,title:row.title,notes:row.notes ?? undefined,day:row.day,tier:row.tier,category:row.category,status:row.status,waitingOn:row.waiting_on ?? undefined,blockedBy:row.blocked_by ?? undefined,completedAt:row.completed_at ?? undefined,completedBy:row.completed_by ?? undefined,carriedCount:Number(row.carried_count ?? 0)}
}

export async function fetchTasks(): Promise<{data:Task[] | null; error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {data:null,error:null}
  const {data,error} = await supabase.from('tasks').select('*').order('day')
  if (error) return {data:null,error:new Error('Could not load tasks')}
  return {data:(data as unknown as DbTask[]).map(mapTask),error:null}
}

export async function saveTask(task: Partial<Task> & {id:string}): Promise<{error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error:null}
  // Slip reasons have their own task_slip_reasons table; tasks does not have a
  // slip_reason column in the database schema.
  const payload = {id:task.id,sprint_id:task.sprintId,owner:task.owner,title:task.title,notes:task.notes ?? null,day:task.day,tier:task.tier,category:task.category,status:task.status,waiting_on:task.waitingOn ?? null,blocked_by:task.blockedBy ?? null,completed_at:task.completedAt ?? null,completed_by:task.completedBy ?? null,carried_count:task.carriedCount ?? 0}
  const {error} = await supabase.from('tasks').upsert(payload)
  return {error:genericError(error,'Could not save task')}
}

export async function removeTask(id:string): Promise<{error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error:null}
  const {error} = await supabase.from('tasks').delete().eq('id',id)
  return {error:genericError(error,'Could not delete task')}
}
