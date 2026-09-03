import type {WeeklyGoal, Person} from '../types'
import {createAnonClient} from '../supabase/browser'

type DbWeeklyGoal = {id:string; sprint_id:string; person:Person; title:string; description?:string|null; color:string; target?:number|null; value:number; week_start?:string|null}

function mapGoal(row: DbWeeklyGoal): WeeklyGoal {
  return {id:row.id, sprintId:row.sprint_id, person:row.person, title:row.title, description:row.description ?? undefined, color:row.color, target:row.target ?? undefined, value:Number(row.value ?? 0), weekStart:row.week_start ?? undefined}
}

export async function fetchWeeklyGoals(): Promise<{data:WeeklyGoal[]|null; error:Error|null}> {
  const supabase = createAnonClient()
  if (!supabase) return {data:null,error:null}
  const {data,error} = await supabase.from('weekly_goals').select('*').order('created_at')
  if (error) return {data:null,error:new Error('Could not load weekly goals')}
  return {data:(data as unknown as DbWeeklyGoal[]).map(mapGoal),error:null}
}

export async function saveWeeklyGoal(goal: WeeklyGoal): Promise<{error:Error|null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error:null}
  const {error} = await supabase.from('weekly_goals').upsert({id:goal.id,sprint_id:goal.sprintId,person:goal.person,title:goal.title,description:goal.description ?? null,color:goal.color,target:goal.target ?? null,value:goal.value,week_start:goal.weekStart ?? null})
  return {error:error ? new Error('Could not save weekly goal') : null}
}

export async function removeWeeklyGoal(id:string): Promise<{error:Error|null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error:null}
  const {error} = await supabase.from('weekly_goals').delete().eq('id',id)
  return {error:error ? new Error('Could not delete weekly goal') : null}
}
