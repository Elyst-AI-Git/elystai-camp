import type {DailyHours, Person, RestDay} from '../types'
import {createAnonClient} from '../supabase/browser'

type DbDailyHours = {id:string; person:Person; date:string; hours:number | string; updated_at?:string | null}
type DbRestDay = {id:string; person:Person; date:string}

const genericError = (error:unknown, fallback:string): Error | null => error ? new Error(fallback) : null

function mapHours(row:DbDailyHours):DailyHours {
  return {id:row.id,person:row.person,date:row.date,hours:Number(row.hours),updatedAt:row.updated_at ?? undefined}
}

function mapRestDay(row:DbRestDay):RestDay {
  return {id:row.id,person:row.person,date:row.date}
}

export async function fetchDailyHours():Promise<{data:DailyHours[] | null; error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {data:null,error:null}
  const {data,error} = await supabase.from('daily_hours').select('*').order('date',{ascending:false})
  if (error) return {data:null,error:new Error('Could not load daily hours')}
  return {data:(data as unknown as DbDailyHours[]).map(mapHours),error:null}
}

export async function saveDailyHours(entry:DailyHours):Promise<{error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error:null}
  const {error} = await supabase.from('daily_hours').upsert({id:entry.id,person:entry.person,date:entry.date,hours:entry.hours,updated_at:entry.updatedAt ?? new Date().toISOString()},{onConflict:'person,date'})
  return {error:genericError(error,'Could not save daily hours')}
}

export async function fetchRestDays():Promise<{data:RestDay[] | null; error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {data:null,error:null}
  const {data,error} = await supabase.from('rest_days').select('*').order('date',{ascending:false})
  if (error) return {data:null,error:new Error('Could not load rest days')}
  return {data:(data as unknown as DbRestDay[]).map(mapRestDay),error:null}
}

export async function saveRestDay(entry:RestDay):Promise<{error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error:null}
  const {error} = await supabase.from('rest_days').upsert({id:entry.id,person:entry.person,date:entry.date},{onConflict:'person,date'})
  return {error:genericError(error,'Could not save rest day')}
}

export async function removeRestDay(person:Person,date:string):Promise<{error:Error | null}> {
  const supabase = createAnonClient()
  if (!supabase) return {error:null}
  const {error} = await supabase.from('rest_days').delete().eq('person',person).eq('date',date)
  return {error:genericError(error,'Could not remove rest day')}
}
